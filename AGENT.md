# ECOM VENTURES: AGENT GOVERNANCE ENGINE & ARCHITECTURE LEDGER

## 1. ARCHITECTURAL INGESTION & BOUNDARY RULES
The AI agent must uphold these non-negotiable architectural mandates:
- Central vs. Store DB Boundary: Platform configuration, store registries, and domain bindings live in the Platform DB. All tenant operational data (products, customers, orders, inventory) live in dedicated Store DBs.
- Zero Cross-Store Data Leakage: No SQL query or API handler in the store application domain may execute cross-database joins or access data without an authenticated, verified store_id context.
- Shared Codebase Execution: All stores share the identical Go backend API and Next.js storefront code; brand variations are driven entirely by dynamic database configuration and theme parameters.
- Stateless Domain Resolution: Domain-to-store mapping must resolve dynamically via HTTP host headers or route prefixes backed by Redis caching.
- Universal CRUD & Delete Approval Mandate (NON-NEGOTIABLE): Every entity, resource, or module that can be created/added in either the Master Admin Panel or Store Admin Panel MUST have a complete Edit system and Delete system. Under NO circumstances may any delete action execute directly, silently, or through native unbranded browser `window.confirm()`. Every deletion MUST trigger a branded approval confirmation popup modal (`ConfirmDeleteModal`) detailing the item name, type, and consequences, requiring deliberate user confirmation before executing.

## 2. ENGINEERING EXECUTION STANDARDS
- No Mock or Stub Code: Write complete functions. Do not use dummy returns, unfinished branches, or to-do comment tags.
- Mandatory Edit & Delete Modals on All New Modules/Features: Whenever building any new feature, panel, table, or submodule in Master Admin or Store Admin that permits adding or creating an item, the agent MUST simultaneously deliver the corresponding Edit Modal and Delete Approval Confirmation Modal.
- Defensive Error Handling: Every Go call returning an error must be checked and returned up the stack with contextual information.
- Documentation: Every exported function, struct, interface, and React component requires a docstring defining inputs, outputs, side effects, and tenant isolation behavior.
- Idempotency: Payment endpoints, inventory adjustments, and store provisioning steps must be safe for repeated execution.

## 3. TECH STACK LEDGER
| Layer | Technology | Primary Package / Version |
| :--- | :--- | :--- |
| Backend Monolith | Go | Go 1.22+ |
| Database Driver | PostgreSQL Driver | github.com/lib/pq v1.10.9 |
| HTTP Router | Chi Router & CORS | github.com/go-chi/chi/v5 v5.0.12, github.com/go-chi/cors v1.2.1 |
| Primary Databases | PostgreSQL | Version 16 (Central Platform + Store DBs) |
| Caching & Queues | Redis | Redis 7 Alpine (Driver: github.com/redis/go-redis/v9 v9.5.1) |
| Authentication & RBAC | JWT & Argon2id | github.com/golang-jwt/jwt/v5 v5.2.1, golang.org/x/crypto/argon2 |
| Shared Storefront | Next.js | Next.js 14+ (React, TypeScript) |
| Admin Portals | React + Vite | React 18, TypeScript, Tailwind CSS, Lucide React, Axios |
| UI State & Styling | Tailwind & Utilities | tailwindcss ^3.4.3, clsx ^2.1.1, tailwind-merge ^2.3.0 |
| Reverse Proxy | Nginx | Alpine 1.25 |
| Container Orchestration | Docker Compose | Compose Specification v3.8+ |
| Local Mail Server | MailHog | mailhog/mailhog:latest |


## 4. FEATURE & MODULE REGISTRY (FINAL - 30 PHASES COMPLETE)
| Module ID | Subsystem | File Paths | Scope & Description | Tenant Isolation Verified |
| :--- | :--- | :--- | :--- | :--- |
| `MOD-001` | Governance | `/AGENT.md`, `/.agent/checks.sh` | Core agent rules and pre-commit checks | N/A |
| `MOD-002` | Infra | `/docker-compose.yml`, `/infra/` | Local multi-database & cache containerization | Yes (Isolated DB ports) |
| `MOD-003` | Backend Kernel | `/backend/cmd/api/main.go` | Entrypoint, graceful shutdown, health probes | Yes (Platform level) |
| `MOD-004` | Frontends | `/apps/*` | Workspace scaffolds for all three client apps | Yes (App boundary) |
| `MOD-005` | Reverse Proxy | `/infra/nginx/nginx.conf`, `/infra/nginx/conf.d/local-routing.conf` | Multi-tenant host header preservation and routing | Yes (Host preserved without leakage) |
| `MOD-006` | Config Engine | `/backend/internal/config/config.go` | Centralized typed environment loader | Yes (Explicit platform vs store DSNs) |
| `MOD-007` | Automation | `/Makefile`, `/.env.example` | CLI workflows and environment variables schema | N/A |
| `MOD-008` | Platform Schema | `/infra/migrations/platform/*.sql` | Central DB DDL: stores, domains, themes, users, audits | Yes (Metadata only; zero tenant data) |
| `MOD-009` | DB Pool | `/backend/internal/platform/database/postgres.go` | PostgreSQL connection pool and health checks | Yes (Dedicated platform pool) |
| `MOD-010` | Migrator & CLI | `/backend/internal/platform/migrator/`, `/backend/cmd/migrate/` | Transactional migration runner and CLI | Yes (Platform DB target) |
| `MOD-011` | Cryptography | `/backend/pkg/crypto/crypto.go` | AES-256-GCM authenticated credential encryption | Yes (DB passwords encrypted at rest) |
| `MOD-012` | Store Schema | `/infra/migrations/store/*.sql` | Dedicated store DDL: catalog, orders, staff, settings | Yes (Isolated tenant operational DB) |
| `MOD-013` | Tenant Pool | `/backend/internal/store/database/tenant_pool.go` | Dynamic thread-safe multi-tenant connection pool manager | Yes (Zero cross-tenant handle sharing) |
| `MOD-014` | Store Provisioner | `/backend/internal/platform/provisioner/provisioner.go` | Automated tenant DB creation, migration, rollback | Yes (Compensating rollback drops orphaned DBs) |
| `MOD-015` | RFC 7807 Responder | `/backend/pkg/response/response.go` | Standardized JSON success envelope & RFC 7807 problem details | Yes (Sanitizes internal server details) |
| `MOD-016` | Contextual Logger | `/backend/internal/middleware/logger.go` | Slog structured JSON logger with trace and latency metrics | Yes (Log boundaries tagged with trace IDs) |
| `MOD-017` | Multi-Tenant CORS | `/backend/internal/middleware/cors.go` | Strict multi-domain CORS origin validation | Yes (Only authorized tenant storefronts/admins) |
| `MOD-018` | Panic Recovery | `/backend/internal/middleware/recovery.go` | Safe crash recovery writing RFC 7807 500 error envelopes | Yes (Suppresses raw internal stack leaks) |
| `MOD-019` | Chi Modular Monolith | `/backend/cmd/api/main.go` | Assembled HTTP router, graceful shutdown, pool lifecycle | Yes (Single backend, isolated tenant contexts) |
| `MOD-020` | Store Context | `/backend/internal/store/context/context.go` | Immutable request context model carrying Store & TenantDB | Yes (Thread-safe context boundary) |
| `MOD-021` | Redis Resolver | `/backend/internal/store/resolver/resolver.go` | Redis read-through cache for domain & slug resolution | Yes (Validates store status, drops suspended) |
| `MOD-022` | Tenant Middleware | `/backend/internal/middleware/tenant.go` | Host header & path prefix resolvers with strict 404/403 guards | Yes (Blocks execution without valid context) |
| `MOD-023` | Multi-Tenant Routes | `/backend/cmd/api/main.go` | Mounted `/platform`, `/store/{store_slug}`, `/storefront` routes | Yes (Decoupled modular monolith routes) |
| `MOD-024` | Argon2id Hasher | `/backend/pkg/hasher/argon2id.go` | Constant-time Argon2id password hashing engine | Yes (Per-user random salt) |
| `MOD-025` | JWT Claims Engine | `/backend/pkg/auth/jwt.go` | HMAC-SHA256 dual-tier JWT generator and validator | Yes (Strict tenant_id embedding) |
| `MOD-026` | Redis Session Store | `/backend/internal/platform/auth/session.go` | Redis-backed refresh session storage & revocation | Yes (Immediate multi-device logout) |
| `MOD-027` | Platform Auth | `/backend/internal/platform/auth/` | Central admin login, refresh, logout services | Yes (Platform DB user registry) |
| `MOD-028` | Store Staff Auth | `/backend/internal/store/auth/` | Store staff login service executing on tenant DB | Yes (Isolated tenant DB execution) |
| `MOD-029` | Dual-Tier RBAC | `/backend/internal/middleware/auth.go` | Platform RBAC & store-scoped token matching middleware | Yes (Asserts token.store_id == context.store.id) |
| `MOD-030` | Store Creator | `/backend/internal/platform/store_mgmt/service.go` | Automated 10-step provisioning pipeline with rollback | Yes (Creates isolated DB, zero cross-pollution) |
| `MOD-031` | Portfolio Service | `/backend/internal/platform/store_mgmt/service.go` | Store listing, status updates, detail retrieval, logs | Yes (Platform DB metadata management) |
| `MOD-032` | Store Mgmt Handler | `/backend/internal/platform/store_mgmt/handler.go` | REST controllers for `/api/v1/platform/stores` | Yes (Guarded by Platform RBAC) |
| `MOD-033` | Master Store Routes | `/backend/cmd/api/main.go` | Wired endpoints for store provisioning & lifecycle | Yes (Platform Super Admin & Staff only) |
| `MOD-034` | Master Admin Vite | `/apps/master-admin/vite.config.ts` | React 18 + Vite + Tailwind setup for `master.dropiobd.localhost` | Yes (Platform boundary) |
| `MOD-035` | Axios API Client | `/apps/master-admin/src/lib/api.ts` | Interceptor-driven Axios client with silent token rotation | Yes (Scoped to `/api/v1/platform`) |
| `MOD-036` | Platform Auth State | `/apps/master-admin/src/context/AuthContext.tsx` | Reactive session management & ProtectedRoute RBAC guards | Yes (Blocks unauthorized roles) |
| `MOD-037` | App Shell | `/apps/master-admin/src/components/layout/` | Sidebar, Header, and layout shell for Master Admin | Yes (Platform-level UI) |
| `MOD-038` | Portfolio Dashboard | `/apps/master-admin/src/pages/DashboardPage.tsx` | Metrics overview, active brand count, recent stores table | Yes (Pulls from platform store registry) |
| `MOD-039` | Store Creator Wizard | `/apps/master-admin/src/components/stores/StoreCreatorWizard.tsx` | 4-step interactive guided brand launcher | Yes (Passes verified params to Platform API) |
| `MOD-040` | Provisioning Tracker | `/apps/master-admin/src/components/stores/ProvisioningTracker.tsx` | Real-time poller tracking 10-step pipeline progress | Yes (Tracks per-store provisioning logs) |
| `MOD-041` | Store Portfolio Table | `/apps/master-admin/src/components/stores/StoreTable.tsx` | Search, filter, pagination data grid for portfolio brands | Yes (Platform registry visualization) |
| `MOD-042` | Store Inspection Drawer | `/apps/master-admin/src/components/stores/StoreDetailDrawer.tsx` | Slide-over inspector for isolated DB, domains, and status | Yes (Direct operational controls) |
| `MOD-043` | DNS TXT Verifier | `/backend/internal/platform/domains/dns_verifier.go` | Automated DNS TXT lookup and random challenge tokens | Yes (Asserts domain ownership before routing) |
| `MOD-044` | Cloudflare Client | `/backend/internal/platform/domains/cloudflare_client.go` | Edge custom hostname & SSL certificate provisioning | Yes (Edge routing automation) |
| `MOD-045` | Domain Mgmt Service | `/backend/internal/platform/domains/service.go` | Domain CRUD, primary switching, Redis cache purge | Yes (Guarantees zero cross-brand domain collisions) |
| `MOD-046` | Domain UI & Modals | `/apps/master-admin/src/pages/DomainsPage.tsx` | Domain registry grid, DNS instruction modal, attachment modal | Yes (Master Admin control center) |
| `MOD-047` | Theme Validator | `/backend/internal/platform/themes/validator.go` | Color hex and typography schema validation rules | Yes (Protects storefront theme payloads) |
| `MOD-048` | Theme Service & Cache | `/backend/internal/platform/themes/service.go` | Theme registry CRUD, store hot-swapping & Redis cache | Yes (Theme overrides strictly isolated per store) |
| `MOD-049` | Theme Handlers | `/backend/internal/platform/themes/handler.go` | REST endpoints for theme catalog and dynamic storefront delivery | Yes (Tenant context validated on delivery) |
| `MOD-050` | Theme Gallery UI | `/apps/master-admin/src/pages/ThemesPage.tsx` | Visual theme marketplace with card previews and registration | Yes (Master Admin presentation management) |
| `MOD-051` | Assign Theme Modal | `/apps/master-admin/src/components/themes/AssignThemeModal.tsx` | Store theme assignment modal with hex color customizer | Yes (Hot-swaps theme without redeployment) |
| `MOD-052` | Store Extended Migrations | `/infra/migrations/store/000002_*.sql` | SQL DDL: attributes, variants, media, stock movements, carts, orders | Yes (Dedicated tenant DB boundary) |
| `MOD-053` | Store Catalog Models | `/backend/internal/store/models/catalog.go` | Products, variants, attributes, images Go models | Yes (Isolated tenant data model) |
| `MOD-054` | Store Inventory Models | `/backend/internal/store/models/inventory.go` | Double-entry stock movements and variant stock ledger | Yes (Atomic per-store quantity tracking) |
| `MOD-055` | Store Cart & Customer Models | `/backend/internal/store/models/cart.go`, `customer.go` | Shopping cart sessions, items, customer address books | Yes (Customer data isolated per brand) |
| `MOD-056` | Store Order Models | `/backend/internal/store/models/order.go` | Orders, shipments, transactions, and status history models | Yes (Tenant transaction isolation) |
| `MOD-057` | Object Storage Engine | `/backend/pkg/storage/` | Abstracted disk/S3 object storage driver with MIME & size checks | Yes (Files partitioned by `/stores/{slug}/...`) |
| `MOD-058` | Category Taxonomy Engine | `/backend/internal/store/catalog/` | Hierarchical parent-child category tree & store-scoped slugs | Yes (Executes only on tenant DB) |
| `MOD-059` | Product Catalog Engine | `/backend/internal/store/catalog/` | Product CRUD, multi-criteria filtering, pricing validation | Yes (Executes only on tenant DB) |
| `MOD-060` | Product Media Gallery | `/backend/internal/store/catalog/` | Multipart file upload, primary image selection, asset deletion | Yes (Scoped to tenant's product assets) |
| `MOD-061` | Store Catalog Handlers | `/backend/internal/store/catalog/handler.go` | REST controllers for category, product, and media operations | Yes (Guarded by Store Staff RBAC) |
| `MOD-062` | Store Attribute Engine | `/backend/internal/store/catalog/variants_repository.go` | Store attributes, display types, values, hex swatches | Yes (Executes only on tenant DB) |
| `MOD-063` | Cartesian Matrix Gen | `/backend/internal/store/catalog/matrix_generator.go` | Combinatorial variant matrix calculation & SKU builder | Yes (Deterministic algorithmic calculation) |
| `MOD-064` | Variant & SKU Repo | `/backend/internal/store/catalog/variants_repository.go` | SQL CRUD for `product_variants`, bridge bindings, batch updates | Yes (Strict tenant database boundary) |
| `MOD-065` | Variant Service | `/backend/internal/store/catalog/variants_service.go` | Atomic variant creation, attribute mapping, and inventory initialization | Yes (Coordinates atomic transactions in tenant DB) |
| `MOD-066` | Variant REST Handlers | `/backend/internal/store/catalog/variants_handler.go` | REST controllers for attribute values, matrix generator, and SKUs | Yes (Guarded by Store Staff RBAC) |
| `MOD-067` | Store Inventory Engine | `/backend/internal/store/inventory/repository.go` | Row-level locking `FOR UPDATE`, physical quantity assertions | Yes (Tenant DB boundary) |
| `MOD-068` | Stock Movement Ledger | `/backend/internal/store/inventory/repository.go` | Append-only double-entry audit trail with reason codes | Yes (Audits isolated per store) |
| `MOD-069` | Reservation Locker | `/backend/internal/store/inventory/service.go` | Two-phase reservation, fulfillment, and release lifecycle | Yes (Prevents overselling per tenant) |
| `MOD-070` | Inventory Handlers | `/backend/internal/store/inventory/handler.go` | REST endpoints for adjustments, batch counts, and low-stock alerts | Yes (Guarded by Store Staff RBAC) |
| `MOD-071` | Order State Machine | `/backend/internal/store/orders/state_machine.go` | Directed state transitions & terminal validation | Yes (Stateless rule engine) |
| `MOD-072` | Order Repository | `/backend/internal/store/orders/repository.go` | SQL CRUD for orders, shipments, payment logs, history | Yes (Executes only on tenant DB) |
| `MOD-073` | Order Service | `/backend/internal/store/orders/service.go` | Order lifecycle, atomic inventory fulfillment/release | Yes (Guarantees atomic per-store transactions) |
| `MOD-074` | Order Handlers | `/backend/internal/store/orders/handler.go` | REST controllers for orders, shipments, payments | Yes (Guarded by Store Staff RBAC) |
| `MOD-075` | Customer Repo | `/backend/internal/store/customers/repository.go` | SQL queries for customer profiles, addresses, LTV joins | Yes (Strict tenant database boundary) |
| `MOD-076` | Customer Metrics Engine | `/backend/internal/store/customers/repository.go` | Dynamic calculation of Total Orders, LTV, AOV, Last Order | Yes (Isolated per-brand order data) |
| `MOD-077` | Customer Service | `/backend/internal/store/customers/service.go` | Profile lifecycle, address default promotions, password hashing | Yes (Executes only within StoreContext) |
| `MOD-078` | Customer REST Handlers | `/backend/internal/store/customers/handler.go` | Admin REST controllers for directory and address books | Yes (Guarded by Store Staff RBAC) |
| `MOD-079` | Promotion Repository | `/backend/internal/store/promotions/repository.go` | SQL CRUD for coupons, usages, and pessimistic `FOR UPDATE` locks | Yes (Executes only on tenant DB) |
| `MOD-080` | Cart Discount Evaluator | `/backend/internal/store/promotions/evaluator.go` | Deterministic percentage, fixed amount, and free shipping discount math | Yes (Stateless calculation engine) |
| `MOD-081` | Promotion Service | `/backend/internal/store/promotions/service.go` | Coupon validation, usage accounting, and atomic order redemption | Yes (Atomic per-tenant transactions) |
| `MOD-082` | Promotion REST Handlers | `/backend/internal/store/promotions/handler.go` | REST controllers for coupons, updates, and live cart validation | Yes (Guarded by Store Staff RBAC) |
| `MOD-083` | Store Settings Engine | `/backend/internal/store/settings/repository.go` | Currency, taxes, order prefixes, social link preferences | Yes (Strict tenant database boundary) |
| `MOD-084` | Store Staff Directory | `/backend/internal/store/settings/service.go` | Argon2id staff hashing, owner-only RBAC, last owner protection | Yes (Staff isolated per tenant DB) |
| `MOD-085` | Settings & Staff Handlers| `/backend/internal/store/settings/handler.go` | REST endpoints for store settings and staff administration | Yes (STORE_OWNER guarded) |
| `MOD-086` | Storefront Host Middleware | `/apps/storefront/src/middleware.ts` | Edge host extraction & `x-storefront-host` forwarding | Yes (Dynamic domain resolution per brand) |
| `MOD-087` | Storefront API Client | `/apps/storefront/src/lib/api.ts` | Server-side fetch client with tag caching & host forwarding | Yes (Scoped to `/api/v1/storefront/*`) |
| `MOD-088` | Dynamic Theme Injector | `/apps/storefront/src/components/layout/ThemeInjector.tsx` | Injects runtime CSS variables & font pairings per store | Yes (Presentation isolated per store) |
| `MOD-089` | Storefront Shell Layout | `/apps/storefront/src/app/layout.tsx` | Universal App Router layout with SEO metadata & navbar/footer | Yes (Dynamic brand hydration) |
| `MOD-090` | Storefront Homepage | `/apps/storefront/src/app/page.tsx` | Dynamic hero presentation rendered per active theme blueprint | Yes (Renders active store catalog context) |
| `MOD-091` | Storefront Catalog API | `/backend/internal/storefront/catalog/handler.go` | Public REST endpoints for active categories and products | Yes (Tenant-bound resolution via host header) |
| `MOD-092` | Product Discovery Engine | `/backend/internal/storefront/catalog/repository.go` | Recursive category trees, search, price ranges, stock flags | Yes (Queries only resolved TenantDB) |
| `MOD-093` | Storefront Product Card | `/apps/storefront/src/components/catalog/ProductCard.tsx` | Responsive card with discount badge, stock status, theme styles | Yes (Presentation tokens scoped to store) |
| `MOD-094` | Faceted Filter Sidebar | `/apps/storefront/src/components/catalog/CatalogFilters.tsx` | Category hierarchy, price range, and stock toggle filters | Yes (Shallow router URL parameter synchronization) |
| `MOD-095` | Storefront Catalog Page | `/apps/storefront/src/app/catalog/page.tsx` | RSC catalog view with parallel data fetching & toolbar | Yes (Server-side rendered per store context) |
| `MOD-096` | Storefront PDP API | `/backend/internal/storefront/catalog/repository.go` | Detailed product payload with live variant inventory and attributes | Yes (Executes only on resolved TenantDB) |
| `MOD-097` | Storefront Cart Engine | `/backend/internal/storefront/cart/repository.go` | Session-based cart persistence with live inventory checks | Yes (Cart isolated per store tenant) |
| `MOD-098` | Swatch Selector Component | `/apps/storefront/src/components/product/ProductDetailView.tsx` | Dynamic variant matrix selector with live image syncing | Yes (Presentation tokens scoped to store) |
| `MOD-099` | Storefront Cart Context | `/apps/storefront/src/context/CartContext.tsx` | React Context managing optimistic cart mutations and drawer state | Yes (Scoped to tenant cart session) |
| `MOD-100` | Slide-Over Cart Drawer | `/apps/storefront/src/components/cart/CartDrawer.tsx` | Drawer displaying line items, quantity adjusters, and subtotal | Yes (Inherits brand theme tokens) |
| `MOD-101` | Checkout Placement Engine | `/backend/internal/storefront/checkout/repository.go` | Atomic stock reservation, coupon redemption, and cart clearance | Yes (Transactional commit in tenant DB) |
| `MOD-102` | Checkout Form & Client View | `/apps/storefront/src/components/checkout/CheckoutForm.tsx` | Single-page responsive form with contact and delivery inputs | Yes (Submits to tenant-scoped API) |
| `MOD-103` | Checkout Order Summary | `/apps/storefront/src/components/checkout/CheckoutSummary.tsx` | Summary sidebar with real-time promo code validation | Yes (Evaluates against tenant coupons) |
| `MOD-104` | Order Receipt Screen | `/apps/storefront/src/app/order-confirmed/[orderNumber]/page.tsx` | Digital confirmation screen with line items and reference | Yes (Order lookup guarded per tenant) |
| `MOD-105` | Payment Driver Interface | `/backend/internal/store/payments/gateway.go` | Pluggable gateway abstraction (`InitiatePayment`, `VerifyPayment`, `HandleWebhook`) | Yes (Stateless driver design) |
| `MOD-106` | bKash Tokenized Driver | `/backend/internal/store/payments/driver_bkash.go` | bKash tokenized checkout v1.2.0-M integration | Yes (Merchant keys isolated per store) |
| `MOD-107` | SSLCommerz Hosted Driver | `/backend/internal/store/payments/driver_sslcommerz.go` | SSLCommerz v4 session init and IPN validation | Yes (Store ID/passwords encrypted at rest) |
| `MOD-108` | Stripe Checkout Driver | `/backend/internal/store/payments/driver_stripe.go` | Stripe Checkout sessions & HMAC webhook verification | Yes (API secret keys isolated per tenant) |
| `MOD-109` | Payment Idempotency Repo | `/backend/internal/store/payments/repository.go` | Idempotent transaction locking & credentials storage | Yes (Executes only on tenant DB) |
| `MOD-110` | Payment Service | `/backend/internal/store/payments/service.go` | Gateway orchestration, AES key encryption, atomic order settlement | Yes (Prevents cross-store payment leaks) |
| `MOD-111` | Payment REST Handlers | `/backend/internal/store/payments/handler.go` | Storefront initiation, callbacks, webhooks, and admin configs | Yes (Storefront & Store Owner guarded) |
| `MOD-112` | Courier Driver Interface | `/backend/internal/store/logistics/courier.go` | Pluggable shipping carrier abstraction (`CreateConsignment`, `TrackConsignment`) | Yes (Stateless driver design) |
| `MOD-113` | Steadfast Courier Driver | `/backend/internal/store/logistics/driver_steadfast.go` | Steadfast order booking (`/create_order`) and status tracking | Yes (Merchant keys isolated per store) |
| `MOD-114` | Pathao Courier Driver | `/backend/internal/store/logistics/driver_pathao.go` | Pathao merchant OAuth and order booking (`/aladdin/api/v1/orders`) | Yes (Store IDs/credentials encrypted at rest) |
| `MOD-115` | RedX Courier Driver | `/backend/internal/store/logistics/driver_redx.go` | RedX parcel registration and tracking synchronization | Yes (API tokens isolated per tenant) |
| `MOD-116` | Logistics Repository | `/backend/internal/store/logistics/repository.go` | SQL CRUD for courier configs and shipment milestones | Yes (Executes only on tenant DB) |
| `MOD-117` | Logistics Service | `/backend/internal/store/logistics/service.go` | Consignment dispatch, shipment recording, state machine linkage | Yes (Prevents cross-store shipment leaks) |
| `MOD-118` | Logistics REST Handlers | `/backend/internal/store/logistics/handler.go` | Dispatch endpoints, tracking timelines, and carrier webhooks | Yes (Store Staff & Storefront guarded) |
| `MOD-119` | Marketing Repository | `/backend/internal/store/marketing/repository.go` | SQL CRUD for store tracking credentials | Yes (Isolated per tenant DB) |
| `MOD-120` | Meta CAPI Dispatcher | `/backend/internal/store/marketing/capi.go` | Server-side conversion engine with SHA-256 PII hashing | Yes (Meta Graph API client) |
| `MOD-121` | Marketing Service | `/backend/internal/store/marketing/service.go` | Credential encryption, public config delivery, async CAPI trigger | Yes (Strict tenant boundary) |
| `MOD-122` | Marketing REST Handlers | `/backend/internal/store/marketing/handler.go` | Storefront public telemetry and Store Admin credentials API | Yes (Guarded by Store Admin RBAC) |
| `MOD-123` | Storefront Analytics Script | `/apps/storefront/src/components/analytics/AnalyticsScripts.tsx` | Next.js dynamic script injector for GTM, GA4, Meta Pixel | Yes (Renders only active store tags) |
| `MOD-124` | Client Telemetry Dispatcher | `/apps/storefront/src/lib/analytics.ts` | Multi-provider event broadcaster with CAPI deduplication IDs | Yes (Stateless client event helper) |
| `MOD-125` | Redis Streams Producer | `/backend/internal/worker/queue.go` | Durable task enqueuing and Dead-Letter Queue (DLQ) | Yes (Payloads carry tenant boundary metadata) |
| `MOD-126` | Worker Consumer Engine | `/backend/internal/worker/consumer.go` | Redis Streams consumer groups, concurrency, backoff retries | Yes (Stateless worker execution engine) |
| `MOD-127` | Notification Handlers | `/backend/internal/worker/handlers_notifications.go` | Asynchronous emails and Meta CAPI retry consumers | Yes (Zero HTTP request blocking) |
| `MOD-128` | Maintenance Handlers | `/backend/internal/worker/handlers_maintenance.go` | Abandoned cart cleanup, low stock audits, encrypted backups | Yes (Dynamically binds to TenantPoolManager) |
| `MOD-129` | Cron Scheduler | `/backend/internal/worker/scheduler.go` | Distributed recurring task scheduler with Redis mutex locks | Yes (Cluster-wide single execution guarantees) |
| `MOD-130` | Worker Daemon Entrypoint| `/backend/cmd/worker/main.go` | Standalone background worker process lifecycle | Yes (Independent deployable binary) |
| `MOD-131` | Redis Rate Limiter | `/backend/internal/middleware/ratelimit.go` | Distributed sliding-window limiter partitioned by host & IP | Yes (Prevents cross-tenant quota collisions) |
| `MOD-132` | Security Audit Engine | `/backend/internal/security/audit_runner.go` | Scans Platform DB purity, credential encryption, SSL coverage | Yes (Enforces zero operational data in Platform DB) |
| `MOD-133` | Cross-Tenant Pen Suite | `/backend/internal/security/penetration_test.go` | Simulates cross-tenant JWT tampering, Host header attacks | Yes (Asserts 403 Forbidden on boundary violations) |
| `MOD-134` | Benchmark Harness | `/backend/internal/security/benchmark_test.go` | Performance profiling tests for math and slug throughput | Yes (Stateless microbenchmarks) |
| `MOD-135` | Security Audit Handler | `/backend/internal/security/handler.go` | Master Admin REST endpoint for compliance audit reports | Yes (Guarded by SUPER_ADMIN RBAC) |
| `MOD-136` | Production Docker Packaging | `/backend/Dockerfile`, `/apps/*/Dockerfile` | Multi-stage scratch/alpine containers and unprivileged runners | Yes (Hardened container boundaries) |
| `MOD-137` | CI/CD Deployment Pipeline | `/.github/workflows/ci-cd.yml` | Automated checks, unit tests, type analysis, and image builds | Yes (Validates multi-tenant boundaries) |
| `MOD-138` | Pilot Brand Seeder | `/backend/cmd/seed/main.go` | Provisions Mior, Artisan, and Urban Movement pilot brands | Yes (Uses 10-step transactional provisioner) |
| `MOD-139` | Platform Go-Live Engine | `/GOLIVE.md` | Pre-flight infrastructure validation runbook and smoke tests | Yes (Exhaustive production readiness) |
| `MOD-140` | Cloudflare R2 Engine | `/backend/pkg/storage/r2.go`, `/apps/master-admin/src/components/storage/` | S3 SigV4 client, thread-safe dynamic storage provider, Master Admin R2 credentials manager, live ping & upload sandbox, folder partitioning | Yes (Partitioned: platform/ vs stores/{slug}/{module}) |

## 5. AUTOMATED VERIFICATION LEDGER (FINAL)
| Date / Check Run | Target Subsystem | Command Executed | Result | Remarks |
| :--- | :--- | :--- | :--- | :--- |
| Phase 1 Run | Monorepo Base | `bash .agent/checks.sh` | Passed | Baseline repository initialization |
| Phase 2 Run | Nginx & Config | `go test -race ./internal/config/... && docker compose config` | Passed | Verified config loader and Nginx orchestration |
| Phase 3 Run | Platform DB & Migration | `make migrate-platform-up && go test -race -v ./internal/platform/...` | Passed | Central DB schema verified |
| Phase 4 Run | Provisioner & Tenant Pool | `go test -race -v ./pkg/crypto/... ./internal/store/... ./internal/platform/provisioner/...` | Passed | AES-256-GCM encryption & tenant pool verified |
| Phase 5 Run | Monolith HTTP Kernel | `go test -race -v ./pkg/response/... ./internal/middleware/... ./cmd/api/...` | Passed | Chi router, slog JSON logger, and recovery verified |
| Phase 6 Run | Tenant Resolution & Cache | `go test -race -v ./internal/store/context/... ./internal/store/resolver/... ./internal/middleware/...` | Passed | Verified context injection & host resolution |
| Phase 7 Run | Auth & Dual-Tier RBAC | `go test -race -v ./pkg/hasher/... ./pkg/auth/... ./internal/middleware/auth_test.go` | Passed | Verified Argon2id, JWT issuance, and zero cross-tenant token leakage |
| Phase 8 Run | Store Creator & Pipeline | `go test -race -v ./internal/platform/store_mgmt/...` | Passed | Slug regex, status state machine, and DTO validation verified |
| Phase 9 Run | Master Admin Base | `npm run --prefix apps/master-admin build` | Passed | TypeScript compiled, Tailwind generated cleanly |
| Phase 10 Run | Store Creator & Portfolio UI | `npm run --prefix apps/master-admin check:types && npm run --prefix apps/master-admin build` | Passed | Store wizard, provisioning tracker, and detail drawer built cleanly |
| Phase 11 Run | Custom Domain Management | `go test -race -v ./internal/platform/domains/... && npm run --prefix apps/master-admin build` | Passed | DNS verifier, Cloudflare edge client, and domain UI built cleanly |
| Phase 12 Run | Theme Engine & Marketplace | `go test -race -v ./internal/platform/themes/... && npm run --prefix apps/master-admin build` | Passed | Theme validator, assignment engine, and gallery marketplace built cleanly |
| Phase 13 Run | Extended Store Schema | `go test -race -v ./internal/store/models/...` | Passed | Verified catalog, variant, cart, inventory, and order models |
| Phase 14 Run | Store Catalog & Storage API | `go test -race -v ./pkg/storage/... ./internal/store/catalog/...` | Passed | Storage MIME validation, category tree recursion, and slug generation verified |
| Phase 15 Run | Variants & Matrix Engine | `go test -race -v ./internal/store/catalog/variants_test.go` | Passed | Cartesian combinatorial generation, SKU formulation, and attributes verified |
| Phase 16 Run | Real-Time Inventory & Ledger | `go test -race -v ./internal/store/inventory/...` | Passed | Stock locking math, reservation invariant verification, and audit logs verified |
| Phase 17 Run | Order State Machine & Pipeline | `go test -race -v ./internal/store/orders/...` | Passed | Order state transitions, terminal state enforcement, and price calculation verified |
| Phase 18 Run | Customer Directory & LTV Analytics | `go test -race -v ./internal/store/customers/...` | Passed | Customer metrics calculation, AOV formulas, and address operations verified |
| Phase 19 Run | Promotion Engine & Coupons | `go test -race -v ./internal/store/promotions/...` | Passed | Percentage discount capping, fixed amount bounds, eligibility checks verified |
| Phase 20 Run | Store Settings & Staff RBAC | `go test -race -v ./internal/store/settings/...` | Passed | Tax calculation formulas, role constants, and owner guardrails verified |
| Phase 21 Run | Storefront Foundation & Theme Hydration | `npm run --prefix apps/storefront check:types && npm run --prefix apps/storefront build` | Passed | Next.js 14 App Router compiled, Edge middleware verified, theme CSS variables hydrated |
| Phase 22 Run | Storefront Catalog Discovery & Filtering | `go test -v ./internal/storefront/catalog/... && npm run --prefix apps/storefront check:types && npm run --prefix apps/storefront build` | Passed | Recursive category tree tests passed, Next.js catalog RSC compiled cleanly |
| Phase 23 Run | PDP, Swatches & Cart Engine | `go test -v ./internal/storefront/cart/... && npm run --prefix apps/storefront check:types && npm run --prefix apps/storefront build` | Passed | Cart concurrency math verified, Next.js PDP RSC and Cart Context compiled cleanly |
| Phase 24 Run | Storefront Checkout & Receipt | `go test -v ./internal/storefront/checkout/... && npm run --prefix apps/storefront check:types && npm run --prefix apps/storefront build` | Passed | Order number generation verified, Next.js Checkout and Confirmation views compiled |
| Phase 25 Run | Payment Gateways & Idempotency | `go test -v ./internal/store/payments/... && go test -v ./cmd/api/...` | Passed | Gateway drivers, Stripe HMAC verification, COD resolution, and idempotency logic verified |
| Phase 26 Run | Courier Logistics & Automation | `go test -v ./internal/store/logistics/... && go test -v ./cmd/api/...` | Passed | Steadfast/Pathao/RedX serialization, manual booking, and milestone mapping verified |
| Phase 27 Run | Marketing Telemetry & Meta CAPI | `go test -v ./internal/store/marketing/... && go test -v ./cmd/api/... && npm run --prefix apps/storefront check:types && npm run --prefix apps/storefront build` | Passed | SHA-256 PII hashing verified, Next.js analytics scripts and layout compiled cleanly |
| Phase 28 Run | Background Workers & Redis Streams | `go test -v ./internal/worker/... && go build ./cmd/worker/main.go && go test -v ./cmd/api/...` | Passed | Queue envelope serialization, exponential backoff, and worker daemon compiled cleanly |
| Phase 29 Run | Security Audits & Pen Tests | `go test -v ./internal/middleware ./internal/security/... && go test -bench=Benchmark ./internal/security` | Passed | Cross-tenant JWT tampering rejected, sliding-window rate limit logic verified, platform security audit report generated |
| Phase 30 Run | Production Deploy & Pilot Seeder | `bash .agent/checks.sh && go build -o /dev/null ./cmd/seed/main.go` | Passed | 30-phase implementation complete; all microservices, frontends, and seeders compiled |















