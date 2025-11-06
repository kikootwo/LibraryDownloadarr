declare module 'plex-api' {
  interface PlexAPIOptions {
    hostname: string;
    token: string;
    options?: {
      identifier?: string;
      product?: string;
      version?: string;
      deviceName?: string;
    };
  }

  class PlexAPI {
    constructor(options: PlexAPIOptions);
    query(path: string, params?: any): Promise<any>;
  }

  export = PlexAPI;
}
