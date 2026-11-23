package system

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net"
	"strconv"
	"time"

	"ecom-ventures/backend/internal/platform/models"
	storeDB "ecom-ventures/backend/internal/store/database"
	"ecom-ventures/backend/pkg/hasher"

	"github.com/redis/go-redis/v9"
)

// Service provides system diagnostics, platform staff management, and audit trail operations.
type Service struct {
	platformDB *sql.DB
	redis      *redis.Client
	tenantPool *storeDB.TenantPoolManager
	sessions   SessionRevoker
}

// NewService instantiates the platform system and diagnostics service.
// sessions revokes a staff member's Redis sessions when the account is deleted or its access changes.
func NewService(platformDB *sql.DB, rdb *redis.Client, pool *storeDB.TenantPoolManager, sessions SessionRevoker) *Service {
	return &Service{
		platformDB: platformDB,
		redis:      rdb,
		tenantPool: pool,
		sessions:   sessions,
	}
}

// ListAdmins returns all platform operators.
func (s *Service) ListAdmins(ctx context.Context) ([]models.PlatformUser, error) {
	query := `
		SELECT id, email, first_name, last_name, role, status, last_login_at, created_at, updated_at
		FROM platform_users
		ORDER BY created_at ASC;`

	rows, err := s.platformDB.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query platform users: %w", err)
	}
	defer rows.Close()

	var users []models.PlatformUser
	for rows.Next() {
		var u models.PlatformUser
		if err := rows.Scan(
			&u.ID, &u.Email, &u.FirstName, &u.LastName,
			&u.Role, &u.Status, &u.LastLoginAt, &u.CreatedAt, &u.UpdatedAt,
		); err != nil {
			return nil, err
		}
		users = append(users, u)
	}

	return users, rows.Err()
}

// CreateAdmin creates a new platform staff member.
func (s *Service) CreateAdmin(ctx context.Context, email, password, firstName, lastName, role string) (*models.PlatformUser, error) {
	hashed, err := hasher.HashPassword(password)
	if err != nil {
		return nil, err
	}

	query := `
		INSERT INTO platform_users (email, password_hash, first_name, last_name, role, status)
		VALUES (LOWER(TRIM($1)), $2, $3, $4, $5, 'ACTIVE')
		RETURNING id, email, first_name, last_name, role, status, created_at, updated_at;`

	var u models.PlatformUser
	err = s.platformDB.QueryRowContext(ctx, query, email, hashed, firstName, lastName, role).Scan(
		&u.ID, &u.Email, &u.FirstName, &u.LastName, &u.Role, &u.Status, &u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to insert platform user: %w", err)
	}

	// Record audit
	s.LogAudit(ctx, nil, email, "STAFF_CREATED", "platform_users", u.ID, nil, map[string]string{"role": role, "email": email}, "127.0.0.1", "Master Admin Panel")

	return &u, nil
}

// ListAuditLogs returns recent platform audit logs with optional filtering.
func (s *Service) ListAuditLogs(ctx context.Context, action string, limit int) ([]models.AuditLog, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}

	var query string
	var rows *sql.Rows
	var err error

	if action != "" && action != "ALL" {
		query = `
			SELECT a.id, a.user_id, COALESCE(u.email, a.user_email, 'system') as email,
			       a.action, a.resource_type, a.resource_id, a.store_id,
			       a.payload_before, a.payload_after, a.client_ip, a.user_agent, a.created_at
			FROM audit_logs a
			LEFT JOIN platform_users u ON a.user_id = u.id
			WHERE a.action = $1
			ORDER BY a.created_at DESC
			LIMIT $2;`
		rows, err = s.platformDB.QueryContext(ctx, query, action, limit)
	} else {
		query = `
			SELECT a.id, a.user_id, COALESCE(u.email, a.user_email, 'system') as email,
			       a.action, a.resource_type, a.resource_id, a.store_id,
			       a.payload_before, a.payload_after, a.client_ip, a.user_agent, a.created_at
			FROM audit_logs a
			LEFT JOIN platform_users u ON a.user_id = u.id
			ORDER BY a.created_at DESC
			LIMIT $1;`
		rows, err = s.platformDB.QueryContext(ctx, query, limit)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to query audit logs: %w", err)
	}
	defer rows.Close()

	var logs []models.AuditLog
	for rows.Next() {
		var l models.AuditLog
		var beforeBytes, afterBytes []byte
		var storeID sql.NullString
		var userID sql.NullString
		var userAgent sql.NullString

		if err := rows.Scan(
			&l.ID, &userID, &l.UserEmail,
			&l.Action, &l.ResourceType, &l.ResourceID, &storeID,
			&beforeBytes, &afterBytes, &l.ClientIP, &userAgent, &l.CreatedAt,
		); err != nil {
			return nil, err
		}

		if userID.Valid {
			l.UserID = &userID.String
		}
		if storeID.Valid {
			l.StoreID = &storeID.String
		}
		if userAgent.Valid {
			l.UserAgent = userAgent.String
		}
		if len(beforeBytes) > 0 {
			l.PayloadBefore = beforeBytes
		}
		if len(afterBytes) > 0 {
			l.PayloadAfter = afterBytes
		}

		logs = append(logs, l)
	}

	return logs, rows.Err()
}

// LogAudit inserts an audit event into audit_logs.
func (s *Service) LogAudit(ctx context.Context, userID *string, userEmail, action, resourceType, resourceID string, before, after interface{}, clientIP, userAgent string) {
	var beforeJSON, afterJSON []byte
	if before != nil {
		beforeJSON, _ = json.Marshal(before)
	}
	if after != nil {
		afterJSON, _ = json.Marshal(after)
	}

	query := `
		INSERT INTO audit_logs (user_id, user_email, action, resource_type, resource_id, payload_before, payload_after, client_ip, user_agent)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);`
	_, _ = s.platformDB.ExecContext(ctx, query, userID, userEmail, action, resourceType, resourceID, beforeJSON, afterJSON, clientIP, userAgent)
}

// ClusterOverview represents platform infrastructure telemetry.
type ClusterOverview struct {
	PlatformDB struct {
		Host      string `json:"host"`
		Port      int    `json:"port"`
		Database  string `json:"database"`
		Status    string `json:"status"`
		MaxOpen   int    `json:"max_open"`
		OpenConns int    `json:"open_conns"`
		InUse     int    `json:"in_use"`
		Idle      int    `json:"idle"`
	} `json:"platform_db"`
	TenantPools []TenantPoolMetric `json:"tenant_pools"`
	Redis       struct {
		Host    string              `json:"host"`
		Port    int                 `json:"port"`
		Status  string              `json:"status"`
		Streams []StreamQueueMetric `json:"streams"`
		Error   string              `json:"error,omitempty"`
	} `json:"redis"`
	MaintenanceMode bool      `json:"maintenance_mode"`
	Timestamp       time.Time `json:"timestamp"`
}

type TenantPoolMetric struct {
	Slug        string `json:"slug"`
	DBName      string `json:"db_name"`
	Status      string `json:"status"`
	ActiveConns int    `json:"active_conns"`
	IdleConns   int    `json:"idle_conns"`
}

type StreamQueueMetric struct {
	StreamKey      string `json:"stream_key"`
	ConsumerGroup  string `json:"consumer_group"`
	PendingEntries int    `json:"pending_entries"`
	Status         string `json:"status"`
}

// GetClusterOverview returns live diagnostics of Postgres pools and Redis streams.
func (s *Service) GetClusterOverview(ctx context.Context) (*ClusterOverview, error) {
	var co ClusterOverview
	co.Timestamp = time.Now().UTC()
	co.TenantPools = make([]TenantPoolMetric, 0)
	co.Redis.Streams = make([]StreamQueueMetric, 0)

	// Platform DB stats
	dbStats := s.platformDB.Stats()
	co.PlatformDB.Status = "DEGRADED"
	if err := s.platformDB.PingContext(ctx); err == nil {
		co.PlatformDB.Status = "HEALTHY"
	}
	var host sql.NullString
	err := s.platformDB.QueryRowContext(ctx, `
		SELECT current_database(),
		       inet_server_addr()::text,
		       COALESCE(inet_server_port(), 0)
	`).Scan(&co.PlatformDB.Database, &host, &co.PlatformDB.Port)
	if err != nil {
		return nil, fmt.Errorf("query platform database status: %w", err)
	}
	if host.Valid {
		co.PlatformDB.Host = host.String
	}
	co.PlatformDB.MaxOpen = dbStats.MaxOpenConnections
	co.PlatformDB.OpenConns = dbStats.OpenConnections
	co.PlatformDB.InUse = dbStats.InUse
	co.PlatformDB.Idle = dbStats.Idle

	rows, err := s.platformDB.QueryContext(ctx, "SELECT id::text, slug, db_name FROM stores ORDER BY slug ASC")
	if err != nil {
		return nil, fmt.Errorf("query tenant database pools: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var id string
		var metric TenantPoolMetric
		if err := rows.Scan(&id, &metric.Slug, &metric.DBName); err != nil {
			return nil, fmt.Errorf("scan tenant database pool: %w", err)
		}
		metric.Status = "POOL_NOT_OPEN"
		if s.tenantPool != nil {
			if stats, ok := s.tenantPool.PoolStats(id); ok {
				metric.Status = "POOL_OPEN"
				metric.ActiveConns = stats.InUse
				metric.IdleConns = stats.Idle
			}
		}
		co.TenantPools = append(co.TenantPools, metric)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate tenant database pools: %w", err)
	}

	// Redis status
	if s.redis != nil {
		host, port, err := net.SplitHostPort(s.redis.Options().Addr)
		if err != nil {
			return nil, fmt.Errorf("parse configured Redis address: %w", err)
		}
		co.Redis.Host = host
		co.Redis.Port, err = strconv.Atoi(port)
		if err != nil {
			return nil, fmt.Errorf("parse configured Redis port: %w", err)
		}
		if pingErr := s.redis.Ping(ctx).Err(); pingErr == nil {
			co.Redis.Status = "HEALTHY"
		} else {
			co.Redis.Status = "DEGRADED"
			co.Redis.Error = pingErr.Error()
		}
	} else {
		co.Redis.Status = "DISCONNECTED"
	}

	return &co, nil
}
