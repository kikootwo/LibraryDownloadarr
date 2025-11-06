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
      const userServerUrl = req.user?.serverUrl;
      const isAdmin = req.user?.isAdmin;
      const adminToken = db.getSetting('plex_token') || undefined;
      const adminUrl = db.getSetting('plex_url') || '';

      let token: string | undefined;
      let serverUrl: string;

      // If user has both their own token and serverUrl, use them
      if (userToken && userServerUrl) {
        token = userToken;
        serverUrl = userServerUrl;
      } else if (isAdmin) {
        // Only admins can fall back to admin credentials
        token = adminToken;
        serverUrl = adminUrl;
      } else {
        // Non-admin user without their own credentials = no access
        return res.status(403).json({
          error: 'Access denied. Please log out and log in again to configure your Plex access.'
        });
      }

      logger.info('Getting libraries', {
        hasUserToken: !!userToken,
        hasUserServerUrl: !!userServerUrl,
        hasAdminToken: !!adminToken,
        hasAdminUrl: !!adminUrl,
        usingUserCreds: !!(userToken && userServerUrl),
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

      const userToken = req.user?.plexToken;
      const userServerUrl = req.user?.serverUrl;
      const isAdmin = req.user?.isAdmin;
      const adminToken = db.getSetting('plex_token') || undefined;
      const adminUrl = db.getSetting('plex_url') || '';

      let token: string | undefined;
      let serverUrl: string;

      if (userToken && userServerUrl) {
        token = userToken;
        serverUrl = userServerUrl;
      } else if (isAdmin) {
        token = adminToken;
        serverUrl = adminUrl;
      } else {
        return res.status(403).json({
          error: 'Access denied. Please log out and log in again to configure your Plex access.'
        });
      }

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
