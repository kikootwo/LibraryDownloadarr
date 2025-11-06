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
      const userToken = req.user?.plexToken;
      const media = await plexService.getRecentlyAdded(userToken, limit);
      return res.json({ media });
    } catch (error) {
      logger.error('Failed to get recently added', { error });
      return res.status(500).json({ error: 'Failed to get recently added media' });
    }
  });

  // Get download history
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

  // Get download stats
  router.get('/download-stats', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const stats = db.getDownloadStats(req.user!.id);
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

      const userToken = req.user?.plexToken;
      const results = await plexService.search(q, userToken);
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
      const metadata = await plexService.getMediaMetadata(ratingKey, userToken);
      return res.json({ metadata });
    } catch (error) {
      logger.error('Failed to get media metadata', { error });
      return res.status(500).json({ error: 'Failed to get media metadata' });
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
      if (!userToken) {
        return res.status(401).json({ error: 'Plex token required' });
      }

      const metadata = await plexService.getMediaMetadata(ratingKey, userToken);
      const downloadUrl = plexService.getDownloadUrl(partKey, userToken);

      // Log the download
      db.logDownload(
        req.user!.id,
        metadata.title,
        ratingKey,
        metadata.Media?.[0]?.Part?.[0]?.size
      );

      // Stream the file through our server
      const response = await axios({
        method: 'GET',
        url: downloadUrl,
        responseType: 'stream',
      });

      // Set headers for download
      const filename = metadata.Media?.[0]?.Part?.[0]?.file.split('/').pop() || 'download';
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', response.headers['content-type'] || 'application/octet-stream');
      if (response.headers['content-length']) {
        res.setHeader('Content-Length', response.headers['content-length']);
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
  router.get('/thumb/:ratingKey', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { path } = req.query;

      if (!path || typeof path !== 'string') {
        return res.status(400).json({ error: 'Thumbnail path is required' });
      }

      const userToken = req.user?.plexToken;
      if (!userToken) {
        return res.status(401).json({ error: 'Plex token required' });
      }

      const thumbUrl = plexService.getThumbnailUrl(path, userToken);
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
