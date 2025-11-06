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
      // Use user's token and server URL if available, otherwise fall back to admin
      const userToken = req.user?.plexToken;
      const userServerUrl = req.user?.serverUrl;
      const adminToken = db.getSetting('plex_token') || undefined;
      const adminUrl = db.getSetting('plex_url') || '';

      // Determine which credentials to use
      const token = userToken || adminToken;
      const serverUrl = userServerUrl || adminUrl;

      logger.info('Getting libraries', {
        hasUserToken: !!userToken,
        hasUserServerUrl: !!userServerUrl,
        hasAdminToken: !!adminToken,
        hasAdminUrl: !!adminUrl,
        usingUserCreds: !!userToken,
        serverUrl: serverUrl || 'NOT SET',
        userId: req.user?.id,
        username: req.user?.username,
        isAdmin: req.user?.isAdmin
      });

      if (!token || !serverUrl) {
        return res.status(500).json({ error: 'Plex server not configured' });
      }

      // Set the server connection with the appropriate URL and token
      plexService.setServerConnection(serverUrl, token);

      // Call getLibraries (it will use the connection we just set)
      const libraries = await plexService.getLibraries(token);
      return res.json({ libraries });
    } catch (error: any) {
      logger.error('Failed to get libraries', {
        error: error.message,
        stack: error.stack,
        hasUserToken: !!req.user?.plexToken,
        hasUserServerUrl: !!req.user?.serverUrl,
        hasAdminToken: !!db.getSetting('plex_token'),
        hasAdminUrl: !!db.getSetting('plex_url')
      });
      return res.status(500).json({ error: 'Failed to get libraries' });
    }
  });

  // Get library content
  router.get('/:libraryKey/content', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { libraryKey } = req.params;
      const { viewType } = req.query;

      // Use user's token and server URL if available, otherwise fall back to admin
      const userToken = req.user?.plexToken;
      const userServerUrl = req.user?.serverUrl;
      const adminToken = db.getSetting('plex_token') || undefined;
      const adminUrl = db.getSetting('plex_url') || '';

      const token = userToken || adminToken;
      const serverUrl = userServerUrl || adminUrl;

      if (!token || !serverUrl) {
        return res.status(500).json({ error: 'Plex server not configured' });
      }

      plexService.setServerConnection(serverUrl, token);

      const content = await plexService.getLibraryContent(
        libraryKey,
        token,
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
