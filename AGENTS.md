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
│   │   ├── platform/      # Central platform services (stores, domains, themes, auth)
│   │   ├── store/         # Store services (catalog, inventory, orders, customers, promos)
│   │   ├── storefront/    # Public storefront customer endpoints
│   │   └── worker/        # Redis Streams consumers and cron scheduler
│   └── pkg/               # Reusable packages (crypto, hasher, jwt, response, storage)
├── infra/
│   ├── migrations/
│   │   ├── platform/      # Central Platform DB SQL DDL
│   │   └── store/         # Dedicated Tenant Store DB SQL DDL
│   └── nginx/             # Local and production Nginx routing configs
├── .env.example           # Canonical environment configuration template
├── .gitignore             # Strict ignore list for secrets, binaries, and build artifacts
├── AGENT.md               # Historical 30-phase architectural ledger and feature registry
└── AGENTS.md              # Active operational guide for AI agents and human developers
```

---

## 2. Standard Service Port Allocation & Running Daemons

When running the platform locally or in development, strictly observe these allocated ports:

| Service | Port | Technology / Command | Access URL / Notes |
| :--- | :--- | :--- | :--- |
| **Master Admin** | **`5000`** | `vite --port 5000 --host` | `http://localhost:5000` |
| **Store Admin** | **`5100`** | `vite --port 5100 --host` | `http://localhost:5100` |
| **Storefront** | **`5200`** | `next dev -p 5200` | `http://localhost:5200` |
| **Backend API** | **`8080`** | `go run ./cmd/api/main.go` / `api.exe` | `http://localhost:8080` |
| **PostgreSQL** | **`5432`** | PostgreSQL 15/16 engine | `localhost:5432` |
| **Redis Cache** | **`6379`** | Redis 7 (`requirepass redis_secure_password_2026`) | `localhost:6379` |

---

## 3. Platform Authentication & Seed Credentials

### Master Admin Login:
- **URL:** `http://localhost:5000`
- **Email:** `superadmin@dropiobd.com`
- **Password:** `admin123`
- **Role:** `SUPER_ADMIN`
- **Endpoint:** `POST /api/v1/platform/auth/login`

### Redis Configuration:
- **Port:** `6379`
- **Password:** `redis_secure_password_2026`
- **Connection DSN:** `redis://:redis_secure_password_2026@localhost:6379/0`

---

## 4. Multi-Tenant Architecture & Database Isolation Rules

Ecom Ventures enforces a strict **Database-Per-Tenant** operational model:

1. **Central Platform DB (`platform_db`):**
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

## 5. Universal UI Governance Mandates (NON-NEGOTIABLE)

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

## 6. Shared VPS Deployment & Coexistence with Other Stacks (e.g., Django)

When deploying Ecom Ventures alongside another web application (such as a Django e-commerce stack) on a shared VPS (e.g. 6 vCPU, 12 GB RAM):

1. **Go Monolith Footprint:**
   - The compiled Go API kernel is exceptionally lightweight (~30MB to 50MB RAM at idle, ~100MB under load).
   - It will coexist effortlessly with Django (Gunicorn/Uvicorn), PostgreSQL, and Redis on a 12GB RAM VPS.

2. **Object Storage via Cloudflare R2:**
   - **Storage Engine:** Do not store uploaded product media on the VPS local filesystem in production.
   - Configure the backend storage driver (`pkg/storage`) to Cloudflare R2 (S3-compatible API).
   - **Advantages:** Zero egress fees, high availability, and zero disk bloat on the VPS.

3. **Cloudflare CDN & Edge Proxy:**
   - Use Cloudflare CDN in front of both the Next.js storefront and Vite admin assets.
   - Cache static bundles (`_next/static`, `/assets/`, images) at edge data centers.

4. **Nginx Reverse Proxy:**
   - Nginx handles incoming port 80/443 traffic and routes by domain name:
     - `ecom.yourdomain.com` -> Proxy to `localhost:8080` (Go Backend)
     - `admin.yourdomain.com` -> Proxy to `localhost:5000` (Master Admin)
     - `*.storefront.com` -> Proxy to `localhost:5200` (Storefront)
     - `django.yourdomain.com` -> Proxy to `localhost:8000` (Django Gunicorn)

---

## 7. Git Safety & Repository Hygiene Rules

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
