import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../services/api';
import { Library } from '../types';
import { useAuthStore } from '../stores/authStore';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();

  useEffect(() => {
    loadLibraries();
  }, []);

  const loadLibraries = async () => {
    try {
      const data = await api.getLibraries();
      setLibraries(data);
    } catch (error) {
      console.error('Failed to load libraries:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const isActive = (path: string) => location.pathname === path;

  const handleNavigate = (path: string) => {
    navigate(path);
    onClose(); // Close mobile menu after navigation
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-50
          w-64 bg-dark-100 border-r border-dark-50
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
        style={{
          paddingTop: 'calc(1rem + env(safe-area-inset-top))',
          paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))',
          paddingLeft: 'calc(1rem + env(safe-area-inset-left))',
          paddingRight: '1rem',
        }}
      >
        <nav className="space-y-2">
          <button
            onClick={() => handleNavigate('/')}
            className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
              isActive('/') ? 'bg-dark-200 text-primary-400' : 'hover:bg-dark-200'
            }`}
          >
            🏠 Home
          </button>

          {user?.isAdmin && (
            <>
              <button
                onClick={() => handleNavigate('/admin/download-history')}
                className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                  isActive('/admin/download-history') ? 'bg-dark-200 text-primary-400' : 'hover:bg-dark-200'
                }`}
              >
                📊 Download History
              </button>
              <button
                onClick={() => handleNavigate('/admin/logs')}
                className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                  isActive('/admin/logs') ? 'bg-dark-200 text-primary-400' : 'hover:bg-dark-200'
                }`}
              >
                📋 Logs
              </button>
              <button
                onClick={() => handleNavigate('/settings')}
                className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                  isActive('/settings') ? 'bg-dark-200 text-primary-400' : 'hover:bg-dark-200'
                }`}
              >
                ⚙️ Settings
              </button>
            </>
          )}

          {isLoading ? (
            <div className="px-4 py-2 text-sm text-gray-500">Loading libraries...</div>
          ) : (
            <>
              <div className="pt-4 pb-2 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Libraries
              </div>
              {libraries.map((library) => (
                <button
                  key={library.key}
                  onClick={() => handleNavigate(`/library/${library.key}`)}
                  className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                    location.pathname === `/library/${library.key}`
                      ? 'bg-dark-200 text-primary-400'
                      : 'hover:bg-dark-200'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <span>
                      {library.type === 'movie'
                        ? '🎬'
                        : library.type === 'show'
                        ? '📺'
                        : library.type === 'artist'
                        ? '🎵'
                        : '📁'}
                    </span>
                    <span className="truncate">{library.title}</span>
                  </div>
                </button>
              ))}
            </>
          )}
        </nav>
      </aside>
    </>
  );
};
