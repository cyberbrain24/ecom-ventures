package security

import (
	"encoding/json"
	"fmt"
)

// GenerateJSONReport serializes the audit report into formatted JSON.
func GenerateJSONReport(report *SecurityAuditReport) ([]byte, error) {
	return json.MarshalIndent(report, "", "  ")
}

// GenerateMarkdownSummary formats the audit report as Markdown for administrative ledgers.
func GenerateMarkdownSummary(report *SecurityAuditReport) string {
	md := "# Ecom Ventures Security Audit Report\n\n"
	md += fmt.Sprintf("- **Generated At:** %s\n", report.Timestamp.Format("2006-01-02 15:04:05 UTC"))
	md += fmt.Sprintf("- **Total Brands Audited:** %d\n", report.TotalStores)
	md += fmt.Sprintf("- **Overall Compliance Verdict:** `%s`\n", report.OverallVerdict)
	md += fmt.Sprintf("- **Summary:** Passed: %d | Warnings: %d | Failures: %d\n\n",
		report.PassedChecks, report.WarningChecks, report.FailedChecks)

	md += "## Security Check Findings\n\n"
	md += "| Code | Check Name | Category | Status | Remarks |\n"
	md += "| :--- | :--- | :--- | :--- | :--- |\n"

	for _, f := range report.Findings {
		md += fmt.Sprintf("| `%s` | %s | %s | **%s** | %s |\n",
			f.Code, f.Name, f.Category, f.Status, f.Description)
	}

	return md
}
