const express = require('express');
const { AuthorizationCode } = require('simple-oauth2');
const { Pool } = require('pg');
const crypto = require('crypto');
const axios = require('axios');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// OAuth2 configuration
const oauth2 = new AuthorizationCode({
  client: {
    id: process.env.HL_CLIENT_ID,
    secret: process.env.HL_CLIENT_SECRET
  },
  auth: {
    tokenHost: 'https://services.leadconnectorhq.com',
    tokenPath: '/oauth/token',
    authorizePath: '/oauth/chooselocation'
  }
});

// Encryption helpers
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const ALGORITHM = 'aes-256-gcm';

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipher(ALGORITHM, ENCRYPTION_KEY);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

function decrypt(encryptedData) {
  const parts = encryptedData.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  const decipher = crypto.createDecipher(ALGORITHM, ENCRYPTION_KEY);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'GoHighLevel OAuth Server',
    status: 'running',
    endpoints: {
      authorize: '/oauth/authorize',
      callback: '/oauth/callback',
      disconnect: '/oauth/disconnect',
      proxy: '/proxy/hl/*'
    }
  });
});

// OAuth authorization endpoint
app.get('/oauth/authorize', (req, res) => {
  const { locationId, userId } = req.query;
  
  if (!locationId) {
    return res.status(400).json({ error: 'locationId is required' });
  }

  const authorizationUri = oauth2.authorizeURL({
    redirect_uri: process.env.REDIRECT_URI || process.env.HL_REDIRECT_URL,
    scope: process.env.HL_SCOPES || 'contacts.readonly calendars.read',
    state: JSON.stringify({ locationId, userId })
  });

  res.redirect(authorizationUri);
});

// OAuth callback endpoint
app.get('/oauth/callback', async (req, res) => {
  const { code, state } = req.query;

  if (!code) {
    return res.status(400).json({ error: 'Authorization code is required' });
  }

  try {
    const { locationId, userId } = JSON.parse(state || '{}');

    // Exchange code for token
    const result = await oauth2.getToken({
      code,
      redirect_uri: process.env.REDIRECT_URI || process.env.HL_REDIRECT_URL,
      scope: process.env.HL_SCOPES || 'contacts.readonly calendars.read'
    });

    const accessToken = result.token;

    // Encrypt tokens before storing
    const encryptedAccessToken = encrypt(accessToken.access_token);
    const encryptedRefreshToken = encrypt(accessToken.refresh_token);

    // Store in database
    await pool.query(
      `INSERT INTO installations (location_id, user_id, access_token, refresh_token, expires_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       ON CONFLICT (location_id) 
       DO UPDATE SET 
         access_token = $3,
         refresh_token = $4,
         expires_at = $5,
         updated_at = NOW()`,
      [
        locationId,
        userId,
        encryptedAccessToken,
        encryptedRefreshToken,
        new Date(Date.now() + (accessToken.expires_in * 1000))
      ]
    );

    res.json({ 
      success: true, 
      message: 'OAuth authorization successful',
      locationId 
    });
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).json({ error: 'OAuth authorization failed' });
  }
});

// Disconnect endpoint
app.delete('/oauth/disconnect', async (req, res) => {
  const { locationId } = req.query;

  if (!locationId) {
    return res.status(400).json({ error: 'locationId is required' });
  }

  try {
    await pool.query('DELETE FROM installations WHERE location_id = $1', [locationId]);
    res.json({ success: true, message: 'OAuth connection removed' });
  } catch (error) {
    console.error('Disconnect error:', error);
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

// Proxy endpoint for HL API calls
app.all('/proxy/hl/*', async (req, res) => {
  const { locationId } = req.query;
  
  if (!locationId) {
    return res.status(400).json({ error: 'locationId is required' });
  }

  try {
    // Get stored tokens
    const result = await pool.query(
      'SELECT access_token, refresh_token, expires_at FROM installations WHERE location_id = $1',
      [locationId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No OAuth connection found for this location' });
    }

    let { access_token, refresh_token, expires_at } = result.rows[0];
    
    // Decrypt tokens
    access_token = decrypt(access_token);
    refresh_token = decrypt(refresh_token);

    // Check if token needs refresh
    if (new Date() >= new Date(expires_at)) {
      try {
        const refreshResult = await oauth2.getToken({
          grant_type: 'refresh_token',
          refresh_token
        });

        const newToken = refreshResult.token;
        access_token = newToken.access_token;
        
        // Update stored tokens
        await pool.query(
          `UPDATE installations 
           SET access_token = $1, refresh_token = $2, expires_at = $3, updated_at = NOW()
           WHERE location_id = $4`,
          [
            encrypt(newToken.access_token),
            encrypt(newToken.refresh_token || refresh_token),
            new Date(Date.now() + (newToken.expires_in * 1000)),
            locationId
          ]
        );
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        return res.status(401).json({ error: 'Token refresh failed, re-authorization required' });
      }
    }

    // Make API call to HighLevel
    const apiPath = req.path.replace('/proxy/hl', '');
    const apiUrl = `${process.env.HL_API_BASE_URL}${apiPath}`;
    
    const apiResponse = await axios({
      method: req.method,
      url: apiUrl,
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Version': process.env.HL_API_VERSION || '2021-07-28',
        'Content-Type': 'application/json',
        ...req.headers
      },
      data: req.body,
      params: { ...req.query, locationId: undefined } // Remove locationId from forwarded params
    });

    res.json(apiResponse.data);
  } catch (error) {
    console.error('Proxy error:', error);
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({ error: 'Proxy request failed' });
    }
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Start server
app.listen(port, () => {
  console.log(`GoHighLevel OAuth server running on port ${port}`);
});