import { Router } from 'express';
import { createAuthMiddleware, createAdminMiddleware, AuthRequest } from '../middleware/auth';
import { DatabaseService } from '../models/database';
import { logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

export const createLogsRouter = (db: DatabaseService) => {
  const router = Router();
  const authMiddleware = createAuthMiddleware(db);
  const adminMiddleware = createAdminMiddleware();

  interface LogEntry {
    timestamp: string;
    level: string;
    message: string;
    meta?: any;
  }

  // Helper function to read log file
  async function readLogFile(filePath: string): Promise<LogEntry[]> {
    const logs: LogEntry[] = [];

    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      try {
        // Parse JSON log line
        const logEntry = JSON.parse(line);

        logs.push({
          timestamp: logEntry.timestamp || new Date().toISOString(),
          level: logEntry.level || 'info',
          message: logEntry.message || '',
          meta: logEntry,
        });
      } catch (e) {
        // Skip invalid JSON lines
        continue;
      }
    }

    return logs;
  }

  // Get logs with filtering and pagination
  router.get('/', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
    try {
      const {
        level,
        search,
        page = '1',
        limit = '50',
        sortOrder = 'desc'
      } = req.query;

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);

      // Read from combined.log file
      const logFilePath = path.join(process.cwd(), 'logs', 'combined.log');

      let logs: LogEntry[] = [];

      if (fs.existsSync(logFilePath)) {
        logs = await readLogFile(logFilePath);
      }

      // Filter by level
      if (level && level !== 'all') {
        logs = logs.filter(log => log.level === level);
      }

      // Filter by search text
      if (search && typeof search === 'string') {
        const searchLower = search.toLowerCase();
        logs = logs.filter(log =>
          log.message.toLowerCase().includes(searchLower) ||
          JSON.stringify(log.meta || {}).toLowerCase().includes(searchLower)
        );
      }

      // Sort logs
      if (sortOrder === 'desc') {
        logs.reverse();
      }

      // Paginate
      const startIndex = (pageNum - 1) * limitNum;
      const endIndex = startIndex + limitNum;
      const paginatedLogs = logs.slice(startIndex, endIndex);

      res.json({
        logs: paginatedLogs,
        total: logs.length,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(logs.length / limitNum),
      });
    } catch (error) {
      logger.error('Failed to get logs', { error });
      res.status(500).json({ error: 'Failed to get logs' });
    }
  });

  return router;
};
