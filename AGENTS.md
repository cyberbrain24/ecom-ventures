# AGENTS.md - Ecom Ventures Platform Engineering & Operational Guide

> **Notice to AI Agents & Developers:**
> This repository contains **Ecom Ventures**, an enterprise multi-tenant e-commerce platform built as a Go modular monolith backend with three dedicated frontends.
> Always consult this guide before creating files, running servers, executing migrations, or making git commits.

---

## 1. Monorepo Architecture & Directory Map

```text
d:/Ecom Ventures/
├── apps/
│   ├── master-admin/      # Platform Master Admin (React 18, Vite, Tailwind CSS)
│   ├── store-admin/       # Tenant Store Admin (React 18, Vite, Tailwind CSS)
│   └── storefront/        # Shared Customer Storefront (Next.js 14 App Router, SSR/RSC)
├── backend/
│   ├── cmd/
│   │   ├── api/           # Go API kernel entrypoint (main.go)
│   │   ├── migrate/       # CLI migration runner
│   │   ├── seed/          # Pilot brands seeder
│   │   └── worker/        # Standalone background worker process
│   ├── internal/
│   │   ├── config/        # Environment and typed configuration
│   │   ├── middleware/    # Auth, Tenant resolver, CORS, Rate-limiting, Recovery
│   │   ├── platform/      # Central platform services (stores, domains, themes, auth, storage_mgmt)
│   │   ├── store/         # Store services (catalog, inventory, orders, customers, promos, music)
│   │   ├── storefront/    # Public storefront customer endpoints
│   │   └── worker/        # Redis Streams consumers and cron scheduler
│   └── pkg/               # Reusable packages (crypto, hasher, jwt, response, storage)
├── infra/
│   ├── migrations/
│   │   ├── platform/      # Central Platform DB SQL DDL (000001 - 000005)
│   │   └── store/         # Dedicated Tenant Store DB SQL DDL
│   └── nginx/             # Local and production Nginx routing configs (ecom_ventures.conf)
├── .env.example           # Canonical local development environment template
├── .env.production.example# Canonical production VPS environment template
├── .gitignore             # Strict ignore list for secrets, binaries, and build artifacts
├── docker-compose.ecom.yml# Production coexistence Docker Compose config
├── Dockerfile.api         # Root Dockerfile for Go API Monolith
├── AGENT.md               # Historical 30-phase architectural ledger and feature registry
├── AGENTS.md              # Active operational guide for AI agents and human developers
└── VPS_DEPLOYMENT.md      # Canonical VPS Architecture, Coexistence & Upgrade Ledger
```

---

## 2. Server Connection & Production VPS Deployment Scope

### A. Production VPS Access Profile:
| Parameter | Value | Operational Details |
| :--- | :--- | :--- |
| **Host IP** | **`185.227.134.236`** | Dedicated production VPS IPv4 |
| **SSH Port** | **`22`** | Standard SSH port |
| **SSH User** | **`ecom`** | Dedicated unprivileged platform deployer user |
| **SSH Password** | `EcomVenturesPass2026!` | SSH authentication credential |
| **Project Working Directory** | **`/home/ecom/ecom_ventures`** | Isolated Ecom Ventures root (Never touch `/root/poshplex_store`) |
| **Git Remote Origin** | `https://github.com/cyberbrain24/ecom-ventures.git` | Canonical code origin |

### B. Production Database Access (PostgreSQL 16 on `127.0.0.1:5432`):
- **Host:** `127.0.0.1`
- **Port:** `5432`
- **User:** `ecom_user`
- **Password:** `Strong_Ecom_Pass_2026`
- **Platform Main DB:** `ecom_platform_main`
- **Store Template DB:** `ecom_store_template`
- **Tenant DBs:** `store_<slug>_<id>` (provisioned dynamically)
- **Forbidden DB:** `poshplex` (**STRICTLY FORBIDDEN: DO NOT ALTER OR DROP**)

### C. Production Redis Cache (Redis 7 on `127.0.0.1:6379`):
- **Host:** `127.0.0.1`
- **Port:** `6379`
- **Assigned DB:** **`0`** (Active staff JWT sessions, token revocation, IP rate-limiting, idempotency locks)
- **Reserved DB:** **`1`** (**STRICTLY RESERVED FOR POSHPLEX** — Django cache & Celery worker broker)

### D. Production Port Allocation (Zero Conflict with Poshplex):
| Port / Address | Subsystem / Stack | Container Name / Service | Operational Status |
| :--- | :--- | :--- | :--- |
| **`127.0.0.1:5000`** | **Ecom Ventures Go API Kernel** (chi/v5) | `ecom_api` | **ASSIGNED (200 OK)** |
| **`127.0.0.1:5100`** | **Ecom Ventures Next.js 14 Storefront** (SSR) | `ecom_storefront` | **ASSIGNED (200 OK)** |
| **`127.0.0.1:5200`** | **Ecom Ventures React 18 Admin SPAs** | `ecom_admin_server` / Nginx static | **ASSIGNED (200 OK)** |
| `127.0.0.1:8000` | Poshplex Core Backend (Django Gunicorn) | `poshplex_backend` | **STRICTLY FORBIDDEN (Poshplex Core)** |
| `127.0.0.1:3000` | Poshplex Storefront (Next.js) | `poshplex_store` | **STRICTLY FORBIDDEN (Poshplex Store)** |
| `127.0.0.1:3001` | Poshplex Admin (Refine SPA) | `poshplex_admin` | **STRICTLY FORBIDDEN (Poshplex Admin)** |
| `127.0.0.1:8080` | Poshplex Static/Media Router (Docker Nginx)| `poshplex_nginx` | **STRICTLY FORBIDDEN (Poshplex Media)** |

---

## 3. Local Development Port Mapping (Windows Host)

When running locally for feature development, use these standard ports:
| Service | Port | Technology / Command | Access URL / Notes |
| :--- | :--- | :--- | :--- |
| **Master Admin** | **`5000`** | `vite --port 5000 --host` | `http://localhost:5000` |
| **Store Admin** | **`5100`** | `vite --port 5100 --host` | `http://localhost:5100` |
| **Storefront** | **`5200`** | `next dev -p 5200` | `http://localhost:5200` |
| **Backend API** | **`8080`** | `go run ./cmd/api/main.go` / `api.exe` | `http://localhost:8080` |
| **PostgreSQL** | **`5432`** | PostgreSQL 15/16 engine | `localhost:5432` |
| **Redis Cache** | **`6379`** | Redis 7 (`requirepass redis_secure_password_2026`) | `localhost:6379` |

---

## 4. Platform Authentication & Seed Credentials

### Master Admin Login:
- **URL:** `http://localhost:5000` (Local) / `https://master.ecomventures.com` (VPS)
- **Email:** `superadmin@dropiobd.com`
- **Password:** `admin123`
- **Role:** `SUPER_ADMIN`
- **Endpoint:** `POST /api/v1/platform/auth/login`

### Redis Configuration:
- **Local Dev Port:** `6379` (Password: `redis_secure_password_2026`, DSN: `redis://:redis_secure_password_2026@localhost:6379/0`)
- **VPS Port:** `127.0.0.1:6379` (DB: `0` assigned to Ecom; DB: `1` reserved for Poshplex)

---

## 5. Multi-Tenant Architecture & Database Isolation Rules

Ecom Ventures enforces a strict **Database-Per-Tenant** operational model:

1. **Central Platform DB (`platform_db` local / `ecom_platform_main` VPS):**
   - Stores tenant registry (`stores`), custom domain bindings (`domains`), global themes (`themes`), and platform administrators (`platform_users`).
   - **Rule:** Contains ZERO tenant operational data (no products, orders, or customers).

2. **Dedicated Store DB (`store_<slug>_<id>`):**
   - Each provisioned brand has its own database, isolated user (`user_<slug>_<id>`), and encrypted credentials.
   - **PostgreSQL Table Ownership Rule (CRITICAL):**
     In PostgreSQL, only the owner of a table or a superuser can execute `ALTER TABLE`. Whenever new tables are migrated, their ownership must belong to the tenant user:
     ```sql
     ALTER TABLE coupons OWNER TO user_<slug>_<id>;
     ```
   - **Idempotent Schema Migration:**
     Never execute unhedged `ALTER TABLE` DDL directly inside read endpoints. Guard runtime schema extensions using `sync.Map` or `IF NOT EXISTS` / `DO $$ ... $$` blocks.

3. **Dynamic Tenant Context Resolution:**
   - Store context is dynamically bound per request via:
     - Header: `x-storefront-host` or HTTP `Host`
     - Route Prefix: `/store/{store_slug}`
   - Store mapping is cached in Redis for sub-millisecond lookup and invalidates automatically upon store modification.

---

## 6. Universal UI Governance Mandates (NON-NEGOTIABLE)

1. **Universal CRUD & Delete Approval Confirmation:**
   - Every entity, resource, or module added to either the **Master Admin** or **Store Admin** must provide both an **Edit** modal/system and a **Delete** modal/system.
   - **NO SILENT DELETES:** Never trigger immediate deletion without confirmation.
   - **NO NATIVE `window.confirm()`:** Never use the browser's default `confirm()` dialog.
   - Always use a branded, styled `ConfirmDeleteModal` displaying the item name, resource type, and destructive consequences before submitting `DELETE` requests.

2. **No Mock or Stub Code:**
   - Write fully functioning implementations. Never leave dummy placeholder returns, half-implemented functions, or `// TODO` comments.

3. **Type Safety & Error Handling:**
   - Every Go error must be explicitly checked and propagated using standardized RFC 7807 problem responses (`pkg/response`).
   - TypeScript interfaces must match backend DTOs with strict typing.

---

## 7. Shared VPS Coexistence Directives (Poshplex & Ecom on 12GB RAM VPS)

Consult the canonical guide [VPS_DEPLOYMENT.md](file:///d:/Ecom%20Ventures/VPS_DEPLOYMENT.md) for full deployment instructions.

1. **Go Monolith Footprint:**
   - The compiled Go API kernel is exceptionally lightweight (~30MB to 50MB RAM at idle, ~100MB under load).
   - In `docker-compose.ecom.yml`, `ecom_api` is memory-capped at `350M`, and `ecom_storefront` at `1200M`.
2. **Shared Database & Cache Engines:**
   - Do **NOT** run second containers for Postgres or Redis. Connect directly to `poshplex_postgres` (`127.0.0.1:5432`, user: `ecom_user`, db: `ecom_platform_main`) and `poshplex_redis` (`127.0.0.1:6379`, DB `0`).
3. **Strict Container & Safety Mandates:**
   - **NEVER** run `docker system prune -a --volumes` (will erase live Poshplex data).
   - **NEVER** kill, stop, or alter containers starting with `poshplex_`.
   - Always verify Nginx configuration with `nginx -t` before issuing `systemctl reload nginx`.
   - Ecom code must reside exclusively in `/home/ecom/ecom_ventures/`. Never touch `/root/poshplex_store/`.
4. **Object Storage via Cloudflare R2:**
   - Configure the backend storage driver (`pkg/storage`) to Cloudflare R2 (S3-compatible API) via Master Admin Settings.
   - Never store product media on the VPS local filesystem in production.

---

## 8. Autonomous VPS Upgrade & Version Tracking Protocol

> **CRITICAL DIRECTIVE FOR ALL AGENTS ON VPS TASKS:**
> Whenever you receive a prompt regarding VPS deployment, upgrading features, running migrations, or modifying configurations:
> 1. Always inspect [VPS_DEPLOYMENT.md](file:///d:/Ecom%20Ventures/VPS_DEPLOYMENT.md) before executing commands.
> 2. Use user `ecom`, directory `/home/ecom/ecom_ventures`, host `185.227.134.236`, DB `ecom_user`/`Strong_Ecom_Pass_2026`, and assigned ports `5000, 5100, 5200`.
> 3. Follow Semantic Versioning (`vMAJOR.MINOR.PATCH`).
> 4. Increment the active version tag in [VPS_DEPLOYMENT.md](file:///d:/Ecom%20Ventures/VPS_DEPLOYMENT.md).
> 5. Record the date, author/agent name, list of changes, and coexistence verification in **Section 9: Version Tracking & Upgrade Ledger** of [VPS_DEPLOYMENT.md](file:///d:/Ecom%20Ventures/VPS_DEPLOYMENT.md).

---

## 9. Git Safety & Repository Hygiene Rules

**For all AI Agents and Developers:**

1. **NEVER Push Without Explicit Confirmation:**
   - Only configure remotes, stage files, and commit locally. Do NOT run `git push origin <branch>` unless the user explicitly commands it.
2. **Strictly Forbidden from Git Tracking:**
   - `.env`, `.env.local`, `.env.production`, or any file containing plaintext credentials.
   - Go binaries (`*.exe`, `api.exe`, `migrate.exe`, `seed.exe`, `worker.exe`).
   - Redis snapshots (`dump.rdb`).
   - Scratch test scripts containing hardcoded passwords (e.g., `test_hash.go`).
   - Dependencies (`node_modules/`, `vendor/`) and build outputs (`dist/`, `.next/`, `out/`).
3. **Pre-Commit Verification Routine:**
   Before running `git commit`, always run:
   ```powershell
   git status -s
   git status --ignored -s
   ```
   Ensure that only intended source files are staged and zero secrets or generated binaries appear in the commit index.
