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
      // Use user's Plex token if available (for Plex OAuth users)
      // Otherwise use server's admin token from settings (for admin users)
      const userToken = req.user?.plexToken || db.getSetting('plex_token') || undefined;
      const plexUrl = db.getSetting('plex_url') || '';

      logger.info('Getting libraries', {
        hasUserToken: !!req.user?.plexToken,
        hasAdminToken: !!db.getSetting('plex_token'),
        plexUrl,
        userId: req.user?.id,
        username: req.user?.username
      });

      const libraries = await plexService.getLibraries(userToken);
      return res.json({ libraries });
    } catch (error: any) {
      logger.error('Failed to get libraries', {
        error: error.message,
        stack: error.stack,
        hasUserToken: !!req.user?.plexToken,
        hasAdminToken: !!db.getSetting('plex_token')
      });
      return res.status(500).json({ error: 'Failed to get libraries' });
    }
  });

  // Get library content
  router.get('/:libraryKey/content', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { libraryKey } = req.params;
      // Use user's Plex token if available (for Plex OAuth users)
      // Otherwise use server's admin token from settings (for admin users)
      const userToken = req.user?.plexToken || db.getSetting('plex_token') || undefined;
      const content = await plexService.getLibraryContent(libraryKey, userToken);
      return res.json({ content });
    } catch (error) {
      logger.error('Failed to get library content', { error });
      return res.status(500).json({ error: 'Failed to get library content' });
    }
  });

  return router;
};
