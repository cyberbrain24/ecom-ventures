-- Ecom Ventures: Initial Central Platform Database Setup Script
-- Executed on initial container bootstrap

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Set timezone to UTC across the platform cluster
SET timezone = 'UTC';

-- Baseline schema creation confirmation table
CREATE TABLE IF NOT EXISTS platform_initialization_status (
    id SERIAL PRIMARY KEY,
    initialized_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    cluster_version VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL
);

INSERT INTO platform_initialization_status (cluster_version, status)
VALUES ('PostgreSQL 16 Alpine', 'READY');
