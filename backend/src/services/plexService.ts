import PlexAPI from 'plex-api';
import axios from 'axios';
import { logger } from '../utils/logger';
import { config } from '../config';

export interface PlexLibrary {
  key: string;
  title: string;
  type: string;
}

export interface PlexMedia {
  ratingKey: string;
  key: string;
  title: string;
  type: string;
  year?: number;
  thumb?: string;
  art?: string;
  summary?: string;
  rating?: number;
  duration?: number;
  addedAt?: number;
  updatedAt?: number;
  originallyAvailableAt?: string;
  studio?: string;
  contentRating?: string;
  Media?: Array<{
    id: number;
    duration: number;
    bitrate: number;
    width: number;
    height: number;
    aspectRatio: number;
    videoCodec: string;
    videoResolution: string;
    container: string;
    videoFrameRate: string;
    Part: Array<{
      id: number;
      key: string;
      duration: number;
      file: string;
      size: number;
      container: string;
    }>;
  }>;
}

export interface PlexPinResponse {
  id: number;
  code: string;
}

export interface PlexAuthResponse {
  authToken: string;
  user: {
    id: number;
    uuid: string;
    email: string;
    username: string;
    title: string;
    thumb: string;
  };
}

export class PlexService {
  private client: PlexAPI | null = null;
  private plexUrl: string | null = null;

  constructor() {
    if (config.plex.url && config.plex.token) {
      this.initializeClient(config.plex.url, config.plex.token);
    }
  }

  private parseConnectionDetails(urlOrHostname: string): { hostname: string; port: number; https: boolean } {
    try {
      // If it starts with http:// or https://, parse it
      if (urlOrHostname.startsWith('http://') || urlOrHostname.startsWith('https://')) {
        const url = new URL(urlOrHostname);
        const port = url.port ? parseInt(url.port) : (url.protocol === 'https:' ? 443 : 32400);
        const https = url.protocol === 'https:';

        logger.info('Parsed connection details from URL', {
          input: urlOrHostname,
          hostname: url.hostname,
          port: port,
          https: https
        });

        return {
          hostname: url.hostname,
          port: port,
          https: https
        };
      }

      // Otherwise assume it's in host:port format or just hostname
      if (urlOrHostname.includes(':')) {
        const [hostname, portStr] = urlOrHostname.split(':');
        const port = parseInt(portStr) || 32400;
        logger.info('Parsed connection details from host:port', { hostname, port });
        return { hostname, port, https: false };
      }

      // Just hostname
      logger.info('Using hostname with default port', { hostname: urlOrHostname, port: 32400 });
      return { hostname: urlOrHostname, port: 32400, https: false };
    } catch (error) {
      logger.warn('Failed to parse Plex URL, using defaults', { urlOrHostname, error });
      return { hostname: urlOrHostname, port: 32400, https: false };
    }
  }

  private initializeClient(urlOrHostname: string, token: string): void {
    const connectionDetails = this.parseConnectionDetails(urlOrHostname);
    const protocol = connectionDetails.https ? 'https' : 'http';
    this.plexUrl = `${protocol}://${connectionDetails.hostname}:${connectionDetails.port}`;

    this.client = new PlexAPI({
      hostname: connectionDetails.hostname,
      port: connectionDetails.port,
      https: connectionDetails.https,
      token,
      options: {
        identifier: config.plex.clientIdentifier,
        product: config.plex.product,
        version: config.plex.version,
        deviceName: config.plex.device,
      },
    });
    logger.info('Plex client initialized', {
      hostname: connectionDetails.hostname,
      port: connectionDetails.port,
      https: connectionDetails.https
    });
  }

  setServerConnection(urlOrHostname: string, token: string): void {
    this.initializeClient(urlOrHostname, token);
  }

  async testConnection(): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      await this.client.query('/');
      return true;
    } catch (error) {
      logger.error('Failed to connect to Plex server', { error });
      return false;
    }
  }

  async testConnectionWithCredentials(urlOrHostname: string, token: string): Promise<boolean> {
    try {
      const connectionDetails = this.parseConnectionDetails(urlOrHostname);
      const testClient = new PlexAPI({
        hostname: connectionDetails.hostname,
        port: connectionDetails.port,
        https: connectionDetails.https,
        token,
        options: {
          identifier: config.plex.clientIdentifier,
          product: config.plex.product,
          version: config.plex.version,
          deviceName: config.plex.device,
        },
      });

      await testClient.query('/');
      return true;
    } catch (error) {
      logger.error('Failed to test connection with provided credentials', { error });
      return false;
    }
  }

  // OAuth PIN Flow
  async generatePin(): Promise<PlexPinResponse> {
    try {
      const response = await axios.post(
        'https://plex.tv/api/v2/pins',
        { strong: true },
        {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-Plex-Product': config.plex.product,
            'X-Plex-Client-Identifier': config.plex.clientIdentifier,
          },
          params: {
            strong: true,
          },
        }
      );

      return {
        id: response.data.id,
        code: response.data.code,
      };
    } catch (error) {
      logger.error('Failed to generate Plex PIN', { error });
      throw new Error('Failed to generate Plex PIN');
    }
  }

  async checkPin(pinId: number): Promise<PlexAuthResponse | null> {
    try {
      const response = await axios.get(`https://plex.tv/api/v2/pins/${pinId}`, {
        headers: {
          Accept: 'application/json',
          'X-Plex-Client-Identifier': config.plex.clientIdentifier,
        },
      });

      logger.info('Plex PIN response', {
        hasAuthToken: !!response.data.authToken,
        userData: response.data,
      });

      if (response.data.authToken) {
        // Plex API can return username, title, or friendly_name
        const username = response.data.username || response.data.title || response.data.friendlyName || `plexuser_${response.data.id}`;

        return {
          authToken: response.data.authToken,
          user: {
            id: response.data.id,
            uuid: response.data.id?.toString(),
            email: response.data.email || '',
            username: username,
            title: response.data.title || username,
            thumb: response.data.thumb || '',
          },
        };
      }

      return null;
    } catch (error) {
      logger.error('Failed to check Plex PIN', { error });
      return null;
    }
  }

  async getUserInfo(token: string): Promise<any> {
    try {
      const response = await axios.get('https://plex.tv/api/v2/user', {
        headers: {
          'X-Plex-Token': token,
          Accept: 'application/json',
        },
      });
      return response.data;
    } catch (error) {
      logger.error('Failed to get user info', { error });
      throw new Error('Failed to get user info');
    }
  }

  // Library operations
  async getLibraries(userToken?: string): Promise<PlexLibrary[]> {
    try {
      // Get URL from: instance variable, environment, or database (via caller)
      const url = this.plexUrl || config.plex.url;
      const token = userToken || config.plex.token;

      logger.info('getLibraries called', {
        hasUrl: !!url,
        hasToken: !!token,
        hasUserToken: !!userToken,
        hasThisPlexUrl: !!this.plexUrl,
        hasConfigUrl: !!config.plex.url,
        url: url || 'MISSING'
      });

      if (!url || !token) {
        throw new Error(`Plex URL and token are required. Please configure in Settings. (url: ${!!url}, token: ${!!token})`);
      }

      // Always create a fresh client for reliability
      const connectionDetails = this.parseConnectionDetails(url);
      const client = new PlexAPI({
        hostname: connectionDetails.hostname,
        port: connectionDetails.port,
        https: connectionDetails.https,
        token: token,
        options: {
          identifier: config.plex.clientIdentifier,
          product: config.plex.product,
          version: config.plex.version,
          deviceName: config.plex.device,
        },
      });

      const result = await client.query('/library/sections');

      return result.MediaContainer.Directory.map((dir: any) => ({
        key: dir.key,
        title: dir.title,
        type: dir.type,
      }));
    } catch (error: any) {
      logger.error('Failed to get libraries', {
        error: error.message,
        stack: error.stack,
        hasUrl: !!(this.plexUrl || config.plex.url),
        hasToken: !!userToken
      });
      throw error;
    }
  }

  async getLibraryContent(libraryKey: string, userToken?: string): Promise<PlexMedia[]> {
    if (!this.client && !this.plexUrl) {
      throw new Error('Plex client not initialized');
    }

    try {
      let client: PlexAPI | null = null;
      if (userToken) {
        const connectionDetails = this.parseConnectionDetails(this.plexUrl || config.plex.url);
        client = new PlexAPI({
          hostname: connectionDetails.hostname,
          port: connectionDetails.port,
          https: connectionDetails.https,
          token: userToken,
          options: {
            identifier: config.plex.clientIdentifier,
            product: config.plex.product,
            version: config.plex.version,
            deviceName: config.plex.device,
          },
        });
      } else {
        client = this.client;
      }

      if (!client) {
        throw new Error('Plex client not available');
      }

      const result = await client.query(`/library/sections/${libraryKey}/all`);

      return result.MediaContainer.Metadata || [];
    } catch (error) {
      logger.error('Failed to get library content', { error });
      throw new Error('Failed to get library content');
    }
  }

  async getMediaMetadata(ratingKey: string, userToken?: string): Promise<PlexMedia> {
    if (!this.client && !this.plexUrl) {
      throw new Error('Plex client not initialized');
    }

    try {
      let client: PlexAPI | null = null;
      if (userToken) {
        const connectionDetails = this.parseConnectionDetails(this.plexUrl || config.plex.url);
        client = new PlexAPI({
          hostname: connectionDetails.hostname,
          port: connectionDetails.port,
          https: connectionDetails.https,
          token: userToken,
          options: {
            identifier: config.plex.clientIdentifier,
            product: config.plex.product,
            version: config.plex.version,
            deviceName: config.plex.device,
          },
        });
      } else {
        client = this.client;
      }

      if (!client) {
        throw new Error('Plex client not available');
      }

      const result = await client.query(`/library/metadata/${ratingKey}`);

      return result.MediaContainer.Metadata[0];
    } catch (error) {
      logger.error('Failed to get media metadata', { error });
      throw new Error('Failed to get media metadata');
    }
  }

  async search(query: string, userToken?: string): Promise<PlexMedia[]> {
    if (!this.client && !this.plexUrl) {
      throw new Error('Plex client not initialized');
    }

    try {
      let client: PlexAPI | null = null;
      if (userToken) {
        const connectionDetails = this.parseConnectionDetails(this.plexUrl || config.plex.url);
        client = new PlexAPI({
          hostname: connectionDetails.hostname,
          port: connectionDetails.port,
          https: connectionDetails.https,
          token: userToken,
          options: {
            identifier: config.plex.clientIdentifier,
            product: config.plex.product,
            version: config.plex.version,
            deviceName: config.plex.device,
          },
        });
      } else {
        client = this.client;
      }

      if (!client) {
        throw new Error('Plex client not available');
      }

      const result = await client.query('/search', { query });

      return result.MediaContainer.Metadata || [];
    } catch (error) {
      logger.error('Failed to search', { error });
      throw new Error('Failed to search');
    }
  }

  async getRecentlyAdded(userToken?: string, limit: number = 20): Promise<PlexMedia[]> {
    if (!this.client && !this.plexUrl) {
      throw new Error('Plex client not initialized');
    }

    try {
      let client: PlexAPI | null = null;
      if (userToken) {
        const connectionDetails = this.parseConnectionDetails(this.plexUrl || config.plex.url);
        client = new PlexAPI({
          hostname: connectionDetails.hostname,
          port: connectionDetails.port,
          https: connectionDetails.https,
          token: userToken,
          options: {
            identifier: config.plex.clientIdentifier,
            product: config.plex.product,
            version: config.plex.version,
            deviceName: config.plex.device,
          },
        });
      } else {
        client = this.client;
      }

      if (!client) {
        throw new Error('Plex client not available');
      }

      const result = await client.query('/library/recentlyAdded', {
        'X-Plex-Container-Start': 0,
        'X-Plex-Container-Size': limit,
      });

      return result.MediaContainer.Metadata || [];
    } catch (error) {
      logger.error('Failed to get recently added', { error });
      throw new Error('Failed to get recently added');
    }
  }

  getDownloadUrl(partKey: string, token: string): string {
    const baseUrl = this.plexUrl || config.plex.url;
    if (!baseUrl) {
      throw new Error('Plex server URL not configured');
    }

    return `${baseUrl}${partKey}?download=1&X-Plex-Token=${token}`;
  }

  getThumbnailUrl(thumbPath: string, token: string): string {
    const baseUrl = this.plexUrl || config.plex.url;
    if (!baseUrl || !thumbPath) {
      return '';
    }

    return `${baseUrl}${thumbPath}?X-Plex-Token=${token}`;
  }
}

export const plexService = new PlexService();
