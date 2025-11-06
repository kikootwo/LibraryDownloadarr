import { Router } from 'express';
import { DatabaseService } from '../models/database';
import { plexService } from '../services/plexService';
import { logger } from '../utils/logger';
import { AuthRequest, createAuthMiddleware, createAdminMiddleware } from '../middleware/auth';

export const createSettingsRouter = (db: DatabaseService) => {
  const router = Router();
  const authMiddleware = createAuthMiddleware(db);
  const adminMiddleware = createAdminMiddleware();

  // Get settings (admin only)
  router.get('/', authMiddleware, adminMiddleware, (_req: AuthRequest, res) => {
    try {
      const plexUrl = db.getSetting('plex_url') || '';
      const plexToken = db.getSetting('plex_token') || '';
      const plexMachineId = db.getSetting('plex_machine_id') || '';

      return res.json({
        settings: {
          plexUrl,
          hasPlexToken: !!plexToken,
          plexMachineId,
        },
      });
    } catch (error) {
      logger.error('Failed to get settings', { error });
      return res.status(500).json({ error: 'Failed to get settings' });
    }
  });

  // Update settings (admin only)
  router.put('/', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
    try {
      const { plexUrl, plexToken } = req.body;

      if (plexUrl) {
        db.setSetting('plex_url', plexUrl);
      }
      if (plexToken) {
        db.setSetting('plex_token', plexToken);
      }

      // Update Plex service connection
      if (plexUrl || plexToken) {
        const url = plexUrl || db.getSetting('plex_url') || '';
        const token = plexToken || db.getSetting('plex_token') || '';
        plexService.setServerConnection(url, token);
      }

      logger.info('Settings updated by admin');

      return res.json({ message: 'Settings updated successfully' });
    } catch (error) {
      logger.error('Failed to update settings', { error });
      return res.status(500).json({ error: 'Failed to update settings' });
    }
  });

  // Test Plex connection (admin only)
  router.post('/test-connection', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
    try {
      const { plexUrl, plexToken } = req.body;

      // If URL and token provided in request, test those; otherwise test saved settings
      if (plexUrl && plexToken) {
        const isConnected = await plexService.testConnectionWithCredentials(plexUrl, plexToken);
        return res.json({ connected: isConnected });
      } else {
        const isConnected = await plexService.testConnection();
        return res.json({ connected: isConnected });
      }
    } catch (error) {
      logger.error('Connection test failed', { error });
      return res.status(500).json({ error: 'Connection test failed', connected: false });
    }
  });

  // Fetch server machine ID from Plex server (admin only)
  router.post('/fetch-machine-id', authMiddleware, adminMiddleware, async (_req: AuthRequest, res) => {
    try {
      const plexUrl = db.getSetting('plex_url') || '';
      const plexToken = db.getSetting('plex_token') || '';

      if (!plexUrl || !plexToken) {
        return res.status(400).json({ error: 'Plex URL and token must be configured first' });
      }

      // Fetch server identity from Plex
      const serverInfo = await plexService.getServerIdentity(plexToken);

      if (!serverInfo || !serverInfo.machineIdentifier) {
        return res.status(500).json({ error: 'Failed to fetch server machine ID' });
      }

      // Auto-save the machine ID
      db.setSetting('plex_machine_id', serverInfo.machineIdentifier);

      logger.info('Fetched and saved server machine ID', {
        machineId: serverInfo.machineIdentifier,
        serverName: serverInfo.friendlyName
      });

      return res.json({
        machineId: serverInfo.machineIdentifier,
        serverName: serverInfo.friendlyName
      });
    } catch (error) {
      logger.error('Failed to fetch machine ID', { error });
      return res.status(500).json({ error: 'Failed to fetch server machine ID' });
    }
  });

  return router;
};
