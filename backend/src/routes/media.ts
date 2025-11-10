import { Router } from 'express';
import { DatabaseService } from '../models/database';
import { plexService } from '../services/plexService';
import { logger } from '../utils/logger';
import { AuthRequest, createAuthMiddleware } from '../middleware/auth';
import axios from 'axios';

export const createMediaRouter = (db: DatabaseService) => {
  const router = Router();
  const authMiddleware = createAuthMiddleware(db);

  // Helper function to format media title for download logs
  const formatMediaTitle = (metadata: any, libraryTitle?: string): string => {
    const type = metadata.type;
    const library = libraryTitle || 'Unknown Library';

    if (type === 'episode') {
      // Format: "{Library} - {ShowTitle} - {SeasonTitle} - E{##} - {EpisodeName}"
      const showName = metadata.grandparentTitle || 'Unknown Show';
      const seasonTitle = metadata.parentTitle || 'Unknown Season';
      const episodeNum = metadata.index ? String(metadata.index).padStart(2, '0') : '00';
      const episodeTitle = metadata.title || 'Unknown Episode';
      return `${library} - ${showName} - ${seasonTitle} - E${episodeNum} - ${episodeTitle}`;
    }

    if (type === 'track') {
      // Format: "{Library} - {AlbumTitle} - {TrackName}"
      const albumName = metadata.parentTitle || 'Unknown Album';
      const trackTitle = metadata.title || 'Unknown Track';
      return `${library} - ${albumName} - ${trackTitle}`;
    }

    if (type === 'movie') {
      // Format: "{Library} - {MovieTitle}"
      return `${library} - ${metadata.title || 'Unknown Movie'}`;
    }

    // For seasons, albums, or anything else: "{Library} - {Title}"
    return `${library} - ${metadata.title || 'Unknown Media'}`;
  };

  // Helper function to get user credentials with proper fallback
  // SECURITY: Always use admin's server URL, never user-specific URLs
  const getUserCredentials = (req: AuthRequest): { token: string | undefined; serverUrl: string; error?: string } => {
    const userToken = req.user?.plexToken;
    const isAdmin = req.user?.isAdmin;
    const adminToken = db.getSetting('plex_token') || undefined;
    const adminUrl = db.getSetting('plex_url') || '';

    // All users (including admins) must use admin's configured server URL
    // This prevents users from using the app to download from arbitrary Plex servers
    if (!adminUrl) {
      return {
        token: undefined,
        serverUrl: '',
        error: 'Plex server not configured. Please contact administrator.'
      };
    }

    // If user has their own token, use it with admin's server URL
    if (userToken) {
      return { token: userToken, serverUrl: adminUrl };
    }

    // Admin can fall back to admin token (for setup/testing)
    if (isAdmin && adminToken) {
      return { token: adminToken, serverUrl: adminUrl };
    }

    // User without token = no access
    return {
      token: undefined,
      serverUrl: '',
      error: 'Access denied. Please log out and log in again to configure your Plex access.'
    };
  };

  // Get recently added media
  router.get('/recently-added', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const { token, serverUrl, error } = getUserCredentials(req);

      if (error) {
        return res.status(403).json({ error });
      }

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

  // Helper function to calculate relevance score
  const calculateRelevanceScore = (item: any, query: string): number => {
    const queryLower = query.toLowerCase();
    const title = (item.title || '').toLowerCase();
    const originalTitle = (item.originalTitle || '').toLowerCase();
    const year = item.year?.toString() || '';
    const summary = (item.summary || '').toLowerCase();

    let score = 0;

    // Exact title match: highest score
    if (title === queryLower) {
      score += 100;
    }
    // Title starts with query
    else if (title.startsWith(queryLower)) {
      score += 80;
    }
    // Title contains query
    else if (title.includes(queryLower)) {
      score += 60;
    }

    // Original title matches
    if (originalTitle.includes(queryLower)) {
      score += 30;
    }

    // Year matches
    if (year === query) {
      score += 50;
    }

    // Summary contains query
    if (summary.includes(queryLower)) {
      score += 20;
    }

    // Boost movies and shows over other types
    if (item.type === 'movie' || item.type === 'show') {
      score += 10;
    }

    // Boost recently added items slightly
    if (item.addedAt) {
      const daysOld = (Date.now() - item.addedAt * 1000) / (1000 * 60 * 60 * 24);
      if (daysOld < 30) {
        score += 5;
      }
    }

    return score;
  };

  // Search media
  router.get('/search', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { q } = req.query;
      if (!q || typeof q !== 'string') {
        return res.status(400).json({ error: 'Search query is required' });
      }

      if (q.trim().length < 2) {
        return res.status(400).json({ error: 'Search query must be at least 2 characters' });
      }

      const { token, serverUrl, error } = getUserCredentials(req);

      if (error) {
        logger.warn('Search access denied', { userId: req.user?.id, error });
        return res.status(403).json({ error });
      }

      if (!token || !serverUrl) {
        logger.error('Search failed: Plex not configured', { userId: req.user?.id });
        return res.status(500).json({ error: 'Plex server not configured' });
      }

      logger.debug('Performing search', { query: q, userId: req.user?.id });

      plexService.setServerConnection(serverUrl, token);
      let results = await plexService.search(q, token);

      // Ensure results is an array
      if (!Array.isArray(results)) {
        logger.warn('Search returned non-array results', { results });
        results = [];
      }

      // Calculate relevance scores and sort by them
      const scoredResults = results.map(item => ({
        ...item,
        _relevanceScore: calculateRelevanceScore(item, q)
      }));

      // Sort by relevance score (descending)
      scoredResults.sort((a, b) => b._relevanceScore - a._relevanceScore);

      // Remove the score field before sending to client
      const finalResults = scoredResults.map(({ _relevanceScore, ...item }) => item);

      logger.debug('Search completed', { query: q, resultCount: finalResults.length });

      return res.json({ results: finalResults });
    } catch (error: any) {
      logger.error('Search failed', {
        error: error.message,
        stack: error.stack,
        query: req.query.q,
        userId: req.user?.id
      });
      return res.status(500).json({
        error: 'Search failed',
        details: error.message
      });
    }
  });

  // Get media metadata
  router.get('/:ratingKey', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { ratingKey } = req.params;
      const { token, serverUrl, error } = getUserCredentials(req);

      if (error) {
        return res.status(403).json({ error });
      }

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
      const { token, serverUrl, error } = getUserCredentials(req);

      if (error) {
        return res.status(403).json({ error });
      }

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
      const { token, serverUrl, error } = getUserCredentials(req);

      if (error) {
        return res.status(403).json({ error });
      }

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
      const { token, serverUrl, error } = getUserCredentials(req);

      if (error) {
        return res.status(403).json({ error });
      }

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

      const { token, serverUrl, error } = getUserCredentials(req);

      if (error) {
        return res.status(403).json({ error });
      }

      if (!token || !serverUrl) {
        return res.status(401).json({ error: 'Plex token required - configure in settings' });
      }

      plexService.setServerConnection(serverUrl, token);

      const metadata = await plexService.getMediaMetadata(ratingKey, token);

      // Check if user has download permission (allowSync field)
      // SECURITY: Only allow downloads if allowSync is explicitly true/1/'1'
      // Default to deny if undefined/null/false (secure by default)
      const allowSync = metadata.allowSync;
      const isDownloadAllowed = allowSync === true || allowSync === 1 || allowSync === '1';

      if (!isDownloadAllowed) {
        logger.warn('Download denied: user lacks download permission', {
          userId: req.user?.id,
          username: req.user?.username,
          ratingKey,
          mediaTitle: metadata.title,
          allowSync: metadata.allowSync,
          allowSyncType: typeof metadata.allowSync
        });
        return res.status(403).json({
          error: 'Download not allowed. The server administrator has disabled downloads for your account.'
        });
      }

      // Get library information for better download title
      let libraryTitle = metadata.librarySectionTitle || 'Unknown Library';
      if (!libraryTitle || libraryTitle === 'Unknown Library') {
        // Try to fetch library name from librarySectionID
        if (metadata.librarySectionID) {
          try {
            const libraries = await plexService.getLibraries(token);
            const library = libraries.find(l => l.key === metadata.librarySectionID);
            if (library) {
              libraryTitle = library.title;
            }
          } catch (err) {
            logger.warn('Failed to fetch library info for download', { librarySectionID: metadata.librarySectionID });
          }
        }
      }

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

      // Log the download with formatted title including library name and actual file size
      const formattedTitle = formatMediaTitle(metadata, libraryTitle);
      db.logDownload(
        req.user!.id,
        formattedTitle,
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

      logger.info(`Download started for ${formattedTitle} by user ${req.user?.username}`);
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

      // Temporarily set req.user for getUserCredentials helper
      req.user = user;
      const { token: plexToken, serverUrl, error: credError } = getUserCredentials(req);

      if (credError) {
        return res.status(403).json({ error: credError });
      }

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
