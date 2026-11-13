// Package security provides automated multi-tenant vulnerability auditing,
// cross-tenant penetration testing, and performance profiling tools.
package security

import (
	"time"
)

// AuditStatus defines compliance check verdicts.
type AuditStatus string

const (
	StatusPass AuditStatus = "PASS"
	StatusWarn AuditStatus = "WARN"
	StatusFail AuditStatus = "FAIL"
)

// SecurityCheckResult represents the evaluation of a single platform security invariant.
type SecurityCheckResult struct {
	Code        string      `json:"code"`
	Name        string      `json:"name"`
	Category    string      `json:"category"` // "ISOLATION", "ENCRYPTION", "NETWORK", "DATABASE"
	Status      AuditStatus `json:"status"`
	Description string      `json:"description"`
	Details     string      `json:"details,omitempty"`
}

// SecurityAuditReport represents the aggregated platform security compliance document.
type SecurityAuditReport struct {
	Timestamp      time.Time             `json:"timestamp"`
	TotalStores    int                   `json:"total_stores"`
	ChecksRun      int                   `json:"checks_run"`
	PassedChecks   int                   `json:"passed_checks"`
	WarningChecks  int                   `json:"warning_checks"`
	FailedChecks   int                   `json:"failed_checks"`
	OverallVerdict AuditStatus           `json:"overall_verdict"`
	Findings       []SecurityCheckResult `json:"findings"`
}
