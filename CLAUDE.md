# Ecom Ventures

Multi-brand e-commerce platform: one Go backend and one shared storefront serve many stores. Each store has its own PostgreSQL database, domain and theme. Target market is Bangladesh (bKash, SSLCommerz, Steadfast, Pathao, RedX; platform domain `dropiobd.com`).

Read these before non-trivial work:

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): routes, tenant resolution, database, module layout, frontends, infra.
- [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md): what is real, what is mock, verified build status, known defects.
- [AGENT.md](AGENT.md): the original module registry from the previous tool. Its file paths are accurate; its "complete / passed / verified" claims are not. Trust the two docs above where they disagree.

## Layout

| Path | What |
| :--- | :--- |
| `backend/` | Go 1.22 modular monolith. Module path `ecom-ventures/backend`. Chi router, raw `database/sql` + `lib/pq`, Redis. No ORM. |
| `backend/cmd/{api,worker,migrate,seed}` | The four binaries. All must run with working directory `backend/`. |
| `backend/internal/platform/` | Platform-level modules (stores, domains, themes, admins, auth). Use the platform DB. |
| `backend/internal/store/` | Store-admin modules (catalog, orders, inventory, payments and so on). Use the tenant DB. |
| `backend/internal/storefront/` | Public shopper endpoints (catalog, cart, checkout). Use the tenant DB. |
| `backend/pkg/` | `response`, `auth`, `crypto`, `hasher`, `storage`. |
| `apps/master-admin/` | React 18 + Vite + Tailwind. Platform owner panel. Talks to the real API. Port 5173. |
| `apps/store-admin/` | React 18 + Vite, plain CSS. **In-memory mock, not connected to the API.** Port 5174. |
| `apps/storefront/` | Next.js 14 App Router + Tailwind. Shared shop for all brands. |
| `infra/migrations/{platform,store}/` | SQL migrations. |
| `infra/nginx/`, `docker-compose*.yml` | Local reverse proxy and containers. |

## Non-negotiable rules

1. **Tenant isolation.** Platform DB holds only registry data (stores, domains, themes, platform users, audit). All products, customers, orders and inventory live in the store's own DB. Never join across databases. Tenant code gets its DB only from the request context (`storeCtx.FromContext(ctx)`), never from a global.
2. **One codebase for all stores.** Brand differences come from database configuration and theme values, never from `if slug == "..."` branches.
3. **Complete CRUD in both admin panels.** Anything that can be created must ship with an Edit modal and a Delete flow in the same change.
4. **Deletes need the branded modal.** Never delete on click, never use `window.confirm()` or `alert()`. Always use `ConfirmDeleteModal`, showing item name, entity type and consequence. See [.agents/rules/universal_crud_rule.md](.agents/rules/universal_crud_rule.md).
5. **No stubs and no silent fallbacks.** Write complete code. Do not add demo data that appears when an API call fails, and do not swallow errors with an empty `catch`. Show the error to the user. (Existing code breaks this rule in many places; do not copy those patterns, and remove them when you touch that code.)
6. **Check every Go error** and wrap it with context: `fmt.Errorf("doing x: %w", err)`.
7. **Idempotency** for payments, webhooks, inventory changes and provisioning steps.
8. **Secrets** (gateway keys, courier tokens, DB passwords) are stored encrypted with `pkg/crypto`; passwords are hashed with `pkg/hasher`. Never log them or return them from an API.
9. **Doc comments** on exported Go symbols and React components.

## Commands

Shell is Windows PowerShell; Git Bash is available for `.sh` scripts. Go, Node 24, npm, make, git and the Docker CLI are installed. There is no gcc, so `go test -race` does not work here.

```bash
# Backend (always from backend/)
cd backend
go build ./...
go vet ./...
gofmt -l .                      # must print nothing
go test ./...                   # unit tests, need no database or Redis
go run ./cmd/api                # API on :8080
go run ./cmd/worker             # background worker
go run cmd/migrate/main.go -direction=up -path=../infra/migrations/platform
go run cmd/seed/main.go         # creates themes, admins and stores mior, artisan, urban

# Frontends (from repo root; npm workspaces)
npm run dev --workspace=apps/master-admin      # http://localhost:5173
npm run dev --workspace=apps/store-admin       # http://localhost:5174
npm run dev --workspace=apps/storefront        # http://localhost:3000
npm run check:types --workspace=apps/master-admin   # same for store-admin, storefront

# Whole-repo check (Git Bash)
bash .agent/checks.sh
```

Before saying a change is done, run at least: `gofmt -l .`, `go vet ./...`, `go test ./...` for Go changes, and `check:types` for each app you touched. For UI changes, start the app and look at it in the browser.

### Things that will trip you up

- **`.agent/checks.sh` scans every text file for four banned stub words** (listed in the `PROHIBITED_PATTERNS` array of that script) and fails if it finds one, including in Markdown files such as this one. Do not write those words in code, comments or docs. The HTML input attribute of the same name is allowed only in the forms `attr=`, `attr-` and `::attr`.
- **The backend does not read `.env`.** `internal/config/config.go` reads process environment variables only and falls back to built-in defaults that match `.env.example`. Editing `.env` changes nothing unless the variables are exported into the shell first.
- **`backend/*.exe` are prebuilt and often stale.** `run-dev.ps1` launches `api.exe` and `worker.exe` without rebuilding. After any Go change either use `go run`, or rebuild: `go build -o api.exe ./cmd/api` and `go build -o worker.exe ./cmd/worker`.
- **Two local setups that cannot run together** (both use ports 5432 and 6379): Docker Compose (`make up`, needs Docker Desktop running) or `run-dev.ps1` (native Postgres and Redis from `C:\ZKBioTime\`, storefront on port **3002** instead of 3000).
- **Port 80 on this machine is taken by Apache**, so the Nginx container cannot bind it without stopping Apache first.
- **`npm run lint` does not work** in any app: eslint is not installed. Use `check:types`.
- **Store selection in development** is by hostname: `http://mior.localhost:3000`, `http://artisan.localhost:3000`, `http://urban.localhost:3000`. Plain `localhost` resolves to `mior`.
- **Never run `make clean`** without asking: it deletes the database volumes.

## How to add things

### A new backend module (tenant-scoped)

1. Create `backend/internal/store/<name>/` with `dto.go`, `repository.go`, `service.go`, `handler.go`, `<name>_test.go`.
2. Repository: an interface plus a stateless `SQLRepository{}`. It holds no DB handle. Every method takes `db *sql.DB` or `tx *sql.Tx` (suffix `Tx`).
3. Service: get the tenant DB with `storeCtx.FromContext(ctx)`. The service owns transactions (`BeginTx`, `defer tx.Rollback()`, `Commit`). Use `SELECT ... FOR UPDATE` for stock and coupon counters.
4. Handler: `chi.URLParam`, `json.NewDecoder`, reply through `pkg/response` (`response.JSON`, `response.BadRequest`, `response.NotFound`, `response.ValidationProblem`, `response.InternalServerError`). Map sentinel errors with `errors.Is`.
5. Wire it in `backend/cmd/api/main.go`: construct repo, service, handler in `main()`; add a parameter to `buildRouter`; mount the routes inside the correct group guarded by `if h != nil`.
6. Add one more `nil` argument to **every** `buildRouter(...)` call in `backend/cmd/api/main_test.go` (25 calls, positional), or the tests will not compile.

### A database change

- Platform DB: add `NNNNNN_name.up.sql` and `.down.sql` in `infra/migrations/platform/`, then run the migrate command above.
- Store DB: add the pair in `infra/migrations/store/`. **This only affects stores created afterwards.** There is no migration runner for existing tenant databases. To reach existing stores, also add idempotent DDL (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`) in the module's `EnsureSchema(ctx, db)` and call it from the service, as `payments`, `logistics`, `marketing` and `promotions` do. Keep the two definitions identical.
- Conventions: UUID primary keys with `gen_random_uuid()`, `created_at` / `updated_at TIMESTAMP WITH TIME ZONE` plus the update trigger, `NUMERIC(12,2)` for money, Postgres enums in UPPERCASE, hard deletes (no `deleted_at`).

### A master-admin page

There is no router library. Add the page in `apps/master-admin/src/pages/`, then edit `src/App.tsx` in three places (lazy import, the render line, the not-found exclusion list) and add the item to `navItems` in `src/components/layout/Sidebar.tsx`. Copy the structure of `pages/AdminsPage.tsx` with `components/admins/EditAdminModal.tsx`, but surface API errors instead of swallowing them. Use the `api` axios instance from `src/lib/api.ts` with paths starting `/platform/...`. Styling is dense Tailwind (`text-xs`, `slate-*`, `teal-600`); icons come from `lucide-react`.

### A store-admin view

Views are tabs selected by `activeTab` in `src/App.tsx`, typed by `StoreTab` in `src/types/store.ts`. Styling is hand-written classes in `src/index.css` (`.card`, `.btn-primary`, `.data-table`, `.modal-overlay`); **Tailwind classes do nothing in this app.** Best existing template: `components/PromotionsView.tsx` with `EditCouponModal.tsx`. Data currently comes from `src/data/initialData.ts`; connecting this app to the backend is the largest open piece of work (see the status doc).

### A storefront page

Pages in `apps/storefront/src/app/` are async server components. Read the store host with `headers().get('x-storefront-host')` and pass it to the fetch helpers in `src/lib/*-api.ts`, which forward it to the backend. Use theme tokens (`bg-brand-primary`, `rounded-brand`, CSS variables `--brand-*`), never hard-coded brand colours. Browser-side fetches must also identify the store; several existing ones do not.

## Working agreement

- Commit only when asked. Never commit `.env`, binaries, `dump.rdb` or `backend/uploads/`.
- Keep changes scoped to the request. Flag unrelated defects you notice instead of fixing them silently.
- When a change makes a line in `docs/PROJECT_STATUS.md` or `docs/ARCHITECTURE.md` untrue, update that line in the same change.
- Report results honestly: if a check was not run or failed, say so.
