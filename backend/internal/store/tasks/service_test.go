package tasks

import (
	"context"
	"database/sql"
	"strings"
	"testing"
)

func TestTaskServiceValidation(t *testing.T) {
	repo := NewRepository()
	svc := NewService(repo)

	var db *sql.DB

	// Title required
	_, err := svc.CreateTask(context.Background(), db, "user-1", &CreateTaskRequest{
		Title:      "   ",
		AssigneeID: "staff-1",
	})
	if err == nil || !strings.Contains(err.Error(), "task title is required") {
		t.Fatalf("expected title validation error, got %v", err)
	}

	// Assignee required
	_, err = svc.CreateTask(context.Background(), db, "user-1", &CreateTaskRequest{
		Title:      "Inspect oversized hoodies",
		AssigneeID: "",
	})
	if err == nil || !strings.Contains(err.Error(), "assignee staff member is required") {
		t.Fatalf("expected assignee validation error, got %v", err)
	}

	// Completion comment required
	_, err = svc.CompleteTask(context.Background(), db, "task-1", "   ")
	if err == nil || !strings.Contains(err.Error(), "completion comment / audit proof note is required") {
		t.Fatalf("expected completion comment validation error, got %v", err)
	}
}
