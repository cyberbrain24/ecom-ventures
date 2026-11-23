import { authorizedRequest } from './api';
import type {
  StoreTask,
  TaskCategory,
  CreateTaskRequest,
  UpdateTaskRequest,
  CompleteTaskRequest,
  CreateCategoryRequest,
  StoreStaff,
} from '../types/store';

/**
 * Fetch all task categories with active task counters.
 */
export async function fetchTaskCategories(): Promise<TaskCategory[]> {
  return await authorizedRequest<TaskCategory[]>('/tasks/categories', { method: 'GET' });
}

/**
 * Create a new task category.
 */
export async function createTaskCategory(payload: CreateCategoryRequest): Promise<TaskCategory> {
  return await authorizedRequest<TaskCategory>('/tasks/categories', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * List tasks with optional filtering by assignee, status, or category.
 */
export async function fetchTasks(params?: {
  assignee_id?: string;
  status?: string;
  category_id?: string;
}): Promise<StoreTask[]> {
  const query = new URLSearchParams();
  if (params?.assignee_id && params.assignee_id !== 'all') {
    query.set('assignee_id', params.assignee_id);
  }
  if (params?.status) {
    query.set('status', params.status);
  }
  if (params?.category_id) {
    query.set('category_id', params.category_id);
  }

  const qs = query.toString();
  const path = qs ? `/tasks?${qs}` : '/tasks';
  return await authorizedRequest<StoreTask[]>(path, { method: 'GET' });
}

/**
 * Fetch a single task by ID.
 */
export async function fetchTaskById(id: string): Promise<StoreTask> {
  return await authorizedRequest<StoreTask>(`/tasks/${encodeURIComponent(id)}`, { method: 'GET' });
}

/**
 * Create / assign a new task.
 */
export async function createStoreTask(payload: CreateTaskRequest): Promise<StoreTask> {
  return await authorizedRequest<StoreTask>('/tasks', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Update an existing task.
 */
export async function updateStoreTask(id: string, payload: UpdateTaskRequest): Promise<StoreTask> {
  return await authorizedRequest<StoreTask>(`/tasks/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

/**
 * Complete a task with mandatory completion comment / audit proof.
 */
export async function completeStoreTask(id: string, payload: CompleteTaskRequest): Promise<StoreTask> {
  return await authorizedRequest<StoreTask>(`/tasks/${encodeURIComponent(id)}/complete`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

/**
 * Delete a task record (Manager / Admin).
 */
export async function deleteStoreTask(id: string): Promise<void> {
  await authorizedRequest<{ message: string }>(`/tasks/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

/**
 * Fetch all active store staff members for task assignment.
 */
export async function fetchStoreStaffMembers(): Promise<StoreStaff[]> {
  return await authorizedRequest<StoreStaff[]>('/staff', { method: 'GET' });
}
