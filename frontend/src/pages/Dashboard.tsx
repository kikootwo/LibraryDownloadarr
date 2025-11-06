import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/Header';
import { Sidebar } from '../components/Sidebar';
import { MediaGrid } from '../components/MediaGrid';
import { api } from '../services/api';
import { MediaItem } from '../types';

export const Dashboard: React.FC = () => {
  const [recentlyAdded, setRecentlyAdded] = useState<MediaItem[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const [media, downloadStats] = await Promise.all([
        api.getRecentlyAdded(12),
        api.getDownloadStats().catch(() => null),
      ]);
      setRecentlyAdded(media);
      setStats(downloadStats);
    } catch (error) {
      console.error('Failed to load dashboard', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatBytes = (bytes: number | null) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 p-8">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-3xl font-bold mb-6">Dashboard</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="card p-6">
                <div className="text-4xl mb-4">🎬</div>
                <h3 className="text-xl font-semibold mb-2">Browse Libraries</h3>
                <p className="text-gray-400 text-sm">
                  Access all your Plex libraries with full metadata and artwork
                </p>
              </div>

              <div className="card p-6">
                <div className="text-4xl mb-4">📊</div>
                <h3 className="text-xl font-semibold mb-2">Downloads</h3>
                {stats ? (
                  <div className="text-sm space-y-1">
                    <p className="text-gray-400">Total: {stats.count || 0}</p>
                    <p className="text-gray-400">Size: {formatBytes(stats.total_size)}</p>
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm">Track your download history and stats</p>
                )}
              </div>

              <div className="card p-6 cursor-pointer hover:border-primary-500 transition-colors" onClick={() => navigate('/settings')}>
                <div className="text-4xl mb-4">⚙️</div>
                <h3 className="text-xl font-semibold mb-2">Settings</h3>
                <p className="text-gray-400 text-sm">
                  Configure your Plex server connection
                </p>
              </div>
            </div>

            {isLoading ? (
              <div className="text-center text-gray-400 py-12">Loading...</div>
            ) : recentlyAdded.length > 0 ? (
              <div>
                <h3 className="text-2xl font-bold mb-4">Recently Added</h3>
                <MediaGrid media={recentlyAdded} />
              </div>
            ) : (
              <div className="card p-8 text-center">
                <p className="text-gray-400">
                  No recently added media found. Make sure your Plex server is configured in Settings.
                </p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};
