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
      const userToken = req.user?.plexToken;
      const libraries = await plexService.getLibraries(userToken);
      res.json({ libraries });
    } catch (error) {
      logger.error('Failed to get libraries', { error });
      res.status(500).json({ error: 'Failed to get libraries' });
    }
  });

  // Get library content
  router.get('/:libraryKey/content', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { libraryKey } = req.params;
      const userToken = req.user?.plexToken;
      const content = await plexService.getLibraryContent(libraryKey, userToken);
      res.json({ content });
    } catch (error) {
      logger.error('Failed to get library content', { error });
      res.status(500).json({ error: 'Failed to get library content' });
    }
  });

  return router;
};
