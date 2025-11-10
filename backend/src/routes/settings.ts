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
      const plexServerName = db.getSetting('plex_server_name') || '';

      return res.json({
        settings: {
          plexUrl,
          hasPlexToken: !!plexToken,
          plexMachineId,
          plexServerName,
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

      // Update Plex service connection and auto-fetch server identity
      if (plexUrl || plexToken) {
        const url = plexUrl || db.getSetting('plex_url') || '';
        const token = plexToken || db.getSetting('plex_token') || '';

        if (url && token) {
          plexService.setServerConnection(url, token);

          // Auto-fetch machine ID and server name
          try {
            const serverInfo = await plexService.getServerIdentity(token);

            if (serverInfo?.machineIdentifier) {
              db.setSetting('plex_machine_id', serverInfo.machineIdentifier);
              db.setSetting('plex_server_name', serverInfo.friendlyName);

              logger.debug('Auto-fetched server identity', {
                machineId: serverInfo.machineIdentifier,
                serverName: serverInfo.friendlyName
              });
            }
          } catch (error) {
            logger.warn('Failed to auto-fetch server identity', { error });
            // Don't fail the settings save if identity fetch fails
          }
        }
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

  return router;
};
