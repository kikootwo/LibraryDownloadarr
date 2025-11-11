import archiver from 'archiver';
import { Response } from 'express';
import axios from 'axios';
import { logger } from './logger';
import https from 'https';

export interface ZipFileEntry {
  url: string;          // Download URL from Plex
  filename: string;     // Filename to use inside the zip
  size?: number;        // Optional file size for progress tracking
}

// HTTPS agent that bypasses SSL certificate validation for local Plex servers
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

/**
 * Creates a zip archive from multiple files and streams it to the response
 * @param res Express response object
 * @param files Array of files to include in the zip
 * @param zipFilename Name of the zip file
 * @returns Promise that resolves when the zip is complete
 */
export const createZipStream = async (
  res: Response,
  files: ZipFileEntry[],
  zipFilename: string
): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Calculate total size for progress tracking
    const totalSize = files.reduce((sum, file) => sum + (file.size || 0), 0);
    let bytesWritten = 0;

    // Create archiver instance
    const archive = archiver('zip', {
      zlib: { level: 0 } // No compression for faster streaming (media files are already compressed)
    });

    // Set response headers
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // If we know the total size, set Content-Length header
    // Note: This is approximate because zip adds some overhead
    if (totalSize > 0) {
      // Add ~1% overhead for zip metadata
      const estimatedZipSize = Math.floor(totalSize * 1.01);
      res.setHeader('Content-Length', estimatedZipSize.toString());
    }

    // Pipe archive to response
    archive.pipe(res);

    // Track progress
    archive.on('progress', (progress) => {
      bytesWritten = progress.fs.processedBytes;
      const percent = totalSize > 0 ? Math.round((bytesWritten / totalSize) * 100) : 0;
      logger.debug('Zip progress', {
        bytesWritten,
        totalSize,
        percent,
        filesProcessed: progress.entries.processed,
        totalFiles: files.length
      });
    });

    // Handle errors
    archive.on('error', (err) => {
      logger.error('Archive error', { error: err });
      reject(err);
    });

    // Handle completion
    archive.on('end', () => {
      logger.info('Zip archive completed', {
        zipFilename,
        filesIncluded: files.length,
        totalBytes: bytesWritten
      });
      resolve();
    });

    // Handle response errors (client disconnected, etc.)
    res.on('error', (err) => {
      logger.error('Response stream error', { error: err });
      archive.destroy();
      reject(err);
    });

    res.on('close', () => {
      // Client disconnected before completion
      if (!res.writableEnded) {
        logger.warn('Client disconnected before zip completed', { zipFilename });
        archive.destroy();
      }
    });

    // Add files to archive
    const addFilesSequentially = async () => {
      for (const file of files) {
        try {
          logger.debug('Fetching file for zip', {
            filename: file.filename,
            size: file.size
          });

          // Fetch file from Plex server
          const response = await axios({
            method: 'GET',
            url: file.url,
            responseType: 'stream',
            httpsAgent: httpsAgent
          });

          // Add file stream to archive
          archive.append(response.data, { name: file.filename });

          logger.debug('File added to zip', { filename: file.filename });
        } catch (error) {
          logger.error('Failed to add file to zip', {
            filename: file.filename,
            error
          });
          // Continue with other files even if one fails
          // You could also reject here if you want strict behavior
        }
      }

      // Finalize the archive (no more files will be added)
      await archive.finalize();
    };

    // Start adding files
    addFilesSequentially().catch((err) => {
      logger.error('Error adding files to zip', { error: err });
      archive.destroy();
      reject(err);
    });
  });
};

/**
 * Calculate total size of files
 * @param files Array of file entries
 * @returns Total size in bytes
 */
export const calculateTotalSize = (files: ZipFileEntry[]): number => {
  return files.reduce((sum, file) => sum + (file.size || 0), 0);
};
