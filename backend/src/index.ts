import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { config } from './config';
import { DatabaseService } from './models/database';
import { logger } from './utils/logger';
import { createAuthRouter } from './routes/auth';
import { createLibrariesRouter } from './routes/libraries';
import { createMediaRouter } from './routes/media';
import { createSettingsRouter } from './routes/settings';
import { createLogsRouter } from './routes/logs';

// Initialize database
const db = new DatabaseService(config.database.path);

// Cleanup expired sessions every hour
setInterval(() => {
  db.cleanupExpiredSessions();
}, 60 * 60 * 1000);

// Create Express app
const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // We'll configure this properly in production
  crossOriginEmbedderPolicy: false,
}));

// CORS
app.use(cors(config.cors));

// Rate limiting
const limiter = rateLimit(config.rateLimit);
app.use('/api/', limiter);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/api/health', (_req, res) => {
  return res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', createAuthRouter(db));
app.use('/api/libraries', createLibrariesRouter(db));
app.use('/api/media', createMediaRouter(db));
app.use('/api/settings', createSettingsRouter(db));
app.use('/api/logs', createLogsRouter(db));

// Serve static files (frontend)
const publicPath = path.join(__dirname, '..', 'public');
app.use(express.static(publicPath));

// SPA fallback - serve index.html for all non-API routes
app.get('*', (_req, res) => {
  return res.sendFile(path.join(publicPath, 'index.html'));
});

// Error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', { error: err });
  return res.status(500).json({ error: 'Internal server error' });
});

// Start server
const server = app.listen(config.server.port, () => {
  logger.info(`LibraryDownloadarr server started on port ${config.server.port}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    db.close();
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    db.close();
    process.exit(0);
  });
});

export { app, db };
