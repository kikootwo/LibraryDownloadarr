import { Router } from 'express';
import { DatabaseService } from '../models/database';
import { plexService } from '../services/plexService';
import { logger } from '../utils/logger';
import { AuthRequest, createAuthMiddleware } from '../middleware/auth';
import axios from 'axios';

export const createMediaRouter = (db: DatabaseService) => {
  const router = Router();
  const authMiddleware = createAuthMiddleware(db);

  // Get recently added media
  router.get('/recently-added', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;

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
      const media = await plexService.getRecentlyAdded(token, limit);
      return res.json({ media });
    } catch (error) {
      logger.error('Failed to get recently added', { error });
      return res.status(500).json({ error: 'Failed to get recently added media' });
    }
  });

  // Get download history (user's own downloads)
  router.get('/download-history', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const history = db.getDownloadHistory(req.user!.id, limit);
      return res.json({ history });
    } catch (error) {
      logger.error('Failed to get download history', { error });
      return res.status(500).json({ error: 'Failed to get download history' });
    }
  });

  // Get all download history (admin only - shows all users' downloads)
  router.get('/download-history/all', authMiddleware, async (req: AuthRequest, res) => {
    try {
      // Only admins can view all downloads
      if (!req.user?.isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const history = db.getAllDownloadHistory(limit);
      return res.json({ history });
    } catch (error) {
      logger.error('Failed to get all download history', { error });
      return res.status(500).json({ error: 'Failed to get all download history' });
    }
  });

  // Get download stats (global for all users)
  router.get('/download-stats', authMiddleware, async (_req: AuthRequest, res) => {
    try {
      // Get stats for all users (don't pass userId)
      const stats = db.getDownloadStats();
      return res.json({ stats });
    } catch (error) {
      logger.error('Failed to get download stats', { error });
      return res.status(500).json({ error: 'Failed to get download stats' });
    }
  });

  // Search media
  router.get('/search', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { q } = req.query;
      if (!q || typeof q !== 'string') {
        return res.status(400).json({ error: 'Search query is required' });
      }

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
      const results = await plexService.search(q, token);
      return res.json({ results });
    } catch (error) {
      logger.error('Search failed', { error });
      return res.status(500).json({ error: 'Search failed' });
    }
  });

  // Get media metadata
  router.get('/:ratingKey', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { ratingKey } = req.params;

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
      const metadata = await plexService.getMediaMetadata(ratingKey, token);
      return res.json({ metadata });
    } catch (error) {
      logger.error('Failed to get media metadata', { error });
      return res.status(500).json({ error: 'Failed to get media metadata' });
    }
  });

  // Get seasons for a TV show
  router.get('/:ratingKey/seasons', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { ratingKey } = req.params;

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
      const seasons = await plexService.getSeasons(ratingKey, token);
      return res.json({ seasons });
    } catch (error) {
      logger.error('Failed to get seasons', { error });
      return res.status(500).json({ error: 'Failed to get seasons' });
    }
  });

  // Get episodes for a season
  router.get('/:ratingKey/episodes', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { ratingKey } = req.params;

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
      const episodes = await plexService.getEpisodes(ratingKey, token);
      return res.json({ episodes });
    } catch (error) {
      logger.error('Failed to get episodes', { error });
      return res.status(500).json({ error: 'Failed to get episodes' });
    }
  });

  // Get tracks for an album
  router.get('/:ratingKey/tracks', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { ratingKey } = req.params;

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
      const tracks = await plexService.getTracks(ratingKey, token);
      return res.json({ tracks });
    } catch (error) {
      logger.error('Failed to get tracks', { error });
      return res.status(500).json({ error: 'Failed to get tracks' });
    }
  });

  // Download media
  router.get('/:ratingKey/download', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { ratingKey } = req.params;
      const { partKey } = req.query;

      if (!partKey || typeof partKey !== 'string') {
        return res.status(400).json({ error: 'Part key is required' });
      }

      const userToken = req.user?.plexToken;
      const userServerUrl = req.user?.serverUrl;
      const adminToken = db.getSetting('plex_token') || undefined;
      const adminUrl = db.getSetting('plex_url') || '';

      const token = userToken || adminToken;
      const serverUrl = userServerUrl || adminUrl;

      if (!token || !serverUrl) {
        return res.status(401).json({ error: 'Plex token required - configure in settings' });
      }

      plexService.setServerConnection(serverUrl, token);

      const metadata = await plexService.getMediaMetadata(ratingKey, token);
      const downloadUrl = plexService.getDownloadUrl(partKey, token);

      // Stream the file through our server
      const response = await axios({
        method: 'GET',
        url: downloadUrl,
        responseType: 'stream',
      });

      // Get file size from response headers (works for all media types)
      const fileSize = response.headers['content-length']
        ? parseInt(response.headers['content-length'], 10)
        : undefined;

      // Log the download with actual file size
      db.logDownload(
        req.user!.id,
        metadata.title,
        ratingKey,
        fileSize
      );

      // Set headers for download
      const filename = metadata.Media?.[0]?.Part?.[0]?.file.split('/').pop() || 'download';
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', response.headers['content-type'] || 'application/octet-stream');
      if (fileSize) {
        res.setHeader('Content-Length', fileSize.toString());
      }

      response.data.pipe(res);

      logger.info(`Download started for ${metadata.title} by user ${req.user?.username}`);
      return;
    } catch (error) {
      logger.error('Download failed', { error });
      if (!res.headersSent) {
        return res.status(500).json({ error: 'Download failed' });
      }
      return;
    }
  });

  // Get thumbnail/poster proxy
  // Support both Authorization header and query parameter token for image requests
  router.get('/thumb/:ratingKey', async (req: AuthRequest, res) => {
    try {
      const { path, token } = req.query;

      if (!path || typeof path !== 'string') {
        return res.status(400).json({ error: 'Thumbnail path is required' });
      }

      // Check authentication from query parameter first (for <img> tags), then from header
      let user = req.user;
      if (!user && token && typeof token === 'string') {
        const session = db.getSessionByToken(token);
        if (session) {
          const adminUser = db.getAdminUserById(session.userId);
          if (adminUser) {
            user = {
              id: adminUser.id,
              username: adminUser.username,
              isAdmin: adminUser.isAdmin,
            };
          } else {
            const plexUser = db.getPlexUserById(session.userId);
            if (plexUser) {
              user = {
                id: plexUser.id,
                username: plexUser.username,
                isAdmin: plexUser.isAdmin,
                plexToken: plexUser.plexToken,
                serverUrl: plexUser.serverUrl,
              };
            }
          }
        }
      }

      if (!user) {
        return res.status(401).json({ error: 'No token provided' });
      }

      // Use user's token and server URL if available, otherwise fall back to admin
      const userToken = user.plexToken;
      const userServerUrl = user.serverUrl;
      const adminToken = db.getSetting('plex_token') || undefined;
      const adminUrl = db.getSetting('plex_url') || '';

      const plexToken = userToken || adminToken;
      const serverUrl = userServerUrl || adminUrl;

      if (!plexToken || !serverUrl) {
        return res.status(401).json({ error: 'Plex token required - configure in settings' });
      }

      const thumbUrl = plexService.getThumbnailUrl(path, plexToken);
      const response = await axios({
        method: 'GET',
        url: thumbUrl,
        responseType: 'stream',
      });

      res.setHeader('Content-Type', response.headers['content-type'] || 'image/jpeg');
      if (response.headers['content-length']) {
        res.setHeader('Content-Length', response.headers['content-length']);
      }

      response.data.pipe(res);
      return;
    } catch (error) {
      logger.error('Thumbnail proxy failed', { error });
      if (!res.headersSent) {
        return res.status(500).json({ error: 'Failed to load thumbnail' });
      }
      return;
    }
  });

  return router;
};
