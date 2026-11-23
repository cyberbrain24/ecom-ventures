# Project status

Updated 2026-11-15 by reading the code. The "Verified by running" table is from the 2026-11-13 run and has not been repeated since the 2026-11-15 changes. Update a line when it stops being true.

## Verified by running (2026-11-13)

| Check | Result |
| :--- | :--- |
| `gofmt -l .` | clean |
| `go build ./...` | passes (45 packages) |
| `go vet ./...` | passes |
| `go test ./...` | passes in all 36 packages that have tests |
| `tsc --noEmit` in master-admin, store-admin, storefront | passes in all three |
| `docker compose -f docker-compose.yml config` | valid |
| `docker compose -f docker-compose.prod.yml config` | valid only when `PROD_DB_PASSWORD`, `PROD_REDIS_PASSWORD` and `DATABASE_ENCRYPTION_KEY` are set |

## Cleanup and changes (2026-11-15)

Removed from the code: the seeded sample stores, themes and admins (the seed command now creates only one bootstrap super admin from `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`); the Store Admin demo data file and demo store switcher; the Master Admin fake login session, invented health and security figures, and hard-coded theme visuals; the storefront demo-store, product, blog and review fallbacks, fixed delivery fees and the AI fit check; the sample rows in store migrations 000008 to 000010; the in-memory registry and legacy tenant resolver; the mock Cloudflare client. Store creation requires an explicit, active theme slug and never substitutes another theme. Failures now show an error or an honest empty state instead of fabricated content.

Added:

- `PATCH /platform/stores/{id}`, `PATCH /platform/themes/{id}`, `PATCH /platform/domains/{id}`, `PATCH` and `DELETE /platform/admins/{id}`. There is no theme delete route: themes are deactivated and reactivated through `PATCH`, and a deactivated theme cannot be assigned to a new store.
- `RequireActivePlatformSession` on every protected platform route.
- A production start-up guard (`APP_ENV=production` refuses development secrets).
- Platform migration `000004_seed_storefront_themes`, which inserts four storefront themes (`ON CONFLICT (slug) DO NOTHING`).
- A PostgreSQL login role per store (`user_<slug>_<8hex>`), created during provisioning before the tenant database and dropped on store delete. The platform database user needs `CREATEROLE` and `CREATEDB`.

Still open from the audit, by decision or size:

- A real email provider: the worker fails email jobs with `ErrNoEmailProvider` instead of reporting success.
- Real carrier tracking and cancellation; carrier status webhooks are unauthenticated.
- Credential field names in the logistics and payment configs (a merchant password is held in the webhook-key field).
- Uploaded-media base URL is still `http://localhost:8080/uploads` (`cmd/api/main.go`).
- Existing databases keep old data: the live `mior` store, any theme rows seeded before the cleanup, and the sample bundle, blog and SEO rows copied into stores created before this cleanup. Existing stores do not get new store migrations (see item 8).
- Creating a domain with `is_primary` when a primary exists returns 500 instead of 409 (`platform/domains/service.go` create path).
- The platform session key is per user, not per token: a login after a logout makes an older access token valid again until it expires.
- The repo-root `config.yaml` and an untracked file named after an API key contain a credential that must be revoked and removed.

## Local test environment

- The fresh local test database is PostgreSQL 15 on port 5433. This is the operator's setup and is not checked by the code.
- The old data folder `<your data folder>` is not running. `run-dev.ps1` still points at it, so starting that script will use the old data.
- Redis runs on 6379.

## Not verified

- Nothing in the 2026-11-15 changes was run against a live Postgres or Redis. The Go tests use nil database handles and in-memory fakes, so SQL statements, migrations, provisioning (role creation and drop) and rate limiting are untested against a database.
- No end-to-end flow (create store, browse, add to cart, check out, pay) was exercised.
- Production builds (`vite build`, `next build`) and Docker image builds were not run.
- `go test -race` cannot run on this machine (no gcc).
- Nine Go packages have no tests: `cmd/migrate`, `cmd/seed`, `cmd/worker`, `platform/accounts`, `platform/auth`, `platform/models`, `platform/system`, `store/accounts`, `store/auth`.
- No frontend has a test runner, and eslint is not installed, so `npm run lint` fails everywhere.

## What is real and what is mock

| Part | State |
| :--- | :--- |
| Backend API | Real code for all listed modules. Unit-tested only at the logic level. |
| master-admin | Uses the real API. Accounts reads platform aggregates and billing records; settings shows reported database/cache status; security audit and audit logs show an error or an empty state when requests fail. Other pages still need a full error-handling review. |
| store-admin | Sign-in (session in `localStorage` through `src/lib/session.ts`) and the catalogue view (products, featured, categories, attributes, brands, care instructions) use the real API. Brands and care instructions also have add, edit and delete. Product, category and attribute create/edit/delete and every other view are not connected and show empty lists with disabled actions. The ordering, brand and care SQL has not been run against a live database. |
| storefront | Server-side config, catalog, product, blog, and review reads use the selected store API without fabricated result sets. Product bundle selection is also API-backed. Active browser requests forward the store host; the unused `src/lib/cart-api.ts` helper still has direct fetches. |
| Worker | Runs, but email sending only logs, and the API never enqueues any job. |
| Production deployment | Not usable as written. |

## Known defects, by priority

### Security

1. **Platform session check is per user.** Protected platform routes require a live Redis session, so deleting, suspending or demoting an admin cuts off their access token at once. The key is per user, not per token, so a later login makes an older access token valid again until it expires.
2. **Refresh tokens are accepted as access tokens.** `middleware.Authenticate` does not check `token_type`.
3. **Login endpoints are not rate-limited.** `TierStaffAuth` and `TierCustomerCheckout` are defined in `middleware/ratelimit.go` but not used by the router. The limiter also allows all traffic when Redis errors.
4. **Webhook verification is untested against real gateways.** SSLCommerz is confirmed through its validation API, bKash through a payment query, Stripe by signature with a mandatory secret and a 5 minute tolerance; the amount, currency and order reference must match before an order is settled. Carrier status webhooks (Steadfast, Pathao, RedX) are still unauthenticated.
5. **Development secrets remain in source as local defaults.** `internal/config/config.go` and `docker-compose.yml` still carry development passwords, but with `APP_ENV=production` the API refuses to start unless real secrets are supplied by the environment.
6. **CORS** allows `http://localhost:*` and `http://*.localhost` origins with credentials only when `APP_ENV` is development.
7. **Per-store database roles exist, but are untested against a live database.** Each store gets its own login role (`user_<slug>_<8hex>`), created with a random password during provisioning and dropped on delete. The platform database user must hold `CREATEROLE` and `CREATEDB`. Before this change every tenant database was reached with the platform user.

### Data correctness

8. **Store migrations never reach existing stores.** They run only when a store is created. `store_schema_migrations` is not maintained. Six tables exist only through runtime `EnsureSchema` code.
9. **Encryption key length.** `marketing.Service` and the worker backup handler receive the full `DATABASE_ENCRYPTION_KEY`; other callers truncate to 32 bytes. A key that is not exactly 32 bytes breaks saving marketing credentials.
10. **Order status changes are not locked.** `TransitionOrderStatus` reads the current status outside the transaction. `REFUNDED` does not restock.
11. **Worker retries do not happen.** A failed job below the retry limit is neither acknowledged nor re-queued (`worker/consumer.go`).
12. **Worker maintenance jobs** decrypt the tenant password and report per-store failures. The backup job dumps each tenant database with decrypted credentials and fails (no stand-in file is written) when `pg_dump` fails. Not run against a live database.
13. **Courier gaps.** `CancelConsignment` and Pathao tracking return explicit "not implemented" errors. Pathao booking maps the city and zone names from the order address to Pathao IDs through Pathao's own lists; the address `state_province` must hold the exact Pathao zone name.
14. **Media URLs are hard-coded** to `http://localhost:8080/uploads` (`cmd/api/main.go`), so they are wrong anywhere but local.

### Fallbacks that hide failures

15. **Storefront browser calls ignore the store.** Active storefront browser requests forward the store host. The unused `src/lib/cart-api.ts` helper still contains direct fetches.
16. **master-admin.** Accounts and infrastructure settings use API-backed results, and security audit and audit logs show errors instead of substituted results. Remaining pages still need a full review for hidden failures and optimistic error handling.
17. **Backend analytics and edge integration.** Portfolio metrics and billing read platform tables and return empty results when those tables contain no data. Gateway fee analytics have no backing table yet. Cloudflare operations require configured credentials and report API failures.
18. **Unused storefront cart helper lacks tenant-host propagation.** `src/lib/cart-api.ts` has direct fetches but no current imports or callers.

### Rule violations already in the code

19. master-admin and store-admin use no `window.confirm` or `alert()` calls. Deletes in master-admin use `ConfirmDeleteModal`, and errors are shown inline from the server's `detail` text. Store-admin's `ConfirmDeleteModal` is the older copy without `isDeleting`.
20. master-admin modals use `animate-in` classes, but the `tailwindcss-animate` plugin is not installed.

### Deployment

21. `docker-compose.prod.yml` passes `PLATFORM_DATABASE_URL`, `REDIS_URL`, `UPLOADS_DIR` and `APP_BASE_URL`, none of which the backend reads. In production the API would use its `localhost` defaults.
22. `apps/storefront/Dockerfile` copies a `public/` directory that does not exist.
23. `backend/Dockerfile` does not build `migrate` and does not include `infra/migrations`, which the provisioner needs.
24. There is no `apps/store-admin/Dockerfile`, no reverse proxy and no published ports in the production compose file.
25. CI builds images but never pushes or deploys.

### Housekeeping

26. `backend/worker.exe`, `migrate.exe` and `seed.exe` may be older than the source. `api.exe~` is a leftover.
27. Each app has its own `package-lock.json` next to the root one.
28. Both compose files use the obsolete `version` key.
29. `store-admin` uses `lucide-react` 1.x while `master-admin` uses 0.383.
30. Very large files: `store-admin/src/components/CatalogView.tsx` (about 2,500 lines), `AccountsView.tsx` (about 1,600), `App.tsx` (about 1,150); `backend/cmd/api/main.go` contains about 180 lines of duplicated SEO SQL.

## Local test accounts

For local development only. The passwords come from the seed environment variables and are not recorded here.

- Master Admin: `admin@localtest.dev` (dev only). Created by `cmd/seed` from `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`.
- Test store: slug `testshop`, owner `owner@testshop.local`. Created through the Master Admin API, not by the seed command; the owner password was chosen at creation.

## Suggested order of work

1. Bring the stack up locally and run one real end-to-end pass (migrate, seed, browse, check out) to find what breaks against a live database, including store creation with per-store role creation.
2. Fix the security items 1 to 4.
3. Build a tenant migration runner (item 8).
4. Connect the remaining store-admin views to the backend, one view at a time.
5. Remove the silent fallbacks (items 15 to 18) so failures are visible.
6. Repair the production compose and Dockerfiles (items 21 to 25).
