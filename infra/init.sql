-- JBR Marketplace - Database Initialization Script
-- This script runs on first PostgreSQL container startup

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE jbr_marketplace TO jbr_user;

-- Log initialization
DO $$
BEGIN
    RAISE NOTICE 'JBR Marketplace database initialized successfully!';
END $$;
