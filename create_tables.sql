-- Create installations table for storing OAuth tokens
CREATE TABLE IF NOT EXISTS installations (
    id SERIAL PRIMARY KEY,
    location_id VARCHAR(255) UNIQUE NOT NULL,
    user_id VARCHAR(255),
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_installations_location_id ON installations(location_id);
CREATE INDEX IF NOT EXISTS idx_installations_expires_at ON installations(expires_at);

-- Add comments for documentation
COMMENT ON TABLE installations IS 'Stores OAuth tokens for GoHighLevel integrations';
COMMENT ON COLUMN installations.location_id IS 'GoHighLevel location identifier';
COMMENT ON COLUMN installations.user_id IS 'GoHighLevel user identifier (optional)';
COMMENT ON COLUMN installations.access_token IS 'Encrypted OAuth access token';
COMMENT ON COLUMN installations.refresh_token IS 'Encrypted OAuth refresh token';
COMMENT ON COLUMN installations.expires_at IS 'Token expiration timestamp';