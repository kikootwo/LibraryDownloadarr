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

  private parseHostname(urlOrHostname: string): string {
    try {
      // If it starts with http:// or https://, parse it
      if (urlOrHostname.startsWith('http://') || urlOrHostname.startsWith('https://')) {
        const url = new URL(urlOrHostname);
        return url.host; // This includes port if present
      }
      // Otherwise assume it's already in host:port format
      return urlOrHostname;
    } catch (error) {
      logger.warn('Failed to parse Plex URL, using as-is', { urlOrHostname, error });
      return urlOrHostname;
    }
  }

  private initializeClient(urlOrHostname: string, token: string): void {
    const hostname = this.parseHostname(urlOrHostname);
    this.plexUrl = urlOrHostname.startsWith('http') ? urlOrHostname : `http://${urlOrHostname}`;

    this.client = new PlexAPI({
      hostname,
      token,
      options: {
        identifier: config.plex.clientIdentifier,
        product: config.plex.product,
        version: config.plex.version,
        deviceName: config.plex.device,
      },
    });
    logger.info('Plex client initialized', { hostname });
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
      const hostname = this.parseHostname(urlOrHostname);
      const testClient = new PlexAPI({
        hostname,
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
        {
          strong: true,
          'X-Plex-Product': config.plex.product,
          'X-Plex-Client-Identifier': config.plex.clientIdentifier,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
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

      if (response.data.authToken) {
        return {
          authToken: response.data.authToken,
          user: {
            id: response.data.user?.id,
            uuid: response.data.user?.uuid,
            email: response.data.user?.email,
            username: response.data.user?.username || response.data.user?.title,
            title: response.data.user?.title,
            thumb: response.data.user?.thumb,
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
    if (!this.client && !this.plexUrl) {
      throw new Error('Plex client not initialized');
    }

    try {
      const client = userToken
        ? new PlexAPI({
            hostname: this.parseHostname(this.plexUrl || config.plex.url),
            token: userToken,
            options: {
              identifier: config.plex.clientIdentifier,
              product: config.plex.product,
              version: config.plex.version,
              deviceName: config.plex.device,
            },
          })
        : this.client;

      if (!client) {
        throw new Error('Plex client not available');
      }

      const result = await client.query('/library/sections');

      return result.MediaContainer.Directory.map((dir: any) => ({
        key: dir.key,
        title: dir.title,
        type: dir.type,
      }));
    } catch (error) {
      logger.error('Failed to get libraries', { error });
      throw new Error('Failed to get libraries');
    }
  }

  async getLibraryContent(libraryKey: string, userToken?: string): Promise<PlexMedia[]> {
    if (!this.client && !this.plexUrl) {
      throw new Error('Plex client not initialized');
    }

    try {
      const client = userToken
        ? new PlexAPI({
            hostname: this.parseHostname(this.plexUrl || config.plex.url),
            token: userToken,
            options: {
              identifier: config.plex.clientIdentifier,
              product: config.plex.product,
              version: config.plex.version,
              deviceName: config.plex.device,
            },
          })
        : this.client;

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
      const client = userToken
        ? new PlexAPI({
            hostname: this.parseHostname(this.plexUrl || config.plex.url),
            token: userToken,
            options: {
              identifier: config.plex.clientIdentifier,
              product: config.plex.product,
              version: config.plex.version,
              deviceName: config.plex.device,
            },
          })
        : this.client;

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
      const client = userToken
        ? new PlexAPI({
            hostname: this.parseHostname(this.plexUrl || config.plex.url),
            token: userToken,
            options: {
              identifier: config.plex.clientIdentifier,
              product: config.plex.product,
              version: config.plex.version,
              deviceName: config.plex.device,
            },
          })
        : this.client;

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
      const client = userToken
        ? new PlexAPI({
            hostname: this.parseHostname(this.plexUrl || config.plex.url),
            token: userToken,
            options: {
              identifier: config.plex.clientIdentifier,
              product: config.plex.product,
              version: config.plex.version,
              deviceName: config.plex.device,
            },
          })
        : this.client;

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
