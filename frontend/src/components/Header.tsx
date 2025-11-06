import React, { useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useNavigate } from 'react-router-dom';

export const Header: React.FC = () => {
  const { user, logout } = useAuthStore();
  const [showMenu, setShowMenu] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="bg-dark-100 border-b border-dark-50 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary-500 to-secondary-500 bg-clip-text text-transparent">
            PlexDownloadarr
          </h1>
        </div>

        <div className="flex items-center space-x-4">
          {/* Search Bar - Will implement later */}
          <div className="hidden md:block">
            <input
              type="text"
              placeholder="Search media..."
              className="input w-64"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.currentTarget.value) {
                  navigate(`/search?q=${encodeURIComponent(e.currentTarget.value)}`);
                }
              }}
            />
          </div>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-dark-200 transition-colors"
            >
              <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-full flex items-center justify-center text-white font-semibold">
                {user?.username.charAt(0).toUpperCase()}
              </div>
              <span className="hidden md:block text-sm font-medium">{user?.username}</span>
            </button>

            {showMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-dark-100 rounded-lg shadow-xl border border-dark-50 py-2 z-50">
                {user?.isAdmin && (
                  <button
                    onClick={() => {
                      navigate('/settings');
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-dark-200 transition-colors"
                  >
                    Settings
                  </button>
                )}
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 hover:bg-dark-200 transition-colors text-red-400"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
