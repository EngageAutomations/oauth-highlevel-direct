const express = require('express');
const axios = require('axios');
const { AuthorizationCode } = require('simple-oauth2');
const crypto = require('crypto');
const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, x-location-id');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// OAuth2 Configuration
const oauth2Config = {
  client: {
    id: process.env.HL_CLIENT_ID,
    secret: process.env.HL_CLIENT_SECRET,
  },
  auth: {
    tokenHost: 'https://services.leadconnectorhq.com',
    tokenPath: '/oauth/token',
    authorizePath: '/oauth/chooselocation',
  },
};

const client = new AuthorizationCode(oauth2Config);

// Database setup - conditional for local vs production
let db;
if (process.env.NODE_ENV === 'production' && process.env.DATABASE_URL) {
  // PostgreSQL for production
  db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
} else {
  // SQLite for local development
  db = new sqlite3.Database('./oauth.db');
}

// Encryption functions
function encrypt(text) {
  const algorithm = 'aes-256-cbc';
  const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'default-key', 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipher(algorithm, key);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text) {
  const algorithm = 'aes-256-cbc';
  const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'default-key', 'salt', 32);
  const textParts = text.split(':');
  const iv = Buffer.from(textParts.shift(), 'hex');
  const encryptedText = textParts.join(':');
  const decipher = crypto.createDecipher(algorithm, key);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Database helper functions
async function dbQuery(query, params = []) {
  if (process.env.NODE_ENV === 'production' && process.env.DATABASE_URL) {
    // PostgreSQL
    const result = await db.query(query, params);
    return result.rows;
  } else {
    // SQLite
    return new Promise((resolve, reject) => {
      if (query.trim().toUpperCase().startsWith('SELECT')) {
        db.all(query, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      } else {
        db.run(query, params, function(err) {
          if (err) reject(err);
          else resolve([{ id: this.lastID, changes: this.changes }]);
        });
      }
    });
  }
}

// Initialize database table
async function initializeDatabase() {
  try {
    if (process.env.NODE_ENV === 'production' && process.env.DATABASE_URL) {
      // PostgreSQL
      await db.query(`
        CREATE TABLE IF NOT EXISTS installations (
          id SERIAL PRIMARY KEY,
          location_id VARCHAR(255) UNIQUE,
          agency_id VARCHAR(255),
          access_token TEXT,
          refresh_token TEXT,
          token_type VARCHAR(50) DEFAULT 'Bearer',
          expires_at TIMESTAMP,
          scope TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } else {
      // SQLite
      await new Promise((resolve, reject) => {
        db.run(`
          CREATE TABLE IF NOT EXISTS installations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            location_id TEXT UNIQUE,
            agency_id TEXT,
            access_token TEXT,
            refresh_token TEXT,
            token_type TEXT DEFAULT 'Bearer',
            expires_at TEXT,
            scope TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
    console.log('✅ Database table initialized');
  } catch (error) {
    console.error('❌ Database initialization error:', error);
  }
}

// Routes
app.get('/', (req, res) => {
  res.json({
    message: '🚀 GoHighLevel Direct OAuth Server',
    endpoints: {
      oauth_callback: '/oauth/callback',
      proxy: '/proxy/hl/*',
      disconnect: '/oauth/disconnect/:locationId',
      health: '/health'
    },
    status: 'running'
  });
});

// OAuth callback endpoint
app.get('/oauth/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    console.log('📥 OAuth callback received:', { code: code.substring(0, 10) + '...', state });

    // Exchange code for token
    const tokenParams = {
      code,
      redirect_uri: process.env.REDIRECT_URI || 'http://localhost:3000/oauth/callback',
      scope: 'contacts.readonly calendars.read campaign.readonly locations.readonly users.readonly'
    };

    const accessToken = await client.getToken(tokenParams);
    const token = accessToken.token;

    console.log('🎫 Token received:', {
      token_type: token.token_type,
      expires_in: token.expires_in,
      scope: token.scope
    });

    // Get location info from token
    const locationId = token.locationId || state;
    const agencyId = token.companyId || token.agency_id;
    
    if (!locationId) {
      return res.status(400).json({ error: 'Location ID not found in token or state' });
    }

    // Calculate expiration
    const expiresAt = new Date(Date.now() + (token.expires_in * 1000));
    
    // Encrypt tokens before storage
    const encryptedAccessToken = encrypt(token.access_token);
    const encryptedRefreshToken = encrypt(token.refresh_token);

    // Store in database
    if (process.env.NODE_ENV === 'production' && process.env.DATABASE_URL) {
      // PostgreSQL with UPSERT
      await dbQuery(`
        INSERT INTO installations (location_id, agency_id, access_token, refresh_token, token_type, expires_at, scope)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (location_id) 
        DO UPDATE SET 
          access_token = $3,
          refresh_token = $4,
          expires_at = $6,
          updated_at = CURRENT_TIMESTAMP
      `, [locationId, agencyId, encryptedAccessToken, encryptedRefreshToken, token.token_type, expiresAt, token.scope]);
    } else {
      // SQLite with INSERT OR REPLACE
      await dbQuery(`
        INSERT OR REPLACE INTO installations (location_id, agency_id, access_token, refresh_token, token_type, expires_at, scope, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `, [locationId, agencyId, encryptedAccessToken, encryptedRefreshToken, token.token_type, expiresAt.toISOString(), token.scope]);
    }

    console.log(`✅ OAuth successful for location: ${locationId}`);

    res.json({
      success: true,
      message: 'OAuth integration successful',
      locationId,
      agencyId,
      expiresAt: expiresAt.toISOString()
    });

  } catch (error) {
    console.error('❌ OAuth callback error:', error);
    res.status(500).json({ 
      error: 'OAuth callback failed', 
      details: error.message 
    });
  }
});

// Proxy endpoint for HighLevel API calls
app.all('/proxy/hl/*', async (req, res) => {
  try {
    const locationId = req.headers['x-location-id'];
    
    if (!locationId) {
      return res.status(400).json({ error: 'Location ID is required in x-location-id header' });
    }

    // Get stored tokens
    const result = await dbQuery(
      process.env.NODE_ENV === 'production' ? 
        'SELECT access_token, refresh_token, expires_at FROM installations WHERE location_id = $1' :
        'SELECT access_token, refresh_token, expires_at FROM installations WHERE location_id = ?',
      [locationId]
    );

    if (result.length === 0) {
      return res.status(404).json({ error: 'Installation not found for this location' });
    }

    let { access_token, refresh_token, expires_at } = result[0];
    
    // Decrypt tokens
    access_token = decrypt(access_token);
    refresh_token = decrypt(refresh_token);

    // Check if token needs refresh
    const now = new Date();
    const expirationDate = new Date(expires_at);
    
    if (now >= expirationDate) {
      console.log('🔄 Token expired, refreshing...');
      
      try {
        const tokenObject = client.createToken({
          access_token,
          refresh_token,
          expires_at: expirationDate.toISOString()
        });
        
        const newToken = await tokenObject.refresh();
        const newExpiresAt = new Date(Date.now() + (newToken.token.expires_in * 1000));
        
        // Update database with new tokens
        if (process.env.NODE_ENV === 'production' && process.env.DATABASE_URL) {
          await dbQuery(`
            UPDATE installations 
            SET access_token = $1, refresh_token = $2, expires_at = $3, updated_at = CURRENT_TIMESTAMP
            WHERE location_id = $4
          `, [
            encrypt(newToken.access_token),
            encrypt(newToken.refresh_token),
            newExpiresAt,
            locationId
          ]);
        } else {
          await dbQuery(`
            UPDATE installations 
            SET access_token = ?, refresh_token = ?, expires_at = ?, updated_at = datetime('now')
            WHERE location_id = ?
          `, [
            encrypt(newToken.access_token),
            encrypt(newToken.refresh_token),
            newExpiresAt.toISOString(),
            locationId
          ]);
        }

        access_token = newToken.access_token;
        console.log('✅ Token refreshed successfully');
        
      } catch (refreshError) {
        console.error('❌ Token refresh failed:', refreshError);
        return res.status(401).json({ error: 'Token refresh failed', details: refreshError.message });
      }
    }

    // Extract the API path
    const apiPath = req.path.replace('/proxy/hl', '');
    const hlApiUrl = `https://services.leadconnectorhq.com${apiPath}`;

    // Forward the request to HighLevel API
    const hlResponse = await axios({
      method: req.method,
      url: hlApiUrl,
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
        'Version': '2021-07-28'
      },
      data: req.body,
      params: req.query
    });

    res.json(hlResponse.data);

  } catch (error) {
    console.error('❌ Proxy error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: 'API request failed',
      details: error.response?.data || error.message
    });
  }
});

// Disconnect endpoint
app.delete('/oauth/disconnect/:locationId', async (req, res) => {
  try {
    const { locationId } = req.params;
    
    const result = await dbQuery(
      process.env.NODE_ENV === 'production' ? 
        'DELETE FROM installations WHERE location_id = $1' :
        'DELETE FROM installations WHERE location_id = ?',
      [locationId]
    );

    if (result.length === 0 || (result[0] && result[0].changes === 0)) {
      return res.status(404).json({ error: 'Installation not found' });
    }

    console.log(`🗑️ Disconnected location: ${locationId}`);
    res.json({ success: true, message: 'Installation disconnected successfully' });

  } catch (error) {
    console.error('❌ Disconnect error:', error);
    res.status(500).json({ error: 'Disconnect failed', details: error.message });
  }
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Test database connection
    if (process.env.NODE_ENV === 'production' && process.env.DATABASE_URL) {
      await db.query('SELECT 1');
    } else {
      await new Promise((resolve, reject) => {
        db.get('SELECT 1', (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected'
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: error.message
    });
  }
});

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 GoHighLevel OAuth Server running on port ${PORT}`);
  console.log(`📍 OAuth Callback URL: ${process.env.REDIRECT_URI || `http://localhost:${PORT}/oauth/callback`}`);
  console.log(`🔗 Proxy Endpoint: http://localhost:${PORT}/proxy/hl/*`);
  console.log(`❤️ Health Check: http://localhost:${PORT}/health`);
  
  await initializeDatabase();
});

module.exports = app;