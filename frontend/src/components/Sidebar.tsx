import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../services/api';
import { Library } from '../types';
import { useAuthStore } from '../stores/authStore';

export const Sidebar: React.FC = () => {
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

  return (
    <aside className="w-64 bg-dark-100 border-r border-dark-50 p-4">
      <nav className="space-y-2">
        {user?.isAdmin && (
          <button
            onClick={() => navigate('/')}
            className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
              isActive('/') ? 'bg-dark-200 text-primary-400' : 'hover:bg-dark-200'
            }`}
          >
            Home
          </button>
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
                onClick={() => navigate(`/library/${library.key}`)}
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
                  <span>{library.title}</span>
                </div>
              </button>
            ))}
          </>
        )}
      </nav>
    </aside>
  );
};
