-- 000029_task_management_system.up.sql
-- Task Management Workstation Architecture: Task Categories & Staff Tasks

CREATE TABLE IF NOT EXISTS task_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    color VARCHAR(20) NOT NULL DEFAULT '#3b82f6',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seed standard operational departments for streetwear e-commerce
INSERT INTO task_categories (name, color) VALUES
    ('Inventory Audit', '#ef4444'),
    ('Customer Support', '#3b82f6'),
    ('Packaging & Dispatch', '#f59e0b'),
    ('Marketing Creatives', '#8b5cf6'),
    ('Order Pulse Follow-Up', '#10b981')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category_id UUID REFERENCES task_categories(id) ON DELETE SET NULL,
    assignee_id UUID NOT NULL REFERENCES store_staff(id) ON DELETE CASCADE,
    created_by_id UUID REFERENCES store_staff(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    completion_comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tasks_status_assignee ON tasks(status, assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(category_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC);
