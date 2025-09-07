# GoHighLevel Direct OAuth Integration

🚀 A production-ready Node.js server for GoHighLevel OAuth integration without Nango dependency.

## Features

- ✅ Direct GoHighLevel OAuth 2.0 implementation
- 🔐 Secure token encryption and storage
- 🔄 Automatic token refresh
- 🗄️ Dual database support (PostgreSQL for production, SQLite for development)
- 🌐 CORS-enabled API proxy
- 🛡️ Production-ready security
- 🚂 Railway deployment ready

## Quick Start

### Local Development

1. **Clone and install:**
   ```bash
   git clone https://github.com/EngageAutomations/oauth-highlevel-direct.git
   cd oauth-highlevel-direct
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your GoHighLevel credentials
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```

### Production Deployment (Railway)

1. **Deploy to Railway:**
   - Connect this GitHub repository to Railway
   - Railway will auto-detect Node.js and deploy

2. **Set environment variables in Railway:**
   ```
   NODE_ENV=production
   HL_CLIENT_ID=your_highlevel_client_id
   HL_CLIENT_SECRET=your_highlevel_client_secret
   REDIRECT_URI=https://your-app.up.railway.app/oauth/callback
   DATABASE_URL=postgresql://... (Railway PostgreSQL)
   ENCRYPTION_KEY=your_secure_random_key
   ```

3. **Add PostgreSQL addon in Railway dashboard**

## API Endpoints

### OAuth Flow
- `GET /oauth/callback` - OAuth callback handler
- `DELETE /oauth/disconnect/:locationId` - Disconnect integration

### API Proxy
- `ALL /proxy/hl/*` - Proxy to GoHighLevel API with automatic authentication
  - Requires `x-location-id` header
  - Handles token refresh automatically

### Utilities
- `GET /health` - Health check endpoint
- `GET /` - Server info and available endpoints

## Usage Example

```javascript
// Make authenticated API calls through the proxy
const response = await fetch('https://your-app.up.railway.app/proxy/hl/locations', {
  headers: {
    'x-location-id': 'your_location_id',
    'Content-Type': 'application/json'
  }
});

const data = await response.json();
```

## Architecture

- **Database**: Automatic PostgreSQL (production) / SQLite (development)
- **Security**: AES-256-CBC token encryption
- **OAuth**: Direct implementation with `simple-oauth2`
- **API**: Express.js with CORS support
- **Deployment**: Railway-optimized with health checks

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NODE_ENV` | Environment (production/development) | Yes |
| `HL_CLIENT_ID` | GoHighLevel OAuth Client ID | Yes |
| `HL_CLIENT_SECRET` | GoHighLevel OAuth Client Secret | Yes |
| `REDIRECT_URI` | OAuth callback URL | Yes |
| `DATABASE_URL` | PostgreSQL connection string | Production |
| `ENCRYPTION_KEY` | Token encryption key | Yes |
| `PORT` | Server port (default: 3000) | No |

## Security Features

- 🔐 All tokens encrypted before database storage
- 🛡️ Secure token refresh mechanism
- 🌐 CORS protection
- 🔍 Input validation and error handling
- 📊 Health monitoring

## Railway Deployment

This repository is optimized for Railway deployment:

1. **Connect Repository**: Link this GitHub repo to Railway
2. **Auto-Detection**: Railway automatically detects Node.js
3. **Add PostgreSQL**: Add PostgreSQL service in Railway dashboard
4. **Environment Variables**: Set all required variables in Railway settings
5. **Deploy**: Railway handles the rest automatically

### Railway Environment Setup

```bash
# Required for Railway deployment
NODE_ENV=production
HL_CLIENT_ID=your_ghl_client_id
HL_CLIENT_SECRET=your_ghl_client_secret
REDIRECT_URI=https://your-railway-app.up.railway.app/oauth/callback
DATABASE_URL=${{Postgres.DATABASE_URL}}  # Railway PostgreSQL
ENCRYPTION_KEY=your_32_character_random_key
```

## GoHighLevel OAuth Setup

1. **Create OAuth App** in GoHighLevel:
   - Go to Settings → Integrations → OAuth Apps
   - Create new OAuth application
   - Set redirect URI to your Railway URL + `/oauth/callback`

2. **Configure Scopes**:
   - `contacts.readonly`
   - `calendars.read`
   - `locations.readonly`
   - `users.readonly`
   - Add other scopes as needed

3. **Get Credentials**:
   - Copy Client ID and Client Secret
   - Add to Railway environment variables

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
- Create an issue in this repository
- Check the Railway deployment logs
- Verify environment variables are set correctly