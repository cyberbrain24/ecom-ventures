# ECOM VENTURES: PRODUCTION GO-LIVE & VALIDATION RUNBOOK

This operational runbook establishes the strict verification checklist required to launch the Ecom Ventures multi-brand platform into production.

---

## 1. PRE-FLIGHT INFRASTRUCTURE VALIDATION

- [ ] **PostgreSQL 16 High-Availability Cluster:**
  - Verify that the central platform database (`ecom_platform_main`) and template database are online.
  - Verify that connection pool parameters (`MaxOpenConns=25`, `MaxIdleConns=10`) match available RAM.
- [ ] **Redis 7 In-Memory Cache & Streams:**
  - Verify that password authentication is enforced (`--requirepass`).
  - Verify that Redis Streams group `stream:ecom:jobs` is initialized and consumer groups respond to `XINFO`.
- [ ] **Cryptographic Encryption Key Check:**
  - Ensure `DATABASE_ENCRYPTION_KEY` is a cryptographically random 32-byte hexadecimal string.
  - Test encryption/decryption of sample strings via `pkg/crypto`.

---

## 2. CI/CD DEPLOYMENT & PIPELINE EXECUTION

- [ ] **Automated Pipeline Execution:**
  - Merge code to `main` branch.
  - Confirm GitHub Actions workflow passes: static analysis (`.agent/checks.sh`), Go unit tests (`go test -race ./...`), TypeScript check (`npm run check:types`), and Docker multi-stage builds.
- [ ] **Database Migrations:**
  - Execute `make migrate-platform-up` to ensure platform migrations are at current version.
  - Verify `platform_schema_migrations` records all schema versions without dirty flags.

---

## 3. PILOT BRAND PROVISIONING & CATALOG SEEDING

- [ ] **Execute Pilot Brand Seeder:**
  - Run `go run cmd/seed/main.go` to provision initial commercial brands:
    - `mior` (Luxury Fashion) -> Bound to `modern-minimal` theme.
    - `artisan` (Leather Goods & Perfumes) -> Bound to `artisan-boutique` theme.
    - `urban` (Streetwear Footwear) -> Bound to `urban-streetwear` theme.
- [ ] **Inspect Dedicated Database Instances:**
  - Confirm that three isolated PostgreSQL databases were instantiated.
  - Verify that `store_staff` records have Argon2id password hashes.
  - Verify that `store_schema_migrations` in each tenant database executed without errors.

---

## 4. DOMAIN ROUTING, EDGE SSL & CLOUDFLARE VERIFICATION

- [ ] **Nginx & Host Resolution:**
  - Verify local and production reverse proxies preserve `Host` and `X-Forwarded-Host` headers without modification.
- [ ] **Apex Custom Domain Routing:**
  - Verify DNS CNAME pointing to `edge.dropiobd.com`.
  - Validate edge SSL certificate status is `ACTIVE` via `/api/v1/platform/domains`.
- [ ] **Store Context Guardrail:**
  - Probe arbitrary unregistered domain `unknown.localhost` -> Expect HTTP 404 Problem Details.
  - Probe suspended store slug -> Expect HTTP 403 Forbidden Problem Details.

---

## 5. END-TO-END COMMERCE SMOKE TEST

- [ ] **Storefront Catalog Browsing (`apps/storefront`):**
  - Navigate to `http://mior.localhost:3000` -> Confirm brand name, logo, and theme colors match *Modern Minimal*.
  - Browse category trees and product listing pages -> Verify faceted filtering works.
- [ ] **Cart & Variant Swatches:**
  - Open Product Detail Page (PDP) -> Test color swatches and variant resolution.
  - Add item to cart -> Verify slide-over cart drawer and line-item subtotal math.
- [ ] **Checkout & Inventory Reservation:**
  - Complete checkout with Cash on Delivery (COD) -> Confirm order receipt screen displays `ORD-YYMMDD-XXXX`.
  - Check inventory ledger (`stock_movements`) -> Verify stock was decremented with reason `ORDER_FULFILLMENT`.
- [ ] **Payment Webhook Idempotency:**
  - Simulate payment gateway webhook callback -> Verify HTTP 200 OK and that duplicate calls do not double-settle the order.
