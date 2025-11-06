import axios, { AxiosInstance } from 'axios';
import {
  User,
  AuthResponse,
  Library,
  MediaItem,
  PlexPin,
  Settings,
} from '../types';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: '/api',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add token to requests
    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Handle 401 responses
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('token');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth endpoints
  async checkSetupRequired(): Promise<boolean> {
    const response = await this.client.get<{ setupRequired: boolean }>('/auth/setup/required');
    return response.data.setupRequired;
  }

  async setup(data: {
    username: string;
    password: string;
  }): Promise<AuthResponse> {
    const response = await this.client.post<AuthResponse>('/auth/setup', data);
    return response.data;
  }

  async login(username: string, password: string): Promise<AuthResponse> {
    const response = await this.client.post<AuthResponse>('/auth/login', { username, password });
    return response.data;
  }

  async generatePlexPin(): Promise<PlexPin> {
    const response = await this.client.post<PlexPin>('/auth/plex/pin');
    return response.data;
  }

  async authenticatePlexPin(pinId: number): Promise<AuthResponse> {
    const response = await this.client.post<AuthResponse>('/auth/plex/authenticate', { pinId });
    return response.data;
  }

  async getCurrentUser(): Promise<User> {
    const response = await this.client.get<{ user: User }>('/auth/me');
    return response.data.user;
  }

  async logout(): Promise<void> {
    await this.client.post('/auth/logout');
    localStorage.removeItem('token');
  }

  // Library endpoints
  async getLibraries(): Promise<Library[]> {
    const response = await this.client.get<{ libraries: Library[] }>('/libraries');
    return response.data.libraries;
  }

  async getLibraryContent(libraryKey: string): Promise<MediaItem[]> {
    const response = await this.client.get<{ content: MediaItem[] }>(
      `/libraries/${libraryKey}/content`
    );
    return response.data.content;
  }

  // Media endpoints
  async getRecentlyAdded(limit: number = 20): Promise<MediaItem[]> {
    const response = await this.client.get<{ media: MediaItem[] }>('/media/recently-added', {
      params: { limit },
    });
    return response.data.media;
  }

  async searchMedia(query: string): Promise<MediaItem[]> {
    const response = await this.client.get<{ results: MediaItem[] }>('/media/search', {
      params: { q: query },
    });
    return response.data.results;
  }

  async getMediaMetadata(ratingKey: string): Promise<MediaItem> {
    const response = await this.client.get<{ metadata: MediaItem }>(`/media/${ratingKey}`);
    return response.data.metadata;
  }

  async getDownloadHistory(limit: number = 50): Promise<any[]> {
    const response = await this.client.get<{ history: any[] }>('/media/download-history', {
      params: { limit },
    });
    return response.data.history;
  }

  async getDownloadStats(): Promise<any> {
    const response = await this.client.get<{ stats: any }>('/media/download-stats');
    return response.data.stats;
  }

  getDownloadUrl(ratingKey: string, partKey: string): string {
    const token = localStorage.getItem('token');
    return `/api/media/${ratingKey}/download?partKey=${encodeURIComponent(
      partKey
    )}&token=${token}`;
  }

  getThumbnailUrl(ratingKey: string, path: string): string {
    return `/api/media/thumb/${ratingKey}?path=${encodeURIComponent(path)}`;
  }

  // Settings endpoints
  async getSettings(): Promise<Settings> {
    const response = await this.client.get<{ settings: Settings }>('/settings');
    return response.data.settings;
  }

  async updateSettings(settings: Partial<Settings>): Promise<void> {
    await this.client.put('/settings', settings);
  }

  async testPlexConnection(): Promise<boolean> {
    const response = await this.client.post<{ connected: boolean }>('/settings/test-connection');
    return response.data.connected;
  }
}

export const api = new ApiClient();
