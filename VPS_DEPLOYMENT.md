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

- **Current Production Release Version:** `v1.1.1`
- **Next Staged Milestone:** `v1.2.0` (Production live deployment on 185.227.134.236 & SSL edge configuration)

| Version | Date (UTC) | Author / Agent | Changes Deployed | Coexistence Verified |
| :--- | :--- | :--- | :--- | :--- |
| **`v1.1.1`** | 2026-11-24 | Antigravity AI Agent | Configured VPS Connection & Directory Scope: Set dedicated user `ecom`, directory `/home/ecom/ecom_ventures`, IP `185.227.134.236`, DB credentials (`ecom_user` / `Strong_Ecom_Pass_2026`), and Redis DB 0. Created `.env.production.example`. | Verified: zero collision with root directories or Poshplex containers. |
| **`v1.1.0`** | 2026-11-24 | Antigravity AI Agent | Cloudflare R2 Object Storage Integration: Added pure Go SigV4 R2 driver, thread-safe DynamicStorageProvider for zero-downtime hot-swapping, Master Admin Cloudflare R2 credential management UI with live ping test, live upload test sandbox, and strict folder partitioning (`platform/` vs `stores/{store_slug}/{module}/`). Added migration `000005_platform_storage_settings`. | Verified: zero local disk bloat on VPS, zero conflict with Poshplex. |
| **`v1.0.0`** | 2026-11-24 | Antigravity AI Agent | Baseline VPS coexistence configuration. Assigned Ports 5000 (Go API), 5100 (Storefront), 5200 (Admin SPAs). Shared PostgreSQL 16 on 5432 (`ecom_platform_main`, `ecom_store_template`), shared Redis 7 on 6379 (DB 0 for Ecom, DB 1 reserved for Poshplex). Added `docker-compose.ecom.yml`, `Dockerfile.api`, and `infra/nginx/ecom_ventures.conf`. | Verified: zero port conflict with Poshplex 8000/3000/3001/8080. |
