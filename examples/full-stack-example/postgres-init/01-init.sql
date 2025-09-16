-- Initialize the database for Better Auth example
-- This script runs automatically when the PostgreSQL container starts

-- Create the database if it doesn't exist (though it should from env vars)
-- SELECT 'CREATE DATABASE better_auth_example' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'better_auth_example')\gexec

-- Connect to the database
\c better_auth_example;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create indexes that may be useful for authentication queries
-- (Apso will create the main tables and indexes)

-- We don't need to create tables here since Apso will handle that
-- through migrations when the backend starts up

-- Log that initialization is complete
SELECT 'Database initialized for Better Auth example' as message;