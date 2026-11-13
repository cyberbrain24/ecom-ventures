# Project status

Snapshot taken 2026-11-13 by reading the code and running the offline checks. Update a line when it stops being true.

## Verified by running

| Check | Result |
| :--- | :--- |
| `gofmt -l .` | clean |
| `go build ./...` | passes (45 packages) |
| `go vet ./...` | passes |
| `go test ./...` | passes in all 36 packages that have tests |
| `tsc --noEmit` in master-admin, store-admin, storefront | passes in all three |
| `docker compose -f docker-compose.yml config` | valid |
| `docker compose -f docker-compose.prod.yml config` | valid only when `PROD_DB_PASSWORD`, `PROD_REDIS_PASSWORD` and `DATABASE_ENCRYPTION_KEY` are set |

## Not verified

- Nothing was run against a live Postgres or Redis. The Go tests use nil database handles and in-memory fakes, so SQL statements, migrations, provisioning and rate limiting are untested.
- No end-to-end flow (create store, browse, add to cart, check out, pay) was exercised.
- Production builds (`vite build`, `next build`) and Docker image builds were not run.
- `go test -race` cannot run on this machine (no gcc).
- Nine Go packages have no tests: `cmd/migrate`, `cmd/seed`, `cmd/worker`, `platform/accounts`, `platform/auth`, `platform/models`, `platform/system`, `store/accounts`, `store/auth`.
- No frontend has a test runner, and eslint is not installed, so `npm run lint` fails everywhere.

## What is real and what is mock

| Part | State |
| :--- | :--- |
| Backend API | Real code for all listed modules. Unit-tested only at the logic level. |
| master-admin | Calls the real API, but hides failures (details below). `AccountsPage` is fully static. `SettingsPage` save does nothing. |
| store-admin | **Mock.** No API calls, no login, no tenant resolution. All data is in-memory from `src/data/initialData.ts`. The backend store APIs exist but nothing calls them. |
| storefront | Calls the real API, but falls back to hard-coded "Mior" demo content when the API fails or returns nothing. |
| Worker | Runs, but email sending only logs, and the API never enqueues any job. |
| Production deployment | Not usable as written. |

## Known defects, by priority

### Security

1. **master-admin login cannot fail.** `apps/master-admin/src/context/AuthContext.tsx` (catch block near line 53) creates a fake `SUPER_ADMIN` session with token `mock_master_token` whenever the login request errors, including on a wrong password. `LoginPage.tsx` also has a demo-access button with hard-coded credentials.
2. **Refresh tokens are accepted as access tokens.** `middleware.Authenticate` does not check `token_type` and does not consult the Redis session store, so logout does not revoke access tokens.
3. **Login endpoints are not rate-limited.** `TierStaffAuth` and `TierCustomerCheckout` are defined but unused. The limiter also allows all traffic when Redis errors.
4. **Webhook signatures.** The bKash and SSLCommerz webhook handlers show no signature check. Stripe's check is skipped when no webhook key is saved.
5. **Default secrets in source.** `internal/config/config.go` has a default `JWT_SECRET` and database and Redis passwords; `cmd/seed/main.go` has hard-coded admin and owner passwords and resets admin passwords on every run; `docker-compose.yml` has plain-text passwords.
6. **CORS** allows any `http://localhost:*` and `http://*.localhost` origin with credentials in every environment.
7. **No per-tenant database role.** Every tenant database is reached with the platform user. A random password is stored per store but never set on any role.

### Data correctness

8. **Store migrations never reach existing stores.** They run only when a store is created. `store_schema_migrations` is not maintained. Six tables exist only through runtime `EnsureSchema` code.
9. **Encryption key length.** `marketing.Service` and the worker backup handler receive the full `DATABASE_ENCRYPTION_KEY`; other callers truncate to 32 bytes. A key that is not exactly 32 bytes breaks saving marketing credentials.
10. **Order status changes are not locked.** `TransitionOrderStatus` reads the current status outside the transaction. `REFUNDED` does not restock.
11. **Worker retries do not happen.** A failed job below the retry limit is neither acknowledged nor re-queued (`worker/consumer.go`).
12. **Worker maintenance jobs use the encrypted password as if it were plain text** (`worker/handlers_maintenance.go`), so they cannot connect to tenant databases. The backup job dumps only the platform database, with hard-coded connection details.
13. **Courier gaps.** `CancelConsignment` does nothing for Steadfast, Pathao and RedX. Pathao tracking always returns `IN_TRANSIT`.
14. **Media URLs are hard-coded** to `http://localhost:8080/uploads` (`cmd/api/main.go`), so they are wrong anywhere but local.

### Fallbacks that hide failures

15. **Storefront.** `lib/api.ts` returns a "Mior Fashion" config on any error, so unknown or suspended stores render as Mior. `catalog-api.ts` returns four fake products when the API fails or the store has no products. `blog-api.ts` and `reviews-api.ts` serve demo content; review submission reports success even when the request failed. `product/[slug]/page.tsx` falls back to demo details. `ChooseProductModal.tsx` uses a hard-coded product list.
16. **master-admin.** Dashboard, Stores, Domains, Themes, Admins, SecurityAudit and AuditLogs substitute hard-coded data when loading fails. Edit and delete handlers on several pages ignore API errors and update the screen anyway.
17. **Backend.** `platform/accounts/service.go` returns hard-coded billing records when the table is empty. The Cloudflare client returns fake records when no token is set.
18. **Storefront browser calls ignore the store.** `CartContext`, `AnalyticsScripts`, `CheckoutSummary`, `ProductBundleBuilder` and `orders/lookup` call the API directly from the browser with no store header. In native development every one of them hits store `mior`, whatever hostname is open.

### Rule violations already in the code

19. `apps/master-admin/src/components/stores/StoreDetailDrawer.tsx` uses `window.confirm` and contains a "future releases" stub message. Several forms use `alert()`.
20. master-admin modals use `animate-in` classes, but the `tailwindcss-animate` plugin is not installed.

### Deployment

21. `docker-compose.prod.yml` passes `PLATFORM_DATABASE_URL`, `REDIS_URL`, `UPLOADS_DIR` and `APP_BASE_URL`, none of which the backend reads. In production the API would use its `localhost` defaults.
22. `apps/storefront/Dockerfile` copies a `public/` directory that does not exist.
23. `backend/Dockerfile` does not build `migrate` and does not include `infra/migrations`, which the provisioner needs.
24. There is no `apps/store-admin/Dockerfile`, no reverse proxy and no published ports in the production compose file.
25. CI builds images but never pushes or deploys.

### Housekeeping

26. `backend/worker.exe`, `migrate.exe` and `seed.exe` are older than the source. `api.exe~` is a leftover.
27. Each app has its own `package-lock.json` next to the root one.
28. Both compose files use the obsolete `version` key.
29. `store-admin` uses `lucide-react` 1.x while `master-admin` uses 0.383.
30. Very large files: `store-admin/src/components/CatalogView.tsx` (about 2,500 lines), `AccountsView.tsx` (about 1,600), `App.tsx` (about 1,150); `backend/cmd/api/main.go` contains about 180 lines of duplicated SEO SQL.

## Suggested order of work

1. Bring the stack up locally and run one real end-to-end pass (migrate, seed, browse, check out) to find what breaks against a live database.
2. Fix the security items 1 to 4.
3. Build a tenant migration runner (item 8).
4. Connect store-admin to the backend: API client, login, slug resolution, then one view at a time.
5. Remove the silent fallbacks (items 15 to 18) so failures are visible.
6. Repair the production compose and Dockerfiles (items 21 to 25).
