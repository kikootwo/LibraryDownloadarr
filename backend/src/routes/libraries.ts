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
      const libraries = await plexService.getLibraries(userToken);
      return res.json({ libraries });
    } catch (error) {
      logger.error('Failed to get libraries', { error });
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
