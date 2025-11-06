import { Request, Response, NextFunction } from 'express';
import { DatabaseService } from '../models/database';
import { logger } from '../utils/logger';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    isAdmin: boolean;
    plexToken?: string;
    serverUrl?: string;
  };
  authSession?: {
    id: string;
    token: string;
  };
}

export const createAuthMiddleware = (db: DatabaseService) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

      if (!token) {
        return res.status(401).json({ error: 'No token provided' });
      }

      const session = db.getSessionByToken(token);
      if (!session) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }

      // Try admin user first
      const adminUser = db.getAdminUserById(session.userId);
      if (adminUser) {
        req.user = {
          id: adminUser.id,
          username: adminUser.username,
          isAdmin: adminUser.isAdmin,
        };
        req.authSession = {
          id: session.id,
          token: session.token,
        };
        return next();
      }

      // Try plex user
      const plexUser = db.getPlexUserById(session.userId);
      if (plexUser) {
        req.user = {
          id: plexUser.id,
          username: plexUser.username,
          isAdmin: plexUser.isAdmin,
          plexToken: plexUser.plexToken,
          serverUrl: plexUser.serverUrl,
        };
        req.authSession = {
          id: session.id,
          token: session.token,
        };
        return next();
      }

      return res.status(401).json({ error: 'User not found' });
    } catch (error) {
      logger.error('Authentication error', { error });
      return res.status(500).json({ error: 'Authentication failed' });
    }
  };
};

export const createAdminMiddleware = () => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    return next();
  };
};
