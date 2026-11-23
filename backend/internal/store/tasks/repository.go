package tasks

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
)

type Repository struct{}

func NewRepository() *Repository {
	return &Repository{}
}

// ListCategories returns all categories with the count of active pending tasks.
func (r *Repository) ListCategories(ctx context.Context, db *sql.DB) ([]TaskCategoryDTO, error) {
	query := `
		SELECT c.id, c.name, c.color, c.created_at,
		       COALESCE(COUNT(t.id) FILTER (WHERE t.status = 'pending'), 0) AS task_count
		FROM task_categories c
		LEFT JOIN tasks t ON t.category_id = c.id
		GROUP BY c.id
		ORDER BY c.name ASC;
	`
	rows, err := db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to list task categories: %w", err)
	}
	defer rows.Close()

	var categories []TaskCategoryDTO
	for rows.Next() {
		var cat TaskCategoryDTO
		if err := rows.Scan(&cat.ID, &cat.Name, &cat.Color, &cat.CreatedAt, &cat.TaskCount); err != nil {
			return nil, err
		}
		categories = append(categories, cat)
	}
	if categories == nil {
		categories = []TaskCategoryDTO{}
	}
	return categories, nil
}

// CreateCategory adds a new task category.
func (r *Repository) CreateCategory(ctx context.Context, db *sql.DB, name, color string) (*TaskCategoryDTO, error) {
	query := `
		INSERT INTO task_categories (name, color, created_at)
		VALUES ($1, $2, CURRENT_TIMESTAMP)
		RETURNING id, name, color, created_at;
	`
	var cat TaskCategoryDTO
	err := db.QueryRowContext(ctx, query, name, color).Scan(&cat.ID, &cat.Name, &cat.Color, &cat.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to create task category: %w", err)
	}
	return &cat, nil
}

// ListTasks returns all tasks, optionally filtered by assignee or status.
func (r *Repository) ListTasks(ctx context.Context, db *sql.DB, assigneeID, status, categoryID string) ([]TaskDTO, error) {
	var queryBuilder strings.Builder
	queryBuilder.WriteString(`
		SELECT t.id, t.title, t.description, t.status, t.completion_comment,
		       t.created_at, t.completed_at, t.updated_at,
		       c.id, c.name, c.color, c.created_at,
		       a.id, a.email, a.first_name, a.last_name, a.role,
		       cr.id, cr.email, cr.first_name, cr.last_name, cr.role
		FROM tasks t
		LEFT JOIN task_categories c ON c.id = t.category_id
		INNER JOIN store_staff a ON a.id = t.assignee_id
		LEFT JOIN store_staff cr ON cr.id = t.created_by_id
		WHERE 1=1
	`)

	var args []interface{}
	argIdx := 1

	if strings.TrimSpace(assigneeID) != "" && assigneeID != "all" {
		queryBuilder.WriteString(fmt.Sprintf(" AND t.assignee_id = $%d", argIdx))
		args = append(args, assigneeID)
		argIdx++
	}

	if strings.TrimSpace(status) != "" {
		queryBuilder.WriteString(fmt.Sprintf(" AND t.status = $%d", argIdx))
		args = append(args, status)
		argIdx++
	}

	if strings.TrimSpace(categoryID) != "" {
		queryBuilder.WriteString(fmt.Sprintf(" AND t.category_id = $%d", argIdx))
		args = append(args, categoryID)
		argIdx++
	}

	queryBuilder.WriteString(" ORDER BY t.created_at DESC")

	rows, err := db.QueryContext(ctx, queryBuilder.String(), args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query tasks: %w", err)
	}
	defer rows.Close()

	var tasks []TaskDTO
	for rows.Next() {
		var t TaskDTO
		var desc, compComment sql.NullString
		var completedAt sql.NullTime

		var catID, catName, catColor sql.NullString
		var catCreatedAt sql.NullTime

		var crID, crEmail, crFirst, crLast, crRole sql.NullString

		err := rows.Scan(
			&t.ID, &t.Title, &desc, &t.Status, &compComment,
			&t.CreatedAt, &completedAt, &t.UpdatedAt,
			&catID, &catName, &catColor, &catCreatedAt,
			&t.Assignee.ID, &t.Assignee.Email, &t.Assignee.FirstName, &t.Assignee.LastName, &t.Assignee.Role,
			&crID, &crEmail, &crFirst, &crLast, &crRole,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan task: %w", err)
		}

		t.AssigneeID = t.Assignee.ID

		if desc.Valid && strings.TrimSpace(desc.String) != "" {
			d := desc.String
			t.Description = &d
		}
		if compComment.Valid && strings.TrimSpace(compComment.String) != "" {
			cc := compComment.String
			t.CompletionComment = &cc
		}
		if completedAt.Valid {
			ca := completedAt.Time
			t.CompletedAt = &ca
		}

		if catID.Valid {
			cid := catID.String
			t.CategoryID = &cid
			t.Category = &TaskCategoryDTO{
				ID:        cid,
				Name:      catName.String,
				Color:     catColor.String,
				CreatedAt: catCreatedAt.Time,
			}
		}

		if crID.Valid {
			cid := crID.String
			t.CreatedByID = &cid
			t.CreatedBy = &StaffSummaryDTO{
				ID:        cid,
				Email:     crEmail.String,
				FirstName: crFirst.String,
				LastName:  crLast.String,
				Role:      crRole.String,
			}
		}

		tasks = append(tasks, t)
	}

	if tasks == nil {
		tasks = []TaskDTO{}
	}
	return tasks, nil
}

// GetTaskByID retrieves a single task by its UUID.
func (r *Repository) GetTaskByID(ctx context.Context, db *sql.DB, id string) (*TaskDTO, error) {
	query := `
		SELECT t.id, t.title, t.description, t.status, t.completion_comment,
		       t.created_at, t.completed_at, t.updated_at,
		       c.id, c.name, c.color, c.created_at,
		       a.id, a.email, a.first_name, a.last_name, a.role,
		       cr.id, cr.email, cr.first_name, cr.last_name, cr.role
		FROM tasks t
		LEFT JOIN task_categories c ON c.id = t.category_id
		INNER JOIN store_staff a ON a.id = t.assignee_id
		LEFT JOIN store_staff cr ON cr.id = t.created_by_id
		WHERE t.id = $1
		LIMIT 1;
	`
	var t TaskDTO
	var desc, compComment sql.NullString
	var completedAt sql.NullTime

	var catID, catName, catColor sql.NullString
	var catCreatedAt sql.NullTime

	var crID, crEmail, crFirst, crLast, crRole sql.NullString

	err := db.QueryRowContext(ctx, query, id).Scan(
		&t.ID, &t.Title, &desc, &t.Status, &compComment,
		&t.CreatedAt, &completedAt, &t.UpdatedAt,
		&catID, &catName, &catColor, &catCreatedAt,
		&t.Assignee.ID, &t.Assignee.Email, &t.Assignee.FirstName, &t.Assignee.LastName, &t.Assignee.Role,
		&crID, &crEmail, &crFirst, &crLast, &crRole,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	} else if err != nil {
		return nil, fmt.Errorf("failed to fetch task: %w", err)
	}

	t.AssigneeID = t.Assignee.ID

	if desc.Valid && strings.TrimSpace(desc.String) != "" {
		d := desc.String
		t.Description = &d
	}
	if compComment.Valid && strings.TrimSpace(compComment.String) != "" {
		cc := compComment.String
		t.CompletionComment = &cc
	}
	if completedAt.Valid {
		ca := completedAt.Time
		t.CompletedAt = &ca
	}

	if catID.Valid {
		cid := catID.String
		t.CategoryID = &cid
		t.Category = &TaskCategoryDTO{
			ID:        cid,
			Name:      catName.String,
			Color:     catColor.String,
			CreatedAt: catCreatedAt.Time,
		}
	}

	if crID.Valid {
		cid := crID.String
		t.CreatedByID = &cid
		t.CreatedBy = &StaffSummaryDTO{
			ID:        cid,
			Email:     crEmail.String,
			FirstName: crFirst.String,
			LastName:  crLast.String,
			Role:      crRole.String,
		}
	}

	return &t, nil
}

// CreateTask inserts a new task.
func (r *Repository) CreateTask(ctx context.Context, db *sql.DB, creatorID string, req *CreateTaskRequest) (*TaskDTO, error) {
	query := `
		INSERT INTO tasks (title, description, category_id, assignee_id, created_by_id, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		RETURNING id;
	`
	var id string
	err := db.QueryRowContext(ctx, query, req.Title, req.Description, req.CategoryID, req.AssigneeID, creatorID).Scan(&id)
	if err != nil {
		return nil, fmt.Errorf("failed to insert task: %w", err)
	}

	return r.GetTaskByID(ctx, db, id)
}

// UpdateTask modifies task properties.
func (r *Repository) UpdateTask(ctx context.Context, db *sql.DB, id string, req *UpdateTaskRequest) (*TaskDTO, error) {
	existing, err := r.GetTaskByID(ctx, db, id)
	if err != nil {
		return nil, err
	}
	if existing == nil {
		return nil, fmt.Errorf("task not found")
	}

	title := existing.Title
	if req.Title != nil {
		title = strings.TrimSpace(*req.Title)
	}

	description := existing.Description
	if req.Description != nil {
		description = req.Description
	}

	categoryID := existing.CategoryID
	if req.CategoryID != nil {
		categoryID = req.CategoryID
	}

	assigneeID := existing.AssigneeID
	if req.AssigneeID != nil {
		assigneeID = *req.AssigneeID
	}

	query := `
		UPDATE tasks
		SET title = $1, description = $2, category_id = $3, assignee_id = $4, updated_at = CURRENT_TIMESTAMP
		WHERE id = $5;
	`
	_, err = db.ExecContext(ctx, query, title, description, categoryID, assigneeID, id)
	if err != nil {
		return nil, fmt.Errorf("failed to update task: %w", err)
	}

	return r.GetTaskByID(ctx, db, id)
}

// CompleteTask transitions status to 'completed' and records audit proof.
func (r *Repository) CompleteTask(ctx context.Context, db *sql.DB, id string, comment string) (*TaskDTO, error) {
	query := `
		UPDATE tasks
		SET status = 'completed', completion_comment = $1, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
		WHERE id = $2;
	`
	res, err := db.ExecContext(ctx, query, comment, id)
	if err != nil {
		return nil, fmt.Errorf("failed to complete task: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return nil, fmt.Errorf("task not found")
	}

	return r.GetTaskByID(ctx, db, id)
}

// DeleteTask removes the task record.
func (r *Repository) DeleteTask(ctx context.Context, db *sql.DB, id string) error {
	res, err := db.ExecContext(ctx, `DELETE FROM tasks WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("failed to delete task: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return fmt.Errorf("task not found")
	}
	return nil
}
