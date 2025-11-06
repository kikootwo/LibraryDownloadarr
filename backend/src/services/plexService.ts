import PlexAPI from 'plex-api';
import axios from 'axios';
import { parseString } from 'xml2js';
import { logger } from '../utils/logger';
import { config } from '../config';

// Promisified wrapper for xml2js parseString with options support
const parseStringAsync = (xml: string, options: any): Promise<any> => {
  return new Promise((resolve, reject) => {
    parseString(xml, options, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
};

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

    // plex-api library supports port and https options, but TypeScript definitions are incomplete
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
    } as any);
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
      // plex-api library supports port and https options, but TypeScript definitions are incomplete
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
      } as any);

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
        'https://plex.tv/api/v2/pins?strong=true',
        {},
        {
          headers: {
            Accept: 'application/json',
            'X-Plex-Product': config.plex.product,
            'X-Plex-Client-Identifier': config.plex.clientIdentifier,
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
        // Try to get more detailed user info from the user endpoint
        let username = response.data.username || response.data.title || response.data.friendlyName;

        try {
          const userInfo = await this.getUserInfo(response.data.authToken);
          // Plex user API can return friendly_name, username, or title
          username = userInfo.friendlyName || userInfo.friendly_name || userInfo.username || userInfo.title || username;
          logger.info('Fetched detailed user info', { username, userInfo });
        } catch (error) {
          logger.warn('Could not fetch detailed user info, using PIN data', { error });
        }

        // Fallback to user ID if no friendly name available
        if (!username) {
          username = `plexuser_${response.data.id}`;
        }

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

  async getUserServers(userToken: string): Promise<any[]> {
    try {
      // Plex /api/resources endpoint returns XML only (no JSON option)
      const response = await axios.get('https://plex.tv/api/resources', {
        headers: {
          'X-Plex-Token': userToken,
        },
        params: {
          includeHttps: '1',
          includeRelay: '1',
        },
      });

      // Parse XML to JSON
      const parsed = await parseStringAsync(response.data, {
        explicitArray: false,
        mergeAttrs: true,
      });

      logger.info('getUserServers parsed XML', {
        hasMediaContainer: !!parsed?.MediaContainer,
        hasDevice: !!parsed?.MediaContainer?.Device,
        deviceType: typeof parsed?.MediaContainer?.Device
      });

      // Extract devices from parsed XML
      if (parsed?.MediaContainer?.Device) {
        const devices = Array.isArray(parsed.MediaContainer.Device)
          ? parsed.MediaContainer.Device
          : [parsed.MediaContainer.Device];

        logger.info('Extracted devices from XML', {
          deviceCount: devices.length,
          firstDevice: devices[0] ? {
            name: devices[0].name,
            owned: devices[0].owned,
            provides: devices[0].provides,
            hasAccessToken: !!devices[0].accessToken,
            hasConnection: !!devices[0].Connection
          } : 'none'
        });

        return devices;
      }

      logger.warn('No devices found in XML response');
      return [];
    } catch (error) {
      logger.error('Failed to get user servers', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error('Failed to get user servers');
    }
  }

  findBestServerConnection(servers: any[], targetMachineId?: string): { serverUrl: string | null; accessToken: string | null } {
    try {
      logger.info('Finding best server connection', {
        serversCount: servers.length,
        targetMachineId,
        firstServer: servers[0] ? {
          name: servers[0].name,
          provides: servers[0].provides,
          owned: servers[0].owned,
          hasConnections: !!servers[0].connections,
          hasAccessToken: !!servers[0].accessToken
        } : 'none'
      });

      // Filter for servers that the user has access to
      // They either own it (owned=1) OR have an accessToken (shared with them)
      const accessibleServers = servers.filter(s =>
        s.provides === 'server' &&
        (s.owned === '1' || s.owned === 1 || s.owned === true || s.accessToken)
      );

      logger.info('Filtered accessible servers', {
        totalServers: servers.length,
        accessibleServers: accessibleServers.length,
        serverNames: accessibleServers.slice(0, 5).map((s: any) => s.name)
      });

      // If we have a target machine ID (from admin settings), try to match it
      let targetServer = null;
      if (targetMachineId) {
        targetServer = accessibleServers.find(s => s.clientIdentifier === targetMachineId);
      }

      // Otherwise, just use the first accessible server
      if (!targetServer && accessibleServers.length > 0) {
        targetServer = accessibleServers[0];
      }

      if (!targetServer) {
        logger.warn('No Plex server found in user resources', {
          totalServers: servers.length,
          accessibleServers: accessibleServers.length
        });
        return { serverUrl: null, accessToken: null };
      }

      const isSharedServer = targetServer.owned === '0' || targetServer.owned === 0 || targetServer.owned === false;
      const accessToken = isSharedServer ? targetServer.accessToken : null;

      logger.info('Found target server', {
        name: targetServer.name,
        machineId: targetServer.clientIdentifier,
        isShared: isSharedServer,
        hasAccessToken: !!accessToken,
        hasConnections: !!targetServer.connections,
        connectionsCount: targetServer.connections?.length || 0
      });

      // Find best connection URL
      // Prefer: local > relay
      const connections = targetServer.connections || targetServer.Connection || [];
      const connectionsArray = Array.isArray(connections) ? connections : [connections];

      logger.info('Checking connections', {
        connectionsCount: connectionsArray.length,
        firstConnection: connectionsArray[0] ? {
          uri: connectionsArray[0].uri,
          local: connectionsArray[0].local,
          protocol: connectionsArray[0].protocol
        } : 'none'
      });

      // First try local connections
      const localConn = connectionsArray.find((c: any) => c.local === 1 || c.local === '1' || c.local === true);
      if (localConn?.uri) {
        logger.info('Using local connection', { uri: localConn.uri, accessToken: accessToken ? 'present' : 'none' });
        return { serverUrl: localConn.uri, accessToken };
      }

      // Fall back to any available connection (including relay)
      const anyConn = connectionsArray.find((c: any) => c.uri);
      if (anyConn?.uri) {
        logger.info('Using relay/remote connection', { uri: anyConn.uri, accessToken: accessToken ? 'present' : 'none' });
        return { serverUrl: anyConn.uri, accessToken };
      }

      logger.warn('No valid connection URI found for server', {
        serverName: targetServer.name,
        connectionsCount: connectionsArray.length
      });
      return { serverUrl: null, accessToken: null };
    } catch (error) {
      logger.error('Error finding best server connection', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      return { serverUrl: null, accessToken: null };
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

      // For shared users (userToken provided), use axios directly
      // The plex-api library has issues with shared user tokens
      if (userToken) {
        const response = await axios.get(`${url}/library/sections`, {
          headers: {
            'X-Plex-Token': token,
            'Accept': 'application/json',
          },
        });

        if (!response.data?.MediaContainer?.Directory) {
          return [];
        }

        return response.data.MediaContainer.Directory.map((dir: any) => ({
          key: dir.key,
          title: dir.title,
          type: dir.type,
        }));
      }

      // For admin users (no userToken), use plex-api library as before
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
      } as any);

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

  async getLibraryContent(libraryKey: string, userToken?: string, viewType?: string): Promise<PlexMedia[]> {
    if (!this.client && !this.plexUrl) {
      throw new Error('Plex client not initialized');
    }

    try {
      let client: PlexAPI | null = null;
      if (userToken) {
        const connectionDetails = this.parseConnectionDetails(this.plexUrl || config.plex.url);
        // plex-api library supports port and https options, but TypeScript definitions are incomplete
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
        } as any);
      } else {
        client = this.client;
      }

      if (!client) {
        throw new Error('Plex client not available');
      }

      // For music/audiobook libraries (type: artist), fetch albums instead of artists
      // This provides a better browsing experience
      let endpoint = `/library/sections/${libraryKey}/all`;
      if (viewType === 'albums') {
        endpoint = `/library/sections/${libraryKey}/albums`;
      }

      const result = await client.query(endpoint);

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
        // plex-api library supports port and https options, but TypeScript definitions are incomplete
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
        } as any);
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

  async getSeasons(showRatingKey: string, userToken?: string): Promise<PlexMedia[]> {
    if (!this.client && !this.plexUrl) {
      throw new Error('Plex client not initialized');
    }

    try {
      let client: PlexAPI | null = null;
      if (userToken) {
        const connectionDetails = this.parseConnectionDetails(this.plexUrl || config.plex.url);
        // plex-api library supports port and https options, but TypeScript definitions are incomplete
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
        } as any);
      } else {
        client = this.client;
      }

      if (!client) {
        throw new Error('Plex client not available');
      }

      const result = await client.query(`/library/metadata/${showRatingKey}/children`);

      return result.MediaContainer.Metadata || [];
    } catch (error) {
      logger.error('Failed to get seasons', { error });
      throw new Error('Failed to get seasons');
    }
  }

  async getEpisodes(seasonRatingKey: string, userToken?: string): Promise<PlexMedia[]> {
    if (!this.client && !this.plexUrl) {
      throw new Error('Plex client not initialized');
    }

    try {
      let client: PlexAPI | null = null;
      if (userToken) {
        const connectionDetails = this.parseConnectionDetails(this.plexUrl || config.plex.url);
        // plex-api library supports port and https options, but TypeScript definitions are incomplete
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
        } as any);
      } else {
        client = this.client;
      }

      if (!client) {
        throw new Error('Plex client not available');
      }

      const result = await client.query(`/library/metadata/${seasonRatingKey}/children`);

      return result.MediaContainer.Metadata || [];
    } catch (error) {
      logger.error('Failed to get episodes', { error });
      throw new Error('Failed to get episodes');
    }
  }

  async getTracks(albumRatingKey: string, userToken?: string): Promise<PlexMedia[]> {
    if (!this.client && !this.plexUrl) {
      throw new Error('Plex client not initialized');
    }

    try {
      let client: PlexAPI | null = null;
      if (userToken) {
        const connectionDetails = this.parseConnectionDetails(this.plexUrl || config.plex.url);
        // plex-api library supports port and https options, but TypeScript definitions are incomplete
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
        } as any);
      } else {
        client = this.client;
      }

      if (!client) {
        throw new Error('Plex client not available');
      }

      const result = await client.query(`/library/metadata/${albumRatingKey}/children`);

      return result.MediaContainer.Metadata || [];
    } catch (error) {
      logger.error('Failed to get tracks', { error });
      throw new Error('Failed to get tracks');
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
        // plex-api library supports port and https options, but TypeScript definitions are incomplete
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
        } as any);
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
        // plex-api library supports port and https options, but TypeScript definitions are incomplete
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
        } as any);
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
