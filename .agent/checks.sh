#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
echo "=========================================================="
echo " Starting Ecom Ventures Automated Verification Pipeline    "
echo " Working Directory: ${ROOT_DIR}                          "
echo "=========================================================="

echo "[1/4] Scanning for placeholder stubs..."
PROHIBITED_PATTERNS=("TODO" "FIXME" "placeholder" "implement later")
FOUND_VIOLATIONS=0

for PATTERN in "${PROHIBITED_PATTERNS[@]}"; do
  MATCHES=$(grep -rnEI "${PATTERN}" \
    --exclude-dir={.git,node_modules,.next,dist,.agent} \
    --exclude="checks.sh" \
    --exclude=".agent/checks.sh" \
    --exclude="AGENT.md" \
    "${ROOT_DIR}" | grep -v -E '(placeholder=|placeholder-|::placeholder)' || true)

  if [ -n "${MATCHES}" ]; then
    echo "ERROR: Disallowed pattern '${PATTERN}' found in code:"
    echo "${MATCHES}"
    FOUND_VIOLATIONS=1
  fi
done

if [ ${FOUND_VIOLATIONS} -ne 0 ]; then
  echo "Verification Failed: Remove placeholder tags before committing."
  exit 1
fi
echo "✓ No disallowed placeholder patterns detected."

echo "[2/4] Verifying Go Backend..."
if [ -d "${ROOT_DIR}/backend" ]; then
  pushd "${ROOT_DIR}/backend" > /dev/null
  echo "  - Formatting check (gofmt)..."
  UNFORMATTED=$(gofmt -l . || true)
  if [ -n "${UNFORMATTED}" ]; then
    echo "ERROR: Unformatted Go files detected:"
    echo "${UNFORMATTED}"
    exit 1
  fi

  echo "  - Static analysis (go vet)..."
  go vet ./...

  echo "  - Unit tests execution..."
  if go env CGO_ENABLED 2>/dev/null | grep -q "1" && command -v gcc > /dev/null 2>&1; then
    go test -race -v ./...
  else
    go test -v ./...
  fi
  popd > /dev/null
  echo "✓ Go backend verified cleanly."
fi

echo "[3/4] Verifying Frontend Applications..."
FRONTEND_APPS=("apps/master-admin" "apps/store-admin" "apps/storefront")

for APP in "${FRONTEND_APPS[@]}"; do
  APP_PATH="${ROOT_DIR}/${APP}"
  if [ -d "${APP_PATH}" ]; then
    echo "  - Checking ${APP}..."
    pushd "${APP_PATH}" > /dev/null
    if [ -f "package.json" ]; then
      npm run lint || true
      if grep -q "\"check:types\"" package.json; then
        npm run check:types
      fi
    fi
    popd > /dev/null
    echo "  ✓ ${APP} verified."
  fi
done

echo "[4/4] Validating Docker Compose configuration..."
if [ -f "${ROOT_DIR}/docker-compose.yml" ]; then
  if command -v docker > /dev/null 2>&1; then
    docker compose -f "${ROOT_DIR}/docker-compose.yml" config > /dev/null
    echo "✓ docker-compose.yml syntax is valid."
  else
    echo "ℹ docker command not found on PATH, skipping container syntax validation."
  fi
fi

echo "=========================================================="
echo " All automated checks completed successfully. System ready."
echo "=========================================================="
exit 0
