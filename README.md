# GoHighLevel Direct OAuth Integration

A secure, self-hosted OAuth server for GoHighLevel API integration with PostgreSQL token storage.

## Features

- **Direct OAuth Flow**: No third-party dependencies like Nango
- **Secure Token Storage**: Encrypted tokens in PostgreSQL database
- **Automatic Token Refresh**: Handles token expiration seamlessly
- **API Proxy**: Secure proxy endpoint for HighLevel API calls
- **Railway Ready**: Optimized for Railway deployment

## Quick Start

### 1. Environment Setup

Copy `.env.production` and configure your variables:

```bash
# GoHighLevel OAuth Configuration
HL_CLIENT_ID=your_client_id
HL_CLIENT_SECRET=your_client_secret
REDIRECT_URI=https://your-domain.com/oauth/callback

# Database (Railway will provide this)
DATABASE_URL=postgresql://...

# Security
ENCRYPTION_KEY=your_secure_encryption_key
```

### 2. Database Setup

Run the SQL schema on your PostgreSQL database:

```sql
-- See create_tables.sql for complete schema
CREATE TABLE installations (
    id SERIAL PRIMARY KEY,
    location_id VARCHAR(255) UNIQUE NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 3. Deploy to Railway

1. Connect this repository to Railway
2. Add PostgreSQL service
3. Configure environment variables
4. Deploy!

## API Endpoints

### OAuth Flow

- `GET /oauth/authorize?locationId=xxx` - Start OAuth flow
- `GET /oauth/callback` - OAuth callback (configured in HL)
- `DELETE /oauth/disconnect?locationId=xxx` - Remove connection

### API Proxy

- `GET|POST|PUT|DELETE /proxy/hl/*?locationId=xxx` - Proxy to HighLevel API

Example:
```bash
# Get contacts for a location
GET /proxy/hl/contacts?locationId=abc123

# Create contact
POST /proxy/hl/contacts?locationId=abc123
```

## HighLevel Developer Portal Setup

1. Create OAuth App in HighLevel Developer Portal
2. Set redirect URI to: `https://your-domain.com/oauth/callback`
3. Configure required scopes
4. Copy Client ID and Secret to environment variables

## Security Features

- **Token Encryption**: All tokens encrypted at rest using AES-256-GCM
- **Automatic Refresh**: Tokens refreshed automatically before expiration
- **Secure Headers**: Proper security headers and HTTPS enforcement
- **Input Validation**: All inputs validated and sanitized

## Development

```bash
npm install
npm run dev  # Uses nodemon for auto-reload
```

## Production Deployment

```bash
npm start
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `HL_CLIENT_ID` | GoHighLevel OAuth Client ID | Yes |
| `HL_CLIENT_SECRET` | GoHighLevel OAuth Client Secret | Yes |
| `REDIRECT_URI` | OAuth callback URL | Yes |
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `ENCRYPTION_KEY` | Token encryption key | Yes |
| `HL_SCOPES` | OAuth scopes (comma-separated) | No |
| `PORT` | Server port | No (default: 3000) |

## License

MIT License - see LICENSE file for details.