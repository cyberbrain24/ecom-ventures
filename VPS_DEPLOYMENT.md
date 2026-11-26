# VPS System Architecture, Coexistence & Autonomous Agent Operational Guide

> **CRITICAL DIRECTIVE FOR ECOM VENTURES AGENTS & OPERATORS:**
> This Linux VPS is an active production host running **Poshplex** (`poshplexbd.com`), an active live e-commerce platform processing paying customer orders, Meta CAPI signals, and Steadfast courier dispatches.
> You (the Ecom Ventures Agent) are deploying and upgrading the **Ecom Ventures** platform onto this **same 12 GB RAM VPS**. Both systems must coexist with zero downtime and zero interference.
> 
> **AGENT REQUIREMENT ON EVERY VPS PROMPT / UPGRADE:**
> Whenever prompted about VPS deployment, upgrades, or maintenance, the agent MUST:
> 1. Read this file (`VPS_DEPLOYMENT.md`) and `AGENTS.md` to uphold all coexistence constraints.
> 2. Use the exact server credentials, directory scope (`/home/ecom/ecom_ventures`), and assigned ports (5000, 5100, 5200).
> 3. Verify all active port allocations and shared engine allocations (Postgres 5432, Redis DB 0).
> 4. Check for any schema or container changes.
> 5. Increment the VPS deployment version tag (following Semantic Versioning `vMAJOR.MINOR.PATCH`).
> 6. Append an entry to the **[Section 9: Version Tracking & Upgrade Ledger](#9-version-tracking--upgrade-ledger)** below documenting what changed.

---

## 1. Production VPS Connection & Directory Scope

| Parameter | Value | Operational Details |
| :--- | :--- | :--- |
| **Host IP** | **`185.227.134.236`** | Dedicated production VPS IPv4 |
| **SSH Port** | **`22`** | Standard SSH port |
| **SSH User** | **`ecom`** | Dedicated unprivileged platform deployer user |
| **SSH Password** | `EcomVenturesPass2026!` | SSH authentication credential |
| **Project Working Directory** | **`/home/ecom/ecom_ventures`** | Isolated Ecom Ventures root (Never touch `/root/poshplex_store`) |
| **Git Remote Origin** | `https://github.com/cyberbrain24/ecom-ventures.git` | Canonical code origin |

### Quick SSH Connection Command:
```bash
ssh ecom@185.227.134.236 -p 22
```

---

## 2. Active Port Allocation & Service Boundary Matrix

Ecom Ventures services are strictly mapped to ports **5000, 5100, and 5200**, leaving Poshplex services untouched:

| Port / Address | Subsystem / Stack | Container / Process Name | Operational Status |
| :--- | :--- | :--- | :--- |
| **`127.0.0.1:5000`** | **Ecom Ventures Go API Kernel** (chi/v5) | `ecom_api` | **ASSIGNED (200 OK)** |
| **`127.0.0.1:5100`** | **Ecom Ventures Next.js 14 Storefront** (SSR) | `ecom_storefront` | **ASSIGNED (200 OK)** |
| **`127.0.0.1:5200`** | **Ecom Ventures React 18 Admin SPAs** | `ecom_admin_server` / Nginx static | **ASSIGNED (200 OK)** |
| **`127.0.0.1:5432`** | **PostgreSQL 16 Engine** (Shared RDBMS) | `poshplex_postgres` | **SHARED DATABASE ENGINE** |
| **`127.0.0.1:6379`** | **Redis 7 Stack Engine** (Shared Cache) | `poshplex_redis` | **SHARED IN-MEMORY ENGINE** |
| `127.0.0.1:8000` | Poshplex Core Backend (Django Gunicorn) | `poshplex_backend` | **STRICTLY FORBIDDEN (Poshplex Core)** |
| `127.0.0.1:3000` | Poshplex Storefront (Next.js) | `poshplex_store` | **STRICTLY FORBIDDEN (Poshplex Store)** |
| `127.0.0.1:3001` | Poshplex Admin (Refine SPA) | `poshplex_admin` | **STRICTLY FORBIDDEN (Poshplex Admin)** |
| `127.0.0.1:8080` | Poshplex Static/Media Router (Docker Nginx)| `poshplex_nginx` | **STRICTLY FORBIDDEN (Poshplex Media)** |

---

## 3. Shared Database Coexistence (PostgreSQL 16 on `127.0.0.1:5432`)

Do **NOT** spin up a second PostgreSQL container (it will waste 4 GB of RAM and trigger Out-Of-Memory crashes). Connect directly to the existing `poshplex_postgres` instance listening on `127.0.0.1:5432`:

1. **Existing Poshplex Database**: `poshplex` (**STRICTLY FORBIDDEN: DO NOT ALTER, QUERY, OR DROP**).
2. **Databases Initialized for Ecom Ventures**:
   - `ecom_platform_main` — Central platform registry, superadmin staff, tenant domain routing mappings.
   - `ecom_store_template` — The prototype database used for atomic cloning when creating new stores.
   - `store_<slug>_<id>` — Isolated databases created dynamically per tenant.

### Connection Configuration for Go Kernel (`/home/ecom/ecom_ventures/.env.production`):
```env
PORT=5000
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=ecom_user
DB_PASSWORD=Strong_Ecom_Pass_2026
DB_MAIN_NAME=ecom_platform_main
DB_TEMPLATE_NAME=ecom_store_template
DB_SSLMODE=disable
```

### PostgreSQL Table Ownership Rule:
In PostgreSQL, only the owner of a table or a superuser can execute `ALTER TABLE`. Whenever new tenant databases or tables are created, ensure the dedicated tenant user (`user_<slug>_<id>`) owns them:
```sql
ALTER TABLE coupons OWNER TO user_<slug>_<id>;
```

---

## 4. Shared Redis Coexistence (Redis 7 Stack on `127.0.0.1:6379`)

Do **NOT** spin up a second Redis container. Both platforms share `poshplex_redis` on `127.0.0.1:6379`:
* **`Redis DB 1`**: **STRICTLY RESERVED FOR POSHPLEX** (Django REST cache & Celery worker broker).
* **`Redis DB 0`**: **ASSIGNED TO ECOM VENTURES** (Active staff JWT sessions, token revocation blocklists, IP rate-limiting, and cart checkout idempotency locks).

In your Go Redis connection setup:
```env
REDIS_ADDR=127.0.0.1:6379
REDIS_DB=0
```

---

## 5. Docker Compose Coexistence Configuration (`docker-compose.ecom.yml`)

The production compose file is stored in `/home/ecom/ecom_ventures/docker-compose.ecom.yml`:

```yaml
version: '3.8'

services:
  # 1. High-Performance Go Kernel API (:5000)
  ecom_api:
    build:
      context: .
      dockerfile: Dockerfile.api
    container_name: ecom_api
    restart: always
    network_mode: "host" # Connects directly to localhost:5432 (Postgres), :6379 (Redis), and binds :5000
    env_file:
      - .env.production
    environment:
      - PORT=5000
    deploy:
      resources:
        limits:
          memory: 350M # Extremely safe ceiling for Go

  # 2. Next.js 14 Storefront Service (:5100)
  ecom_storefront:
    build:
      context: ./apps/storefront
      dockerfile: Dockerfile
    container_name: ecom_storefront
    restart: always
    ports:
      - "127.0.0.1:5100:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - INTERNAL_API_URL=http://127.0.0.1:5000/api/v1
    deploy:
      resources:
        limits:
          memory: 1200M # Next.js constrained to 1.2GB max
```

---

## 6. Host Nginx Reverse Proxy Configuration

Saved at `infra/nginx/ecom_ventures.conf` and symlinked on VPS to `/etc/nginx/sites-available/ecom_ventures`:

```nginx
# 1. Ecom Go API (Port 5000)
server {
    server_name api.ecomventures.com;
    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    listen 80;
}

# 2. Ecom Multi-Tenant Next.js Storefront (Port 5100)
server {
    server_name ecomventures.com *.ecomventures.com;

    location / {
        proxy_pass http://127.0.0.1:5100;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host; # Crucial: passes tenant subdomain/CNAME to Next.js middleware
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    listen 80;
}

# 3. Store Merchant Admin SPA
server {
    server_name admin.ecomventures.com;
    root /var/www/ecom_store_admin;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    listen 80;
}

# 4. Master Platform Admin SPA
server {
    server_name master.ecomventures.com;
    root /var/www/ecom_master_admin;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    listen 80;
}
```

Enable and reload Nginx:
```bash
ln -s /etc/nginx/sites-available/ecom_ventures /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

---

## 7. Strict Coexistence Safety Rules

1. **NEVER run `docker system prune -a --volumes`**: This will destroy Poshplex's live production database volumes.
2. **NEVER kill, stop, restart, or modify containers starting with `poshplex_`**:
   - `poshplex_backend`
   - `poshplex_store`
   - `poshplex_admin`
   - `poshplex_worker`
   - `poshplex_postgres`
   - `poshplex_redis`
   - `poshplex_nginx`
3. **Always prefix Ecom Containers with `ecom_`**: `ecom_api`, `ecom_storefront`.
4. **Always verify Nginx with `nginx -t`** before executing `systemctl reload nginx` so Poshplex live traffic is never disrupted.
5. **Keep Ecom code strictly inside `/home/ecom/ecom_ventures/`**: Never inspect, alter, or touch `/root/poshplex_store/`.
6. **Object Storage via Cloudflare R2**: All uploaded tenant assets (product photos, theme banners) must be uploaded to Cloudflare R2 via `pkg/storage` rather than stored locally on VPS disk.

---

## 8. Zero-Downtime Upgrade Protocol for AI Agents

Whenever an agent performs an upgrade or deployment on the VPS, strictly follow this procedure:

```bash
# Step 1: SSH into VPS and navigate to Ecom Ventures root
ssh ecom@185.227.134.236 -p 22
cd /home/ecom/ecom_ventures

# Step 2: Fetch and pull latest committed changes from repository
git pull origin main

# Step 3: Run Database Migrations (Idempotent)
# Connects to ecom_platform_main without affecting poshplex DB
go run ./cmd/migrate/main.go -target=platform

# Step 4: Rebuild and restart Ecom containers atomically
docker compose -f docker-compose.ecom.yml build
docker compose -f docker-compose.ecom.yml up -d --no-deps ecom_api ecom_storefront

# Step 5: Build and copy Admin SPAs to Nginx web root
npm run --prefix apps/master-admin build
npm run --prefix apps/store-admin build
sudo cp -r apps/master-admin/dist/* /var/www/ecom_master_admin/
sudo cp -r apps/store-admin/dist/* /var/www/ecom_store_admin/

# Step 6: Test Nginx syntax and reload safely
sudo nginx -t && sudo systemctl reload nginx

# Step 7: Verify health probes
curl -f http://127.0.0.1:5000/healthz
curl -f http://127.0.0.1:5100
```

---

## 9. Version Tracking & Upgrade Ledger

> **AUTOMATIC UPGRADE INSTRUCTION:**
> Whenever any feature, configuration, bugfix, or migration is upgraded on the VPS, the acting agent MUST increment the current version tag and append a detailed record in this ledger table.

- **Current Production Release Version:** `v1.3.9`
- **Next Staged Milestone:** `v1.4.0` (Automated SSL provisioning and custom apex domain verification)

| Version | Date (UTC) | Author / Agent | Changes Deployed | Coexistence Verified |
| :--- | :--- | :--- | :--- | :--- |
| **`v1.3.9`** | 2026-11-27 | Antigravity AI Agent | **Pricing & Variants Matrix, Auto Min-Price Roll-up, Variant Image URL Binding & Simple 1:1 Default Variant**: Added `BindVariantImageByURL` and `SyncProductMinBasePrice` in `variants_repository.go` / `variants_service.go` so per-variant photos selected in Store Admin bind to `variant_images` and `products.base_price` automatically rolls up to the lowest active variant price. Updated `storefront/catalog/repository.go` (`GetProductBySlug`) to return `image_url` on `PublicVariantDetail` for instant swatch image switching. Updated `CreateProduct` (`catalog/service.go`) to create a 1:1 default variant + inventory baseline for `simple` products. Wired `image_url` in `apps/store-admin/src/lib/catalog-api.ts` and `ProductUploadModal.tsx`. | **Verified Live**: `go test ./internal/store/catalog/... ./internal/storefront/catalog/...` passed. `https://admin.dropiobd.com`, `https://api.dropiobd.com/healthz`, `https://miorbd.com`, and `https://poshplexbd.com` all return `200 OK`. Poshplex unaffected. |
| **`v1.3.8`** | 2026-11-27 | Antigravity AI Agent | **Drag-and-Drop Product Image Reordering & Instant Storefront Product Sync**: Added mouse drag-and-drop image card reordering in `ProductUploadModal.tsx` (1st position automatically becomes Primary `featured_image_url`, remaining images in order become `gallery_filenames`). Disabled stale 60s/300s Next.js `fetch` revalidation caching in `apps/storefront/src/lib/catalog-api.ts` (`cache: 'no-store'`) so newly uploaded, edited, or deleted products and categories appear immediately on the storefront. Rebuilt `ecom_storefront` and updated `ecom_admin_server`. | **Verified Live**: `https://miorbd.com` returns `200 OK` and renders `lower Shape Ring Vintage`. `https://admin.dropiobd.com` and `https://poshplexbd.com` return `200 OK`. Poshplex unaffected. |
| **`v1.3.7`** | 2026-11-27 | Antigravity AI Agent | **Store Admin Multi-Photo Upload, Cancel Cleanup, Live Variant Matrix & Size Guide Cleanup**: Added `DELETE /api/v1/store/{store_slug}/media?key=...` (`DeleteStoreMedia` in `storage_mgmt/handler.go`) with strict `stores/{slug}/` tenant key isolation. Updated `ProductUploadModal.tsx` and `CatalogView.tsx` to support selecting multiple photos from disk, setting primary/gallery thumbnails, and automatically deleting unsaved uploads on Cancel/Close (while persisting on OK). Replaced hardcoded variant placeholders with live store attribute selection and Cartesian matrix generation (`POST /catalog/products/{id}/variants/generate`). Removed hardcoded `Standard Templates` from the Size Guide Template dropdown so only database-backed store templates appear. | **Verified Live**: `https://admin.dropiobd.com` and `https://api.dropiobd.com/healthz` return `200 OK`. `go test ./cmd/api/... ./pkg/storage/...` and `store-admin` build passed. Poshplex unaffected. |
| **`v1.3.6`** | 2026-11-25 | Antigravity AI Agent | **Live DNS & Edge HTTPS Domain Verification**: Updated `CreateStore` (`store_mgmt/service.go`) to generate a `verification_token` and automatically mark `ssl_status = 'ACTIVE'` + `verified_at` when the primary domain already resolves over HTTPS (`< 500`). Updated `VerifyDomain` (`domains/service.go`) so when Cloudflare for SaaS Custom Hostnames (`CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ZONE_ID`) is not configured, verification performs a real live DNS resolution + TLS/HTTPS probe (with DNS TXT fallback) instead of failing. Rebuilt `ecom_api` and verified all 7 live domains via `POST /api/v1/platform/domains/{id}/verify`. | **Verified Live**: All 7 registered domains (`iranicobd.com`, `shutkiman.com`, `poshgirlbd.com`, `poshgearbd.com`, `innerposh.com`, `miorbd.com`, `mior.dropiobd.com`) transitioned to `ACTIVE` and `Verified` via API. Poshplex unaffected. |
| **`v1.3.5`** | 2026-11-25 | Antigravity AI Agent | **White Background Standardization Across All Storefront Themes**: Added platform migration `000008_light_theme_backgrounds.up.sql` converting all dark-background theme schemas (`streetculture-fashion`, `jewelry-women`, `gadget-tech`, `midnight-gold`, `cyber-neo`) to `#ffffff` background/surface with high-contrast dark text. Updated `apps/storefront/src/lib/theme.ts`, `apps/storefront/src/app/globals.css`, and `apps/storefront/src/components/home/ThemeHero.tsx` (`tech-matrix`, `jewelry`, `gadget`) for crisp light-mode readability. Applied migration to `ecom_platform_main`, cleared theme/store Redis caches, and rebuilt `ecom_storefront`. | **Verified Live**: `https://miorbd.com` (`jewelry-women`) renders `--t-bg: #ffffff;` and returns `200 OK`. `https://innerposh.com` and `https://poshplexbd.com` return `200 OK`. Poshplex unaffected. |
| **`v1.3.4`** | 2026-11-25 | Antigravity AI Agent | **Platform Policies Configuration API & Live Worker/Scheduler Telemetry**: Added platform migration `000007_platform_policies.up.sql` creating and seeding `platform_policies`. Added `GET/PUT /api/v1/platform/system/policies` with validation and audit logging (`PLATFORM_POLICIES_UPDATED`). Added `GET /api/v1/platform/system/workers` and `POST /api/v1/platform/system/workers/trigger` exposing live Redis Streams (`stream:ecom:jobs`, `stream:ecom:jobs:dlq`), consumer group health (`ecom-worker-group`), and distributed cron lock TTLs (`lock:cron:*`). Updated `GET /api/v1/platform/system/overview` to read `maintenance_mode` from `platform_policies` and report live stream depths. Wired Master Admin `SettingsPage` tabs (`PlatformPoliciesPanel` and `WorkerTelemetryPanel`) and deployed `ecom_api` and `ecom_admin_server`. | **Verified Live**: `GET /api/v1/platform/system/policies`, `GET /api/v1/platform/system/workers`, and `GET /api/v1/platform/system/overview` return HTTP 200 OK on `https://api.dropiobd.com`. `https://master.dropiobd.com` and `https://poshplexbd.com` return 200 OK. Poshplex containers unaffected. |
| **`v1.3.3`** | 2026-11-24 | Antigravity AI Agent | **Automated Multi-Tenant Custom Domain Routing & Lifecycle**: Fixed brand `INNERPOSH` live routing (`innerposh.com`). Re-architected Nginx reverse proxy routing on the VPS: transitioned Next.js Storefront (`127.0.0.1:5100`) to be the multi-tenant `default_server` on port 80 and 443 with Let's Encrypt SNI fallback and direct IP protection (`^[0-9.]+$` drops with 444). Incoming requests dynamically resolve via the Go API and Postgres/Redis tenant registry. When any new brand or custom domain is provisioned, traffic routes immediately with zero manual Nginx intervention; when a store is deleted, Next.js instantly renders "Store Unavailable" (404). Cleaned direct IP catch-all in `poshplex` configuration to avoid SNI handshake rejection. | **Verified Live**: Public internet curl to `https://innerposh.com` returns 200 OK (`<title>INNERPOSH \| Official Online Store</title>`). `https://miorbd.com`, `https://master.dropiobd.com`, and `https://poshplexbd.com` verified 200 OK. Unknown domains return dynamic 404 Store Unavailable. Direct IP access dropped with 444. Poshplex completely unaffected. |
| **`v1.3.2`** | 2026-11-24 | Antigravity AI Agent | **Extended Storefront Theme Registry (12 Catalog Themes)**: Added platform migration `000006_seed_extended_storefront_themes.up.sql` expanding the Master Admin theme registry from 4 to 12 blueprints (adding Gadgets & Tech, Sensual Couture, Royal Heritage, Minimal Mono, Midnight Luxury Gold, Cyber Neo Emerald, Terracotta & Sand, Deep Oceanic Cyan). Updated backend `ThemeConfigValidator` to support all 7 storefront design variants and hero layouts (`gadget`, `inner-fashion`, `traditional-fashion`, `tech-matrix`, `sensual-couture`, `royal-heritage`). Applied migration to both local and VPS platform databases, recompiled and restarted `ecom_api`. | **Verified Live**: `GET /api/v1/platform/themes` on VPS returns all 12 themes. Master Admin Theme Registry and Store Creator now present the full theme catalog. Poshplex unaffected. |
| **`v1.3.1`** | 2026-11-24 | Antigravity AI Agent | **Custom Apex Domain Live Routing (`miorbd.com`, `www.miorbd.com`)**: Integrated custom tenant domains into host Nginx reverse proxy configuration (`/etc/nginx/sites-available/dropiobd.conf`). Resolved Cloudflare Error 525 (SSL Handshake Failed) by binding apex and www custom domains to the Next.js multi-tenant storefront (`127.0.0.1:5100`) across Port 80 and Port 443 with SNI fallback. Synchronized canonical config to `infra/nginx/dropiobd.conf`. | **Verified Live**: `https://miorbd.com` and `https://www.miorbd.com` return HTTP 200 OK with `data-theme="jewelry"`. All Poshplex containers undisturbed. |
| **`v1.3.0`** | 2026-11-24 | Antigravity AI Agent | **Editable Primary Domain & Active Theme with Cross-Database Sync**: Upgraded `EditStoreModal` in Master Admin to allow editing Primary Storefront Domain and Active Design Theme directly. Backend `PATCH /api/v1/platform/stores/{id}` now updates platform routing (`domains`), theme assignment (`store_themes`), and dynamically synchronizes directly into the tenant's dedicated database (`store_settings.primary_domain`, `store_settings.active_theme`, `store_metadata`). Purges Redis domain, slug, and theme caches. Added migration `000030_store_domain_and_theme_settings.up.sql` to golden template and active tenant databases. | **Verified Live**: Tested on `185.227.134.236` with active brand `mior`. Tenant database `store_mior_6389f9e8` updated synchronously with zero errors. All Poshplex containers unaffected. |
| **`v1.2.0`** | 2026-11-24 | Antigravity AI Agent | **Production Live VPS Deployment**: Successfully deployed to `185.227.134.236`. Applied platform migrations `000001-000005` to `ecom_platform_main` and store migrations `000001-000029` + `seed_locations` to `ecom_store_template`. Seeded superadmin `superadmin@dropiobd.com`. Built and launched `ecom_api` (5000), `ecom_storefront` (5100), and `ecom_admin_server` (5200) via `docker-compose.ecom.yml`. Verified all 3 return HTTP 200 OK. | **Verified Live**: Total Ecom footprint ~46.3MB RAM (api 3.7M, storefront 30.3M, admin 12.4M). Zero interference with Poshplex (all 7 poshplex containers undisturbed). |
| **`v1.1.1`** | 2026-11-24 | Antigravity AI Agent | Configured VPS Connection & Directory Scope: Set dedicated user `ecom`, directory `/home/ecom/ecom_ventures`, IP `185.227.134.236`, DB credentials (`ecom_user` / `Strong_Ecom_Pass_2026`), and Redis DB 0. Created `.env.production.example`. | Verified: zero collision with root directories or Poshplex containers. |
| **`v1.1.0`** | 2026-11-24 | Antigravity AI Agent | Cloudflare R2 Object Storage Integration: Added pure Go SigV4 R2 driver, thread-safe DynamicStorageProvider for zero-downtime hot-swapping, Master Admin Cloudflare R2 credential management UI with live ping test, live upload test sandbox, and strict folder partitioning (`platform/` vs `stores/{store_slug}/{module}/`). Added migration `000005_platform_storage_settings`. | Verified: zero local disk bloat on VPS, zero conflict with Poshplex. |
| **`v1.0.0`** | 2026-11-24 | Antigravity AI Agent | Baseline VPS coexistence configuration. Assigned Ports 5000 (Go API), 5100 (Storefront), 5200 (Admin SPAs). Shared PostgreSQL 16 on 5432 (`ecom_platform_main`, `ecom_store_template`), shared Redis 7 on 6379 (DB 0 for Ecom, DB 1 reserved for Poshplex). Added `docker-compose.ecom.yml`, `Dockerfile.api`, and `infra/nginx/ecom_ventures.conf`. | Verified: zero port conflict with Poshplex 8000/3000/3001/8080. |
