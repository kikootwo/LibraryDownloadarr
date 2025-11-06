import { Router } from 'express';
import bcrypt from 'bcrypt';
import { DatabaseService } from '../models/database';
import { plexService } from '../services/plexService';
import { logger } from '../utils/logger';
import { AuthRequest, createAuthMiddleware } from '../middleware/auth';

export const createAuthRouter = (db: DatabaseService) => {
  const router = Router();
  const authMiddleware = createAuthMiddleware(db);

  // Check if initial setup is required
  router.get('/setup/required', (_req, res) => {
    const hasAdmin = db.hasAdminUser();
    return res.json({ setupRequired: !hasAdmin });
  });

  // Initial admin setup
  router.post('/setup', async (req, res) => {
    try {
      if (db.hasAdminUser()) {
        return res.status(400).json({ error: 'Setup already completed' });
      }

      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Create admin user (email is optional, use username@localhost as default)
      const adminUser = db.createAdminUser({
        username,
        passwordHash,
        email: `${username}@localhost`,
        isAdmin: true,
      });

      // Create session
      const session = db.createSession(adminUser.id);

      logger.info(`Initial admin setup completed for user: ${username}`);

      return res.json({
        message: 'Setup completed successfully',
        user: {
          id: adminUser.id,
          username: adminUser.username,
          email: adminUser.email,
          isAdmin: adminUser.isAdmin,
        },
        token: session.token,
      });
    } catch (error) {
      logger.error('Setup error', { error });
      return res.status(500).json({ error: 'Setup failed' });
    }
  });

  // Admin login
  router.post('/login', async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
      }

      const user = db.getAdminUserByUsername(username);
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      db.updateAdminLastLogin(user.id);
      const session = db.createSession(user.id);

      logger.info(`User logged in: ${username}`);

      return res.json({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          isAdmin: user.isAdmin,
        },
        token: session.token,
      });
    } catch (error) {
      logger.error('Login error', { error });
      return res.status(500).json({ error: 'Login failed' });
    }
  });

  // Plex OAuth: Generate PIN
  router.post('/plex/pin', async (_req, res) => {
    try {
      const pin = await plexService.generatePin();
      return res.json({
        id: pin.id,
        code: pin.code,
        url: `https://app.plex.tv/auth#?clientID=${encodeURIComponent(
          'plexdownloadarr'
        )}&code=${encodeURIComponent(pin.code)}&context[device][product]=${encodeURIComponent(
          'PlexDownloadarr'
        )}`,
      });
    } catch (error) {
      logger.error('Plex PIN generation error', { error });
      return res.status(500).json({ error: 'Failed to generate Plex PIN' });
    }
  });

  // Plex OAuth: Check PIN and authenticate
  router.post('/plex/authenticate', async (req, res) => {
    try {
      const { pinId } = req.body;

      if (!pinId) {
        return res.status(400).json({ error: 'PIN ID is required' });
      }

      logger.info('Checking Plex PIN', { pinId });

      const authResponse = await plexService.checkPin(pinId);
      if (!authResponse) {
        return res.status(400).json({ error: 'PIN not yet authorized' });
      }

      logger.info('Plex PIN authorized', { username: authResponse.user.username });

      // Get user's accessible Plex servers and find best connection URL
      let serverUrl: string | undefined;
      let serverAccessToken: string | undefined;
      try {
        const userServers = await plexService.getUserServers(authResponse.authToken);
        const adminMachineId = db.getSetting('plex_machine_id'); // Optional: match specific server
        const connection = plexService.findBestServerConnection(userServers, adminMachineId);

        serverUrl = connection.serverUrl || undefined;
        serverAccessToken = connection.accessToken || undefined;

        if (!serverUrl) {
          logger.warn('Could not find accessible Plex server for user', {
            username: authResponse.user.username,
            serversCount: userServers.length,
          });
        }

        logger.info('Server connection found for user', {
          username: authResponse.user.username,
          hasServerUrl: !!serverUrl,
          hasAccessToken: !!serverAccessToken,
          isSharedServer: !!serverAccessToken
        });
      } catch (error) {
        logger.error('Failed to get user servers', { error });
        // Continue without serverUrl - will fall back to admin URL if needed
      }

      // Create or update plex user
      // For shared servers, use the server's accessToken; for owned servers, use the user's auth token
      const plexUser = db.createOrUpdatePlexUser({
        username: authResponse.user.username,
        email: authResponse.user.email,
        plexToken: serverAccessToken || authResponse.authToken,
        plexId: authResponse.user.uuid,
        serverUrl,
      });

      // Create session
      const session = db.createSession(plexUser.id);

      logger.info(`Plex user authenticated: ${plexUser.username}`, {
        hasServerUrl: !!serverUrl,
        serverUrl: serverUrl,
      });

      return res.json({
        user: {
          id: plexUser.id,
          username: plexUser.username,
          email: plexUser.email,
          isAdmin: plexUser.isAdmin,
        },
        token: session.token,
      });
    } catch (error: any) {
      logger.error('Plex authentication error', {
        error: error.message,
        stack: error.stack,
        pinId: req.body.pinId
      });
      return res.status(500).json({ error: 'Plex authentication failed' });
    }
  });

  // Get current user
  router.get('/me', authMiddleware, (req: AuthRequest, res) => {
    return res.json({ user: req.user });
  });

  // Logout
  router.post('/logout', authMiddleware, (req: AuthRequest, res) => {
    try {
      if (req.authSession?.token) {
        db.deleteSession(req.authSession.token);
      }
      return res.json({ message: 'Logged out successfully' });
    } catch (error) {
      logger.error('Logout error', { error });
      return res.status(500).json({ error: 'Logout failed' });
    }
  });

  // Change password (admin users only)
  router.post('/change-password', authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current password and new password are required' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters long' });
      }

      // Only admin users (those with password_hash) can change passwords
      // Plex users authenticate via OAuth and don't have passwords
      const user = db.getAdminUserById(req.user!.id);
      if (!user) {
        return res.status(400).json({ error: 'Password change is only available for admin accounts' });
      }

      // Verify current password
      const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isValid) {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }

      // Hash new password
      const newPasswordHash = await bcrypt.hash(newPassword, 10);

      // Update password in database
      db.updateAdminPassword(user.id, newPasswordHash);

      logger.info(`Password changed for admin user: ${user.username}`);

      return res.json({ message: 'Password changed successfully' });
    } catch (error) {
      logger.error('Password change error', { error });
      return res.status(500).json({ error: 'Password change failed' });
    }
  });

  return router;
};
