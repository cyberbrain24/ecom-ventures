package tasks

import "time"

// TaskCategoryDTO represents a work stream domain.
type TaskCategoryDTO struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Color     string    `json:"color"`
	TaskCount int       `json:"task_count"` // active pending count
	CreatedAt time.Time `json:"created_at"`
}

// StaffSummaryDTO represents minimal staff details for task assignees and creators.
type StaffSummaryDTO struct {
	ID        string `json:"id"`
	Email     string `json:"email"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	Role      string `json:"role"`
}

// TaskDTO represents a fully hydrated work item.
type TaskDTO struct {
	ID                string           `json:"id"`
	Title             string           `json:"title"`
	Description       *string          `json:"description,omitempty"`
	CategoryID        *string          `json:"category_id,omitempty"`
	Category          *TaskCategoryDTO `json:"category,omitempty"`
	AssigneeID        string           `json:"assignee_id"`
	Assignee          StaffSummaryDTO  `json:"assignee"`
	CreatedByID       *string          `json:"created_by_id,omitempty"`
	CreatedBy         *StaffSummaryDTO `json:"created_by,omitempty"`
	Status            string           `json:"status"` // 'pending' | 'completed'
	CompletionComment *string          `json:"completion_comment,omitempty"`
	CreatedAt         time.Time        `json:"created_at"`
	CompletedAt       *time.Time       `json:"completed_at,omitempty"`
	UpdatedAt         time.Time        `json:"updated_at"`
}

// CreateTaskRequest is the payload for assigning a new task.
type CreateTaskRequest struct {
	Title       string  `json:"title"`
	Description *string `json:"description,omitempty"`
	CategoryID  *string `json:"category_id,omitempty"`
	AssigneeID  string  `json:"assignee_id"`
}

// UpdateTaskRequest is the payload for editing task details.
type UpdateTaskRequest struct {
	Title       *string `json:"title,omitempty"`
	Description *string `json:"description,omitempty"`
	CategoryID  *string `json:"category_id,omitempty"`
	AssigneeID  *string `json:"assignee_id,omitempty"`
}

// CompleteTaskRequest requires a verification / audit proof comment.
type CompleteTaskRequest struct {
	CompletionComment string `json:"completion_comment"`
}

// CreateCategoryRequest defines a new department.
type CreateCategoryRequest struct {
	Name  string `json:"name"`
	Color string `json:"color"`
}
