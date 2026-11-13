# Stage 1: Build stage with Go 1.22 Alpine compiler
FROM golang:1.22-alpine AS builder

WORKDIR /app

# Install security certificates and build tools
RUN apk add --no-cache git ca-certificates tzdata

# Download dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy backend source code
COPY . .

# Compile API Modular Monolith binary with optimizations
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags="-w -s" \
    -o /app/bin/api \
    ./cmd/api/main.go

# Compile Background Worker Daemon binary
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags="-w -s" \
    -o /app/bin/worker \
    ./cmd/worker/main.go

# Compile Pilot Seeder binary
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags="-w -s" \
    -o /app/bin/seed \
    ./cmd/seed/main.go

# Stage 2: Minimal unprivileged production runtime
FROM alpine:3.19 AS runner

WORKDIR /app

# Install minimal runtime dependencies (ca-certificates for SSL, postgresql-client for pg_dump backups)
RUN apk add --no-cache ca-certificates tzdata postgresql-client && \
    addgroup -g 10001 -S ecomgroup && \
    adduser -u 10001 -S ecomuser -G ecomgroup

# Copy compiled binaries from builder
COPY --from=builder /app/bin/api /app/bin/api
COPY --from=builder /app/bin/worker /app/bin/worker
COPY --from=builder /app/bin/seed /app/bin/seed

# Create uploads and backup directories with unprivileged permissions
RUN mkdir -p /app/uploads /app/backups && \
    chown -R ecomuser:ecomgroup /app

USER ecomuser:ecomgroup

EXPOSE 8080

ENTRYPOINT ["/app/bin/api"]
