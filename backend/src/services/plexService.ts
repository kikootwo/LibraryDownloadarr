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
  librarySectionID?: string;
  librarySectionTitle?: string;
  grandparentTitle?: string;
  parentTitle?: string;
  index?: number;
  parentIndex?: number;
  parentRatingKey?: string;
  allowSync?: boolean | number | string; // Download permission: false/0/'0' means download disabled
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
  private plexUrl: string | null = null;

  constructor() {
    // Plex configuration is now set via setServerConnection() when admin configures settings
  }

  private parseConnectionDetails(urlOrHostname: string): { hostname: string; port: number; https: boolean } {
    try {
      if (urlOrHostname.startsWith('http://') || urlOrHostname.startsWith('https://')) {
        const url = new URL(urlOrHostname);
        const port = url.port ? parseInt(url.port) : (url.protocol === 'https:' ? 443 : 32400);
        const https = url.protocol === 'https:';

        logger.debug('Parsed connection details from URL', {
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

      if (urlOrHostname.includes(':')) {
        const [hostname, portStr] = urlOrHostname.split(':');
        const port = parseInt(portStr) || 32400;
        logger.debug('Parsed connection details from host:port', { hostname, port });
        return { hostname, port, https: false };
      }

      logger.debug('Using hostname with default port', { hostname: urlOrHostname, port: 32400 });
      return { hostname: urlOrHostname, port: 32400, https: false };
    } catch (error) {
      logger.warn('Failed to parse Plex URL, using defaults', { urlOrHostname, error });
      return { hostname: urlOrHostname, port: 32400, https: false };
    }
  }

  private initializeClient(urlOrHostname: string, _token: string): void {
    const connectionDetails = this.parseConnectionDetails(urlOrHostname);
    const protocol = connectionDetails.https ? 'https' : 'http';
    this.plexUrl = `${protocol}://${connectionDetails.hostname}:${connectionDetails.port}`;

    logger.debug('Plex connection initialized', {
      hostname: connectionDetails.hostname,
      port: connectionDetails.port,
      https: connectionDetails.https
    });
  }

  setServerConnection(urlOrHostname: string, token: string): void {
    this.initializeClient(urlOrHostname, token);
  }

  async testConnection(): Promise<boolean> {
    if (!this.plexUrl) {
      return false;
    }

    try {
      await axios.get(`${this.plexUrl}/`);
      return true;
    } catch (error) {
      logger.error('Failed to connect to Plex server', { error });
      return false;
    }
  }

  async testConnectionWithCredentials(urlOrHostname: string, token: string): Promise<boolean> {
    try {
      const connectionDetails = this.parseConnectionDetails(urlOrHostname);
      const protocol = connectionDetails.https ? 'https' : 'http';
      const url = `${protocol}://${connectionDetails.hostname}:${connectionDetails.port}`;

      await axios.get(`${url}/`, {
        headers: {
          'X-Plex-Token': token,
        },
      });
      return true;
    } catch (error) {
      logger.error('Failed to test connection with provided credentials', { error });
      return false;
    }
  }

  // OAuth PIN Flow - using direct axios calls as these are Plex.tv APIs, not server APIs
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

      logger.debug('Plex PIN response', {
        hasAuthToken: !!response.data.authToken,
        userData: response.data,
      });

      if (response.data.authToken) {
        let username = response.data.username || response.data.title || response.data.friendlyName;

        try {
          const userInfo = await this.getUserInfo(response.data.authToken);
          username = userInfo.friendlyName || userInfo.friendly_name || userInfo.username || userInfo.title || username;
          logger.debug('Fetched detailed user info', { username, userInfo });
        } catch (error) {
          logger.warn('Could not fetch detailed user info, using PIN data', { error });
        }

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
      const response = await axios.get('https://plex.tv/api/resources', {
        headers: {
          'X-Plex-Token': userToken,
        },
        params: {
          includeHttps: '1',
          includeRelay: '1',
        },
      });

      const parsed = await parseStringAsync(response.data, {
        explicitArray: false,
        mergeAttrs: true,
      });

      logger.debug('getUserServers parsed XML', {
        hasMediaContainer: !!parsed?.MediaContainer,
        hasDevice: !!parsed?.MediaContainer?.Device,
        deviceType: typeof parsed?.MediaContainer?.Device
      });

      if (parsed?.MediaContainer?.Device) {
        const devices = Array.isArray(parsed.MediaContainer.Device)
          ? parsed.MediaContainer.Device
          : [parsed.MediaContainer.Device];

        logger.debug('Extracted devices from XML', {
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
      logger.debug('Finding best server connection', {
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

      const accessibleServers = servers.filter(s =>
        s.provides === 'server' &&
        (s.owned === '1' || s.owned === 1 || s.owned === true || s.accessToken)
      );

      logger.debug('Filtered accessible servers', {
        totalServers: servers.length,
        accessibleServers: accessibleServers.length,
        serverNames: accessibleServers.slice(0, 5).map((s: any) => s.name)
      });

      let targetServer = null;
      if (targetMachineId) {
        targetServer = accessibleServers.find(s => s.clientIdentifier === targetMachineId);
      }

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

      logger.debug('Found target server', {
        name: targetServer.name,
        machineId: targetServer.clientIdentifier,
        isShared: isSharedServer,
        hasAccessToken: !!accessToken,
        hasConnections: !!targetServer.connections,
        connectionsCount: targetServer.connections?.length || 0
      });

      const connections = targetServer.connections || targetServer.Connection || [];
      const connectionsArray = Array.isArray(connections) ? connections : [connections];

      logger.debug('Checking connections', {
        connectionsCount: connectionsArray.length,
        firstConnection: connectionsArray[0] ? {
          uri: connectionsArray[0].uri,
          local: connectionsArray[0].local,
          protocol: connectionsArray[0].protocol
        } : 'none'
      });

      const localConn = connectionsArray.find((c: any) => c.local === 1 || c.local === '1' || c.local === true);
      if (localConn?.uri) {
        logger.debug('Using local connection', { uri: localConn.uri, accessToken: accessToken ? 'present' : 'none' });
        return { serverUrl: localConn.uri, accessToken };
      }

      const anyConn = connectionsArray.find((c: any) => c.uri);
      if (anyConn?.uri) {
        logger.debug('Using relay/remote connection', { uri: anyConn.uri, accessToken: accessToken ? 'present' : 'none' });
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

  async getServerIdentity(token: string): Promise<{ machineIdentifier: string; friendlyName: string } | null> {
    try {
      const url = this.plexUrl;

      if (!url) {
        logger.error('No Plex URL configured for getServerIdentity');
        return null;
      }

      const identityResponse = await axios.get(`${url}/identity`, {
        headers: {
          'X-Plex-Token': token,
          'Accept': 'application/json',
        },
      });

      const identityData = identityResponse.data?.MediaContainer;
      const machineIdentifier = identityData?.machineIdentifier;

      if (!machineIdentifier) {
        logger.error('No machine identifier in identity response');
        return null;
      }

      const rootResponse = await axios.get(`${url}/`, {
        headers: {
          'X-Plex-Token': token,
          'Accept': 'application/json',
        },
      });

      const rootData = rootResponse.data?.MediaContainer;

      logger.debug('Plex root response for server name', {
        friendlyName: rootData?.friendlyName,
        title: rootData?.title,
        keys: rootData ? Object.keys(rootData).slice(0, 10) : []
      });

      const serverName = rootData?.friendlyName || rootData?.title || 'Plex Server';

      return {
        machineIdentifier,
        friendlyName: serverName
      };
    } catch (error) {
      logger.error('Failed to get server identity', { error });
      return null;
    }
  }

  // Library operations using direct HTTP calls
  async getLibraries(userToken?: string): Promise<PlexLibrary[]> {
    try {
      const url = this.plexUrl;
      const token = userToken;

      logger.debug('getLibraries called', {
        hasUrl: !!url,
        hasToken: !!token,
        url: url || 'MISSING'
      });

      if (!url || !token) {
        throw new Error(`Plex URL and token are required. Please configure in Settings. (url: ${!!url}, token: ${!!token})`);
      }

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
    } catch (error: any) {
      logger.error('Failed to get libraries', {
        error: error.message,
        stack: error.stack,
        hasUrl: !!(this.plexUrl),
        hasToken: !!userToken
      });
      throw error;
    }
  }

  async getLibraryContent(libraryKey: string, userToken?: string, viewType?: string): Promise<PlexMedia[]> {
    if (!this.plexUrl) {
      throw new Error('Plex server not configured');
    }

    try {
      let endpoint = `/library/sections/${libraryKey}/all`;
      if (viewType === 'albums') {
        endpoint = `/library/sections/${libraryKey}/albums`;
      }

      const response = await axios.get(`${this.plexUrl}${endpoint}`, {
        headers: {
          'X-Plex-Token': userToken || '',
          'Accept': 'application/json',
        },
      });

      return response.data?.MediaContainer?.Metadata || [];
    } catch (error) {
      logger.error('Failed to get library content', { error });
      throw new Error('Failed to get library content');
    }
  }

  async getMediaMetadata(ratingKey: string, userToken?: string): Promise<PlexMedia> {
    if (!this.plexUrl) {
      throw new Error('Plex server not configured');
    }

    try {
      const response = await axios.get(`${this.plexUrl}/library/metadata/${ratingKey}`, {
        headers: {
          'X-Plex-Token': userToken || '',
          'Accept': 'application/json',
        },
      });

      return response.data?.MediaContainer?.Metadata?.[0];
    } catch (error) {
      logger.error('Failed to get media metadata', { error });
      throw new Error('Failed to get media metadata');
    }
  }

  async getSeasons(showRatingKey: string, userToken?: string): Promise<PlexMedia[]> {
    if (!this.plexUrl) {
      throw new Error('Plex server not configured');
    }

    try {
      const response = await axios.get(`${this.plexUrl}/library/metadata/${showRatingKey}/children`, {
        headers: {
          'X-Plex-Token': userToken || '',
          'Accept': 'application/json',
        },
      });

      return response.data?.MediaContainer?.Metadata || [];
    } catch (error) {
      logger.error('Failed to get seasons', { error });
      throw new Error('Failed to get seasons');
    }
  }

  async getEpisodes(seasonRatingKey: string, userToken?: string): Promise<PlexMedia[]> {
    if (!this.plexUrl) {
      throw new Error('Plex server not configured');
    }

    try {
      const response = await axios.get(`${this.plexUrl}/library/metadata/${seasonRatingKey}/children`, {
        headers: {
          'X-Plex-Token': userToken || '',
          'Accept': 'application/json',
        },
      });

      return response.data?.MediaContainer?.Metadata || [];
    } catch (error) {
      logger.error('Failed to get episodes', { error });
      throw new Error('Failed to get episodes');
    }
  }

  async getTracks(albumRatingKey: string, userToken?: string): Promise<PlexMedia[]> {
    if (!this.plexUrl) {
      throw new Error('Plex server not configured');
    }

    try {
      const response = await axios.get(`${this.plexUrl}/library/metadata/${albumRatingKey}/children`, {
        headers: {
          'X-Plex-Token': userToken || '',
          'Accept': 'application/json',
        },
      });

      return response.data?.MediaContainer?.Metadata || [];
    } catch (error) {
      logger.error('Failed to get tracks', { error });
      throw new Error('Failed to get tracks');
    }
  }

  async search(query: string, userToken?: string): Promise<PlexMedia[]> {
    if (!this.plexUrl) {
      throw new Error('Plex server not configured');
    }

    try {
      logger.debug('Executing Plex search query', { query, endpoint: '/search' });

      const response = await axios.get(`${this.plexUrl}/search`, {
        params: { query },
        headers: {
          'X-Plex-Token': userToken || '',
          'Accept': 'application/json',
        },
      });

      logger.debug('Search query completed', {
        hasResults: !!response.data?.MediaContainer?.Metadata,
        resultCount: response.data?.MediaContainer?.Metadata?.length || 0
      });

      return response.data?.MediaContainer?.Metadata || [];
    } catch (error: any) {
      logger.error('Failed to search', {
        error: error.message,
        stack: error.stack,
        query,
        hasPlexUrl: !!this.plexUrl
      });
      throw error;
    }
  }

  async getRecentlyAdded(userToken?: string, limit: number = 20): Promise<PlexMedia[]> {
    if (!this.plexUrl) {
      throw new Error('Plex server not configured');
    }

    try {
      const libraries = await this.getLibraries(userToken);
      logger.debug('Fetching recently added from all libraries', {
        libraryCount: libraries.length,
        libraries: libraries.map(l => ({ key: l.key, title: l.title, type: l.type }))
      });

      const allMedia: PlexMedia[] = [];
      const itemsPerLibrary = Math.ceil(limit / libraries.length) + 5;

      for (const library of libraries) {
        try {
          const response = await axios.get(`${this.plexUrl}/library/sections/${library.key}/recentlyAdded`, {
            params: {
              'X-Plex-Container-Start': 0,
              'X-Plex-Container-Size': itemsPerLibrary,
            },
            headers: {
              'X-Plex-Token': userToken || '',
              'Accept': 'application/json',
            },
          });

          const metadata = response.data?.MediaContainer?.Metadata || [];
          logger.debug(`Library ${library.title} recently added`, {
            libraryKey: library.key,
            libraryType: library.type,
            itemCount: metadata.length,
            mediaTypes: metadata.map((m: any) => m.type).filter((v: any, i: any, a: any) => a.indexOf(v) === i)
          });

          allMedia.push(...metadata);
        } catch (error: any) {
          logger.warn(`Failed to get recently added from library ${library.title}`, {
            libraryKey: library.key,
            error: error.message
          });
        }
      }

      const sorted = allMedia
        .filter(m => m.addedAt)
        .sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0))
        .slice(0, limit);

      logger.debug('Recently added query completed', {
        requestedLimit: limit,
        totalFetched: allMedia.length,
        returnedCount: sorted.length,
        mediaTypes: sorted.map((m: any) => m.type).filter((v: any, i: any, a: any) => a.indexOf(v) === i)
      });

      return sorted;
    } catch (error: any) {
      logger.error('Failed to get recently added', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  getDownloadUrl(partKey: string, token: string): string {
    const baseUrl = this.plexUrl;
    if (!baseUrl) {
      throw new Error('Plex server URL not configured');
    }

    return `${baseUrl}${partKey}?download=1&X-Plex-Token=${token}`;
  }

  getThumbnailUrl(thumbPath: string, token: string): string {
    const baseUrl = this.plexUrl;
    if (!baseUrl || !thumbPath) {
      return '';
    }

    return `${baseUrl}${thumbPath}?X-Plex-Token=${token}`;
  }
}

export const plexService = new PlexService();
