# Architecture reference

Updated 2026-11-15 from a read of the code. Paths are relative to the repo root.

## 1. Request flow

```
Browser
  ├─ storefront (Next.js, server components) ──► /api/v1/storefront/*   store chosen by Host header
  ├─ master-admin (Vite SPA)                 ──► /api/v1/platform/*     platform JWT
  └─ store-admin (Vite SPA)                  ──► /api/v1/store/{slug}/* store JWT (sign-in and catalogue wired; other views not yet)

Go API (backend/cmd/api)
  ├─ Platform DB  ecom_platform_main   stores, domains, themes, platform_users, audit_logs
  ├─ Tenant DBs   store_<slug>_<8hex>  one per store, on the same Postgres cluster, each owned by its own login role user_<slug>_<8hex>
  └─ Redis        domain/slug cache, sessions, rate limits, job stream
Go worker (backend/cmd/worker)  Redis Streams consumer + scheduler
```

## 2. Backend

### Entry points (run from `backend/`)

| Command | Purpose | Needs |
| :--- | :--- | :--- |
| `go run ./cmd/api` | HTTP API on `:PORT` (default 8080) | Platform Postgres, Redis. The platform DB user must have `CREATEDB` and `CREATEROLE`, because it creates a role and database per store. |
| `go run ./cmd/worker` | Redis Streams consumer (4 goroutines) and cron scheduler | Platform Postgres, Redis |
| `go run cmd/migrate/main.go -direction=up\|down -path=../infra/migrations/platform` | Platform migrations only | Platform Postgres |
| `go run cmd/seed/main.go` | Creates one bootstrap platform super admin only. Requires `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` (optional `SEED_ADMIN_FIRST_NAME`, `SEED_ADMIN_LAST_NAME`). Refuses to run when a super admin already exists. Creates no stores or themes. | Migrated platform DB |

Relative paths matter: the API serves `./uploads`, the worker writes `./backups`, the provisioner reads `../infra/migrations/store`.

### Configuration

`internal/config/config.go` reads environment variables with `os.LookupEnv`. Nothing loads `.env`. Every variable has a default equal to `.env.example`.

- Defaults: API 8080, platform Postgres 5432, store template Postgres 5433, Redis 6379.
- Read by code but missing from `.env.example`: `DATABASE_ENCRYPTION_KEY` (falls back to the first 32 bytes of `JWT_SECRET`), `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID`, `STORE_DB_TEMPLATE_MAX_OPEN_CONNS`, `STORE_DB_TEMPLATE_MAX_IDLE_CONNS`, `STORE_DB_TEMPLATE_CONN_MAX_LIFETIME`.
- Storefront reads `NEXT_PUBLIC_API_URL` (default `http://localhost:8080/api/v1`).
- `LOG_LEVEL` is ignored.

### Route map (`cmd/api/main.go`, `buildRouter`)

Global middleware: request ID, real IP, structured logger, compression, panic recovery, CORS, 60s timeout.

| Prefix | Guards | Routes |
| :--- | :--- | :--- |
| `/healthz`, `/api/v1/healthz`, `/uploads/*` | public | health, static media |
| `/api/v1/platform/auth` | `login`, `refresh` public; `logout` authenticated | |
| `/api/v1/platform/*` | `Authenticate` + `RequireActivePlatformSession` (live Redis session, 401 when revoked, 503 when Redis is down) + `RequirePlatformRole(SUPER_ADMIN, PLATFORM_STAFF)` | `/me`, `/stores` (list, create, get, `PATCH /{id}`, `PATCH /{id}/status`, delete, provisioning logs), `/domains` (list, add, verify, `PATCH /{id}`, `PATCH /{id}/primary`, delete), `/themes` (list, register, `PATCH /{id}`; no delete route, themes are deactivated through `PATCH`), `/security/audit` (super admin), `/admins` (list, create, `PATCH /{id}` and `DELETE /{id}` super admin only), `/audit-logs`, `/system/overview`, `/accounts` |
| `/api/v1/store/{store_slug}/auth/login` | tenant resolved, public | |
| `/api/v1/store/{store_slug}/*` | `StoreAdminTenantResolver` + `RequireTenantContext` + `Authenticate` + `RequireStoreRole(STORE_OWNER, STORE_ADMIN, STORE_STAFF)` | `/dashboard/overview`, `/catalog`, `/inventory`, `/orders`, `/customers`, `/promotions`, `/settings`, `/staff`, `/settings/payments`, `/logistics`, `/settings/logistics`, `/settings/marketing`, `/accounts`, `/reviews`, `/blog` |
| `/api/v1/storefront/*` | rate limit 120/min per host+IP, `StorefrontTenantResolver`, `RequireTenantContext` | `/config`, `/seo/*`, `/theme`, `/catalog`, `/cart`, `/checkout`, `/orders/{order_number}`, `/payments`, `/logistics`, `/marketing/config`, `/reviews`, `/promotions`, `/bundle-tiers`, `/blog` |

Tighter store guards: owner only for `PUT /settings`, staff changes and `/settings/payments`; owner or admin for `/settings/logistics` and `/settings/marketing`.

Webhooks live inside the storefront group: `POST /api/v1/storefront/payments/{gateway}/webhook` and `POST /api/v1/storefront/logistics/{carrier}/webhook`. They are resolved by Host header, so the gateway must call the store's own domain.

### Tenant resolution

- Storefront: host taken from `X-Original-Host`, then `X-Forwarded-Host`, then `r.Host` (`internal/middleware/tenant.go`), resolved by `resolver.ResolveByDomain` with a Redis cache. Bare `localhost` maps to `mior`.
- Store admin: `{store_slug}` URL parameter or `X-Store-Slug` header, resolved by `ResolveBySlug`.
- Errors: 404 unknown, 403 `STORE_SUSPENDED`, 410 `STORE_ARCHIVED`.
- Inside handlers and services (`internal/store/context`, imported as `storeCtx`):
  - `storeCtx.FromContext(ctx)` returns `*StoreContext{Store, TenantDB, Domain, IsCustom}`. This is the usual call.
  - `storeCtx.GetTenantDB(ctx)`, `GetStoreID(ctx)`, `GetStoreSlug(ctx)` for single values.
- Tenant connection pools are cached per store in `store/database.TenantPoolManager`.

### Auth

- `pkg/auth.TokenManager`: HS256 JWT, issuer `ecom-ventures-auth`.
- Claims: `user_id`, `email`, `role`, `user_type` (`PLATFORM` or `STORE`), `store_id`, `store_slug`, `token_type` (`ACCESS` or `REFRESH`). `middleware.Authenticate` does not yet check `token_type`.
- In a handler: `r.Context().Value(middleware.AuthClaimsKey).(*pkgAuth.Claims)`.
- Platform roles: `SUPER_ADMIN`, `PLATFORM_STAFF`. Store roles: `STORE_OWNER`, `STORE_ADMIN`, `STORE_STAFF`.
- `RequireStoreRole` rejects a token whose `store_id` differs from the resolved store (403 `CROSS_TENANT_ACCESS_DENIED`). `SUPER_ADMIN` bypasses both role checks.

### Shared packages

| Package | Use |
| :--- | :--- |
| `pkg/response` | Success envelope `{success, data, meta, timestamp}` via `JSON` / `JSONWithMeta`. Errors as RFC 7807 `application/problem+json` via `Problem`, `BadRequest`, `Unauthorized`, `Forbidden`, `NotFound`, `Conflict`, `InternalServerError`, `ValidationProblem`. Older `Write*` aliases (`WriteJSON`, `WriteBadRequest` and so on) do the same and are used in about half the handlers; prefer the short names in new code. |
| `pkg/crypto` | `Encrypt` / `Decrypt(text, key)`, AES-256-GCM. Key must be exactly 32 bytes. |
| `pkg/hasher` | Argon2id: `HashPassword`, `ComparePassword`. |
| `pkg/storage` | `ObjectStorage` interface; only `LocalStorage` exists. Images only, 10 MB limit. |

### Module layout

Tenant modules in `internal/store/<name>/` and `internal/storefront/<name>/`: `dto.go` (or `model.go`), `repository.go`, `service.go`, `handler.go`, tests. Shared entities are in `internal/store/models/`. Platform modules in `internal/platform/<name>/` have no repository layer; the service holds `platformDB *sql.DB` and runs SQL directly.

| Area | Modules |
| :--- | :--- |
| `platform/` | `accounts`, `auth`, `database`, `domains`, `migrator`, `models`, `provisioner`, `store_mgmt`, `system`, `themes` |
| `store/` | `accounts`, `auth`, `blog`, `catalog`, `context`, `customers`, `database`, `inventory`, `logistics`, `marketing`, `models`, `orders`, `payments`, `promotions`, `resolver`, `reviews`, `settings` |
| `storefront/` | `catalog`, `cart`, `checkout` |
| other | `worker`, `security`, `middleware`, `config` |

Legacy code that the router does not use, and new code must not use: `internal/platform/registry.go` (`MemoryRegistry`), `internal/store/store.go` (`TenantContext`), `middleware.TenantResolver`, `crypto.EncryptAESGCM` / `DecryptAESGCM`.

### Store provisioning (`platform/store_mgmt.Service.CreateStore`)

1. Validate slug; check slug and domain are unique.
2. Require an explicit theme slug naming an active platform theme. An unknown or inactive theme fails the request; nothing is substituted.
3. Insert `stores` row with status `PROVISIONING`.
4. `provisioner.ProvisionStoreDatabase`: `CREATE ROLE user_<slug>_<8hex> LOGIN PASSWORD ...` with a random password, `CREATE DATABASE store_<slug>_<8hex> OWNER user_<slug>_<8hex>`, replay every `infra/migrations/store/*.up.sql` in order, seed `store_settings`. The platform DB user needs `CREATEROLE` and `CREATEDB`.
5. Save the encrypted DB password.
6. Seed a `STORE_OWNER` in tenant `store_staff`.
7. Insert `store_themes`.
8. Insert `domains` (default `<slug>.localhost`).
9. Set status `ACTIVE`.
10. Clear the resolver cache.

A failure in steps 4 to 8 drops the database, drops the role and deletes the row. `DeleteStore` is a hard delete: it drops the database, drops the role (`DROP ROLE IF EXISTS`) and removes `uploads/<slug>` and `backups/<slug>`.

### Orders and inventory

- States: `PENDING` → `CONFIRMED` / `PROCESSING` / `CANCELLED`; `CONFIRMED` → `PROCESSING` / `CANCELLED`; `PROCESSING` → `SHIPPED` / `CANCELLED`; `SHIPPED` → `DELIVERED` / `CANCELLED` / `REFUNDED`; `DELIVERED` → `REFUNDED`. `CANCELLED` and `REFUNDED` are terminal (`store/orders/state_machine.go`).
- Stock is in `variant_inventory` (`quantity_available`, `quantity_reserved`). Sellable is available minus reserved. Every change writes a `stock_movements` row.
- Order creation reserves stock (`ReserveStockTx`, row lock) in the same transaction. Moving to `SHIPPED` calls `FulfillStockTx`. Cancelling before shipping calls `ReleaseStockTx`.

### Integrations

- Payments (`store/payments/gateway.go`): `PaymentGatewayDriver{InitiatePayment, VerifyPayment, HandleWebhook}`. Drivers: bKash, SSLCommerz, Stripe, COD.
- Couriers (`store/logistics/courier.go`): `CourierDriver{CreateConsignment, TrackConsignment, CancelConsignment, HandleStatusWebhook}`. Drivers: Steadfast, Pathao, RedX, Manual.
- Marketing: `store/marketing/capi.go` sends Meta Conversions API events.
- Credentials are per store, encrypted, in tenant tables `store_payment_gateways`, `store_courier_configs`, `store_marketing_configs`.

### Worker

- Stream `stream:ecom:jobs`, dead-letter stream `stream:ecom:jobs:dlq`, group `ecom-worker-group`.
- Job types (`worker/dto.go`): `JOB_SEND_EMAIL`, `JOB_META_CAPI_RETRY`, `JOB_EXPIRE_CARTS`, `JOB_AUDIT_LOW_STOCK`, `JOB_TENANT_DB_BACKUP`.
- Enqueue: `worker.NewRedisQueueProducer(redisClient).Enqueue(ctx, jobType, tenantID, storeSlug, payload, maxRetries)`.
- New job: add the constant and payload in `dto.go`, write a `JobHandlerFunc`, register it in `cmd/worker/main.go`.
- Scheduler: expire carts hourly, low-stock audit every 6 hours, backup every 24 hours.

## 3. Database

### Platform migrations (`infra/migrations/platform/`)

- `000001`: `platform_users`, `stores`, `domains`, `themes`, `store_themes`, `store_provisioning_logs`, `audit_logs`
- `000002`: `portfolio_financial_summaries`, `brand_billing_records`
- `000003`: `domains.provider_hostname_id` for Cloudflare hostname lifecycle operations
- `000004`: inserts four storefront themes (`ON CONFLICT (slug) DO NOTHING`)

Tracked in `platform_schema_migrations`, one transaction per file.

### Store migrations (`infra/migrations/store/`)

- `000001`: `store_metadata`, `store_settings`, `store_staff`, `categories`, `products`, `inventory_levels`, `customers`, `orders`, `order_items`
- `000002`: `attributes`, `attribute_values`, `product_images`, `product_variants`, `variant_attribute_values`, `variant_images`, `variant_inventory`, `stock_movements`, `customer_addresses`, `carts`, `cart_items`, `order_shipments`, `payment_transactions`, `order_status_history`
- `000003`: order fulfilment columns
- `000004`: `account_transactions`, `account_expenses`, `account_payouts`
- `000005`: `product_reviews`, `review_images`
- `000007`: order risk and paid/due columns, `order_call_notes`
- `000008`: `bundle_tiers`
- `000009`: `blog_categories`, `blog_posts`, `blog_post_products`
- `000010`: SEO columns on `store_settings`, `products`, `categories`
- `000011`: display order: `products.sort_order`, `products.featured_order`, `attributes.sort_order`. Existing stores get the same columns from `catalog.EnsureOrderingSchema` (`backend/internal/store/catalog/schema.go`), which the catalog repositories call once per connection pool.
- `000012`: `brands` and `care_instructions` tables (each with `sort_order`). Existing stores get them from `catalog.EnsureBrandCareSchema`. Routes: `/catalog/brands` and `/catalog/care-instructions` (list, create, `PUT /{id}`, `DELETE /{id}`, `PUT /reorder`). Products link to one brand and one care instruction through `products.brand_id` and `products.care_instruction_id` (migration `000013`, `ON DELETE SET NULL`), set with `PATCH /catalog/products/{id}/links`. The storefront product detail returns `brand_name`, `brand_logo_url`, `brand_origin`, `care_instruction_title` and `care_instructions` for active links only.

There is no `000006`. The next file should be `000014`.

Tables created only at runtime by `EnsureSchema`, with no migration file: `store_payment_gateways`, `payment_idempotency_keys`, `store_courier_configs`, `store_marketing_configs`, `coupons`, `coupon_usages`.

## 4. Frontends

### master-admin (`apps/master-admin`)

- React 18, Vite 5, Tailwind 3, axios, lucide-react. Dev port 5173, Vite proxies `/api` to `http://localhost:8080`.
- No router library: `App.tsx` keeps `currentPath` in state and renders pages by comparison. The URL does not change on navigation.
- `src/lib/api.ts`: axios instance, base `/api/v1`, tokens in `localStorage` (`ecom_platform_access_token`, `ecom_platform_refresh_token`, `ecom_platform_user`), automatic refresh on 401.
- Pages: Login, Dashboard, Stores, Accounts, Domains, Themes, Admins, AuditLogs, SecurityAudit, Settings.
- Themes page: register, edit (`PATCH`) and activate or deactivate. No delete.
- Shared UI: `src/components/ui/{ConfirmDeleteModal,MetricCard,StatusBadge}.tsx`.
- `ConfirmDeleteModal` props: `isOpen`, `itemName`, `onConfirm`, `onClose`, optional `title`, `itemType`, `warningMessage`, `confirmButtonText`, `isDeleting`.

### store-admin (`apps/store-admin`)

- React 18, Vite, lucide-react only. No Tailwind, no axios: requests use `fetch` through `src/lib/api.ts`. Dev port 5174.
- Sign-in keeps the staff session in one `localStorage` key through `src/lib/session.ts`.
- Sign-in and the catalogue view use the real API (`src/lib/catalog-api.ts`): products, featured products, categories and attributes are loaded from the server and can be reordered (`SortableList`: drag, typed position, arrows); products can be marked featured. Brands and care instructions have full add, edit, delete and reorder. Product, category and attribute create/edit/delete, and every other view, still show empty lists and have disabled actions.
- `App.tsx` (about 1,150 lines) owns all state and passes handlers to 13 `*View.tsx` components.
- Styling: CSS variables and classes in `src/index.css`.
- `ConfirmDeleteModal` at `src/components/ConfirmDeleteModal.tsx` (same props, without `isDeleting`).

### storefront (`apps/storefront`)

- Next.js 14.2 App Router, Tailwind 3. Default dev port 3000.
- Routes: `/`, `/about`, `/catalog`, `/checkout`, `/returns`, `/shipping-policy`, `/blog`, `/blog/[slug]`, `/product/[slug]`, `/order-confirmed/[orderNumber]`, `/orders/lookup`, plus `robots.ts` and `sitemap.ts`.
- `src/middleware.ts` copies the request host into `x-storefront-host`. `?brand=<slug>` or `?store=<slug>` overrides it for that one request.
- Fetch helpers are in `src/lib/*-api.ts`. The API base URL line is repeated in 12 files; there is no shared client.
- Theme: the server merges the theme's design config with the store's overrides (`mergeThemeConfig` in `cmd/api/main.go`, served from `/storefront/config`). `components/layout/ThemeInjector.tsx` writes `--brand-primary`, `--brand-secondary`, `--brand-font-heading`, `--brand-font-body`, `--brand-radius`. Tailwind exposes them as `brand-primary`, `brand-secondary`, `rounded-brand`.
- Cart: `src/context/CartContext.tsx`, session id in `localStorage['ecom_cart_session']`, sent as `X-Cart-Session`.
- Analytics: `components/analytics/AnalyticsScripts.tsx` and `lib/analytics.ts` (`trackStorefrontEvent`).

## 5. Local environments

### Option A: Docker Compose (`make up`)

Starts infrastructure only: Nginx (80), platform Postgres (5432), store prototype Postgres (5433, `postgres:16-alpine` in `docker-compose.yml`), Redis (6379), MailHog (1025, 8025). Backend and frontends run on the host. Requires Docker Desktop to be running.

Nginx hostnames (`infra/nginx/conf.d/local-routing.conf`):

| Host | `/api/` | `/` |
| :--- | :--- | :--- |
| `master.dropiobd.localhost` | :8080 | :5173 |
| `store.dropiobd.localhost` | :8080 | :5174 |
| `api.dropiobd.localhost` | | :8080 |
| `*.localhost` | :8080 | :3000 |

### Option B: `run-dev.ps1`

Starts native Postgres (`C:\ZKBioTime\pgsql`, data folder `<your data folder>`, which is not the fresh test database) and Redis (`C:\ZKBioTime\redis`) if their ports are free, then opens windows for `backend\api.exe`, `backend\worker.exe`, master-admin (5173), store-admin (5174) and storefront (**3002**). No Nginx, no MailHog. It does not rebuild the `.exe` files.

### Local test database

The fresh local test database is PostgreSQL 15 on port 5433, as set up by the operator. The old data folder `<your data folder>` is not running and must not be assumed to be the test database. Redis runs on 6379.

### Local test accounts

For local development only. Passwords come from the seed environment variables and are not written here.

- Master Admin: `admin@localtest.dev` (dev only).
- Test store: slug `testshop`, owner `owner@testshop.local`.

### Production files

- `docker-compose.prod.yml`: Postgres, Redis, API, worker, master-admin, storefront. Needs `PROD_DB_PASSWORD`, `PROD_REDIS_PASSWORD`, `DATABASE_ENCRYPTION_KEY`, `JWT_SECRET`.
- `.github/workflows/ci-cd.yml`: runs `.agent/checks.sh`, Go tests and type checks, then builds images without pushing. There is no deploy step.
- Neither is ready for production use; see [PROJECT_STATUS.md](PROJECT_STATUS.md).
