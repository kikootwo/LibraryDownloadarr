import { Router } from 'express';
import { DatabaseService } from '../models/database';
import { plexService } from '../services/plexService';
import { logger } from '../utils/logger';
import { AuthRequest, createAuthMiddleware } from '../middleware/auth';

export const createLibrariesRouter = (db: DatabaseService) => {
  const router = Router();
  const authMiddleware = createAuthMiddleware(db);

  // Get all libraries
  router.get('/', authMiddleware, async (req: AuthRequest, res) => {
    try {
      // Always use admin token for server access
      // User's token is just for authentication/identity
      const adminToken = db.getSetting('plex_token') || undefined;
      const plexUrl = db.getSetting('plex_url') || '';

      logger.info('Getting libraries', {
        hasUserToken: !!req.user?.plexToken,
        hasAdminToken: !!adminToken,
        hasPlexUrl: !!plexUrl,
        plexUrl: plexUrl || 'NOT SET',
        userId: req.user?.id,
        username: req.user?.username,
        isAdmin: req.user?.isAdmin
      });

      if (!adminToken || !plexUrl) {
        return res.status(500).json({ error: 'Plex server not configured' });
      }

      // Make sure PlexService has the current URL and admin token
      plexService.setServerConnection(plexUrl, adminToken);

      // Pass undefined to use admin token (don't pass user token)
      const libraries = await plexService.getLibraries(undefined);
      return res.json({ libraries });
    } catch (error: any) {
      logger.error('Failed to get libraries', {
        error: error.message,
        stack: error.stack,
        hasUserToken: !!req.user?.plexToken,
        hasAdminToken: !!db.getSetting('plex_token'),
        hasPlexUrl: !!db.getSetting('plex_url')
      });
      return res.status(500).json({ error: 'Failed to get libraries' });
    }
  });

  // Get library content
  router.get('/:libraryKey/content', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { libraryKey } = req.params;
      const { viewType } = req.query;
      // Always use admin token for server access
      const adminToken = db.getSetting('plex_token') || undefined;
      const content = await plexService.getLibraryContent(
        libraryKey,
        adminToken,
        viewType as string | undefined
      );
      return res.json({ content });
    } catch (error) {
      logger.error('Failed to get library content', { error });
      return res.status(500).json({ error: 'Failed to get library content' });
    }
  });

  return router;
};
