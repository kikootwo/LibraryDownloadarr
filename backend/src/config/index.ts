import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  server: {
    port: parseInt(process.env.PORT || '5069', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    baseUrl: process.env.BASE_URL || 'http://localhost:5069',
  },
  plex: {
    url: process.env.PLEX_URL || '',
    token: process.env.PLEX_TOKEN || '',
    clientIdentifier: 'plexdownloadarr',
    product: 'PlexDownloadarr',
    version: '1.0.0',
    device: 'Server',
  },
  security: {
    jwtSecret: process.env.JWT_SECRET || 'change-this-secret-in-production',
    sessionSecret: process.env.SESSION_SECRET || 'change-this-session-secret-in-production',
    sessionMaxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
  database: {
    path: process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'plexdownloadarr.db'),
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // limit each IP to 1000 requests per windowMs (much more reasonable)
  },
};
