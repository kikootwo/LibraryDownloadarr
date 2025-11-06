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
  router.get('/setup/required', (req, res) => {
    const hasAdmin = db.hasAdminUser();
    res.json({ setupRequired: !hasAdmin });
  });

  // Initial admin setup
  router.post('/setup', async (req, res) => {
    try {
      if (db.hasAdminUser()) {
        return res.status(400).json({ error: 'Setup already completed' });
      }

      const { username, password, email, plexUrl, plexToken } = req.body;

      if (!username || !password || !email) {
        return res.status(400).json({ error: 'Username, password, and email are required' });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Create admin user
      const adminUser = db.createAdminUser({
        username,
        passwordHash,
        email,
        isAdmin: true,
      });

      // Save Plex settings if provided
      if (plexUrl) {
        db.setSetting('plex_url', plexUrl);
        plexService.setServerConnection(plexUrl, plexToken || '');
      }
      if (plexToken) {
        db.setSetting('plex_token', plexToken);
      }

      // Create session
      const session = db.createSession(adminUser.id);

      logger.info(`Initial admin setup completed for user: ${username}`);

      res.json({
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
      res.status(500).json({ error: 'Setup failed' });
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

      res.json({
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
      res.status(500).json({ error: 'Login failed' });
    }
  });

  // Plex OAuth: Generate PIN
  router.post('/plex/pin', async (req, res) => {
    try {
      const pin = await plexService.generatePin();
      res.json({
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
      res.status(500).json({ error: 'Failed to generate Plex PIN' });
    }
  });

  // Plex OAuth: Check PIN and authenticate
  router.post('/plex/authenticate', async (req, res) => {
    try {
      const { pinId } = req.body;

      if (!pinId) {
        return res.status(400).json({ error: 'PIN ID is required' });
      }

      const authResponse = await plexService.checkPin(pinId);
      if (!authResponse) {
        return res.status(400).json({ error: 'PIN not yet authorized' });
      }

      // Create or update plex user
      const plexUser = db.createOrUpdatePlexUser({
        username: authResponse.user.username,
        email: authResponse.user.email,
        plexToken: authResponse.authToken,
        plexId: authResponse.user.uuid,
      });

      // Create session
      const session = db.createSession(plexUser.id);

      logger.info(`Plex user authenticated: ${plexUser.username}`);

      res.json({
        user: {
          id: plexUser.id,
          username: plexUser.username,
          email: plexUser.email,
          isAdmin: plexUser.isAdmin,
        },
        token: session.token,
      });
    } catch (error) {
      logger.error('Plex authentication error', { error });
      res.status(500).json({ error: 'Plex authentication failed' });
    }
  });

  // Get current user
  router.get('/me', authMiddleware, (req: AuthRequest, res) => {
    res.json({ user: req.user });
  });

  // Logout
  router.post('/logout', authMiddleware, (req: AuthRequest, res) => {
    try {
      if (req.session?.token) {
        db.deleteSession(req.session.token);
      }
      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      logger.error('Logout error', { error });
      res.status(500).json({ error: 'Logout failed' });
    }
  });

  return router;
};
