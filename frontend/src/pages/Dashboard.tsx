import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/Header';
import { Sidebar } from '../components/Sidebar';
import { MediaGrid } from '../components/MediaGrid';
import { api } from '../services/api';
import { MediaItem } from '../types';
import { useAuthStore } from '../stores/authStore';
import { useMobileMenu } from '../hooks/useMobileMenu';

export const Dashboard: React.FC = () => {
  const [recentlyAdded, setRecentlyAdded] = useState<MediaItem[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { isMobileMenuOpen, toggleMobileMenu, closeMobileMenu } = useMobileMenu();

  useEffect(() => {
    // Wait for user to be loaded
    if (!user) {
      return;
    }

    // Load dashboard for all users
    loadDashboard();
  }, [user]);

  const loadDashboard = async () => {
    try {
      const [media, downloadStats] = await Promise.all([
        api.getRecentlyAdded(100),
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
      <Header onMenuClick={toggleMobileMenu} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar isOpen={isMobileMenuOpen} onClose={closeMobileMenu} />
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold mb-4 md:mb-6">Home</h2>

            {user?.isAdmin && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
                <div className="card p-4 md:p-6">
                  <div className="text-3xl md:text-4xl mb-3 md:mb-4">🎬</div>
                  <h3 className="text-lg md:text-xl font-semibold mb-2">Browse Libraries</h3>
                  <p className="text-gray-400 text-xs md:text-sm">
                    Access all your Plex libraries with full metadata and artwork
                  </p>
                </div>

                <div className="card p-4 md:p-6 cursor-pointer hover:border-primary-500 transition-colors" onClick={() => navigate('/admin/download-history')}>
                  <div className="text-3xl md:text-4xl mb-3 md:mb-4">📊</div>
                  <h3 className="text-lg md:text-xl font-semibold mb-2">Downloads</h3>
                  {stats ? (
                    <div className="text-xs md:text-sm space-y-1">
                      <p className="text-gray-400">Total: {stats.count || 0}</p>
                      <p className="text-gray-400">Size: {formatBytes(stats.total_size)}</p>
                      <p className="text-primary-400 text-xs mt-2">Click to view history →</p>
                    </div>
                  ) : (
                    <p className="text-gray-400 text-xs md:text-sm">Track your download history and stats</p>
                  )}
                </div>

                <div className="card p-4 md:p-6 cursor-pointer hover:border-primary-500 transition-colors sm:col-span-2 md:col-span-1" onClick={() => navigate('/settings')}>
                  <div className="text-3xl md:text-4xl mb-3 md:mb-4">⚙️</div>
                  <h3 className="text-lg md:text-xl font-semibold mb-2">Settings</h3>
                  <p className="text-gray-400 text-xs md:text-sm">
                    Configure your Plex server connection
                  </p>
                </div>
              </div>
            )}

            {isLoading ? (
              <div className="text-center text-gray-400 py-12">Loading...</div>
            ) : recentlyAdded.length > 0 ? (
              <div>
                <h3 className="text-xl md:text-2xl font-bold mb-3 md:mb-4">Recently Added</h3>
                <MediaGrid media={recentlyAdded} />
              </div>
            ) : (
              <div className="card p-6 md:p-8 text-center">
                <p className="text-gray-400 text-sm md:text-base">
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
