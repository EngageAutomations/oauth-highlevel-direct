# Railway Deployment Guide

🚂 **Quick Railway Deployment for GoHighLevel OAuth Integration**

## Prerequisites

- Railway account ([railway.app](https://railway.app))
- GitHub account with this repository
- GoHighLevel OAuth app credentials

## Step-by-Step Deployment

### 1. Connect Repository to Railway

1. **Login to Railway**: Go to [railway.app](https://railway.app) and sign in
2. **New Project**: Click "New Project"
3. **Deploy from GitHub**: Select "Deploy from GitHub repo"
4. **Select Repository**: Choose `EngageAutomations/oauth-highlevel-direct`
5. **Deploy**: Railway will automatically detect Node.js and start deployment

### 2. Add PostgreSQL Database

1. **Add Service**: In your Railway project, click "+ New"
2. **Add Database**: Select "PostgreSQL"
3. **Wait for Setup**: Railway will provision the database automatically
4. **Note**: The `DATABASE_URL` will be automatically available as `${{Postgres.DATABASE_URL}}`

### 3. Configure Environment Variables

In Railway project settings → Variables, add these:

```bash
# Required Variables
NODE_ENV=production
HL_CLIENT_ID=68474924a586bce22a6e64f7-mf8icnvr
HL_CLIENT_SECRET=e816090c-81ee-4903-89e5-0b9a9d8009ae
REDIRECT_URI=https://your-railway-app.up.railway.app/oauth/callback
DATABASE_URL=${{Postgres.DATABASE_URL}}
ENCRYPTION_KEY=d1963f26-2f12-438a-be56-8cd2f0f90375-secure-key-32chars

# Optional Variables
HL_API_BASE_URL=https://services.leadconnectorhq.com
HL_API_VERSION=2021-07-28
HL_SCOPES=contacts.readonly,calendars.read,campaign.readonly,locations.readonly,users.readonly
FRONTEND_URL=https://your-railway-app.up.railway.app
```

### 4. Update GoHighLevel OAuth Settings

1. **Get Railway URL**: Copy your Railway app URL (e.g., `https://oauth-highlevel-direct-production.up.railway.app`)
2. **Update GoHighLevel**: In your GoHighLevel OAuth app settings:
   - **Redirect URI**: `https://your-railway-app.up.railway.app/oauth/callback`
   - **Allowed Origins**: `https://your-railway-app.up.railway.app`

### 5. Deploy and Test

1. **Automatic Deployment**: Railway will automatically deploy after environment variables are set
2. **Check Logs**: Monitor deployment in Railway dashboard
3. **Test Health**: Visit `https://your-railway-app.up.railway.app/health`
4. **Test OAuth**: Visit `https://your-railway-app.up.railway.app` for endpoint info

## Environment Variables Reference

| Variable | Value | Description |
|----------|-------|-------------|
| `NODE_ENV` | `production` | Environment mode |
| `HL_CLIENT_ID` | Your GHL Client ID | From GoHighLevel OAuth app |
| `HL_CLIENT_SECRET` | Your GHL Client Secret | From GoHighLevel OAuth app |
| `REDIRECT_URI` | `https://your-app.up.railway.app/oauth/callback` | OAuth callback URL |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | Railway PostgreSQL connection |
| `ENCRYPTION_KEY` | 32+ character string | For token encryption |

## Quick Copy-Paste Variables

**For Railway Environment Variables:**

```
NODE_ENV=production
HL_CLIENT_ID=68474924a586bce22a6e64f7-mf8icnvr
HL_CLIENT_SECRET=e816090c-81ee-4903-89e5-0b9a9d8009ae
REDIRECT_URI=https://oauth-highlevel-direct-production.up.railway.app/oauth/callback
DATABASE_URL=${{Postgres.DATABASE_URL}}
ENCRYPTION_KEY=d1963f26-2f12-438a-be56-8cd2f0f90375-secure-key-32chars
HL_API_BASE_URL=https://services.leadconnectorhq.com
HL_API_VERSION=2021-07-28
HL_SCOPES=contacts.readonly,calendars.read,campaign.readonly,locations.readonly,users.readonly
FRONTEND_URL=https://oauth-highlevel-direct-production.up.railway.app
```

## Troubleshooting

### Common Issues

1. **Database Connection Error**:
   - Ensure PostgreSQL service is added
   - Check `DATABASE_URL` is set to `${{Postgres.DATABASE_URL}}`

2. **OAuth Callback Error**:
   - Verify `REDIRECT_URI` matches GoHighLevel settings
   - Check Railway app URL is correct

3. **Token Encryption Error**:
   - Ensure `ENCRYPTION_KEY` is at least 32 characters
   - Use the provided key or generate a new secure one

### Logs and Monitoring

- **Railway Logs**: Check deployment and runtime logs in Railway dashboard
- **Health Check**: `GET /health` endpoint for status
- **Database**: Automatic table creation on first run

## Success Indicators

✅ **Deployment Successful** when:
- Railway shows "Deployed" status
- Health endpoint returns `{"status":"healthy","database":"connected"}`
- No errors in Railway logs
- OAuth callback URL accessible

## Next Steps

After successful deployment:
1. Test OAuth flow with a GoHighLevel location
2. Verify token storage and refresh
3. Test API proxy endpoints
4. Monitor logs for any issues

---

**Repository**: [oauth-highlevel-direct](https://github.com/EngageAutomations/oauth-highlevel-direct)
**Railway**: [railway.app](https://railway.app)
**Support**: Create an issue in this repository