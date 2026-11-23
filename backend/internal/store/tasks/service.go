package tasks

import (
	"context"
	"database/sql"
	"errors"
	"strings"
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) ListCategories(ctx context.Context, db *sql.DB) ([]TaskCategoryDTO, error) {
	return s.repo.ListCategories(ctx, db)
}

func (s *Service) CreateCategory(ctx context.Context, db *sql.DB, req *CreateCategoryRequest) (*TaskCategoryDTO, error) {
	name := strings.TrimSpace(req.Name)
	if name == "" {
		return nil, errors.New("category name is required")
	}
	color := strings.TrimSpace(req.Color)
	if color == "" {
		color = "#3b82f6"
	}
	return s.repo.CreateCategory(ctx, db, name, color)
}

func (s *Service) ListTasks(ctx context.Context, db *sql.DB, assigneeID, status, categoryID string) ([]TaskDTO, error) {
	return s.repo.ListTasks(ctx, db, assigneeID, status, categoryID)
}

func (s *Service) GetTask(ctx context.Context, db *sql.DB, id string) (*TaskDTO, error) {
	return s.repo.GetTaskByID(ctx, db, id)
}

func (s *Service) CreateTask(ctx context.Context, db *sql.DB, creatorID string, req *CreateTaskRequest) (*TaskDTO, error) {
	title := strings.TrimSpace(req.Title)
	if title == "" {
		return nil, errors.New("task title is required")
	}
	req.Title = title

	if strings.TrimSpace(req.AssigneeID) == "" {
		return nil, errors.New("assignee staff member is required")
	}

	return s.repo.CreateTask(ctx, db, creatorID, req)
}

func (s *Service) UpdateTask(ctx context.Context, db *sql.DB, id string, req *UpdateTaskRequest) (*TaskDTO, error) {
	if req.Title != nil {
		t := strings.TrimSpace(*req.Title)
		if t == "" {
			return nil, errors.New("task title cannot be empty")
		}
		req.Title = &t
	}
	return s.repo.UpdateTask(ctx, db, id, req)
}

func (s *Service) CompleteTask(ctx context.Context, db *sql.DB, id string, comment string) (*TaskDTO, error) {
	cleanComment := strings.TrimSpace(comment)
	if cleanComment == "" {
		return nil, errors.New("completion comment / audit proof note is required")
	}
	return s.repo.CompleteTask(ctx, db, id, cleanComment)
}

func (s *Service) DeleteTask(ctx context.Context, db *sql.DB, id string) error {
	return s.repo.DeleteTask(ctx, db, id)
}
