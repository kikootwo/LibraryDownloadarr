import React, { useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useNavigate } from 'react-router-dom';

interface HeaderProps {
  onMenuClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { user, logout } = useAuthStore();
  const [showMenu, setShowMenu] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleSearch = (value: string) => {
    if (value) {
      navigate(`/search?q=${encodeURIComponent(value)}`);
      setShowMobileSearch(false);
    }
  };

  return (
    <header className="bg-dark-100 border-b border-dark-50 px-4 md:px-6" style={{
      paddingTop: 'calc(0.75rem + env(safe-area-inset-top))',
      paddingBottom: '0.75rem',
    }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {/* Hamburger Menu Button (Mobile) */}
          {onMenuClick && (
            <button
              onClick={onMenuClick}
              className="md:hidden p-2 hover:bg-dark-200 rounded-lg transition-colors"
              aria-label="Toggle menu"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M4 6h16M4 12h16M4 18h16"></path>
              </svg>
            </button>
          )}

          <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-primary-500 to-secondary-500 bg-clip-text text-transparent">
            LibraryDownloadarr
          </h1>
        </div>

        <div className="flex items-center space-x-2 md:space-x-4">
          {/* Desktop Search Bar */}
          <div className="hidden md:block">
            <input
              type="text"
              placeholder="Search media..."
              className="input w-64"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearch(e.currentTarget.value);
                }
              }}
            />
          </div>

          {/* Mobile Search Button */}
          <button
            onClick={() => setShowMobileSearch(!showMobileSearch)}
            className="md:hidden p-2 hover:bg-dark-200 rounded-lg transition-colors"
            aria-label="Search"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
          </button>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="flex items-center space-x-2 px-2 md:px-3 py-2 rounded-lg hover:bg-dark-200 transition-colors"
            >
              <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
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
                    className="w-full text-left px-4 py-2 hover:bg-dark-200 transition-colors text-sm"
                  >
                    Settings
                  </button>
                )}
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 hover:bg-dark-200 transition-colors text-red-400 text-sm"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Search Bar (Expandable) */}
      {showMobileSearch && (
        <div className="mt-3 md:hidden">
          <input
            type="text"
            placeholder="Search media..."
            className="input w-full"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSearch(e.currentTarget.value);
              }
              if (e.key === 'Escape') {
                setShowMobileSearch(false);
              }
            }}
            onBlur={() => {
              // Delay to allow click events to fire
              setTimeout(() => setShowMobileSearch(false), 200);
            }}
          />
        </div>
      )}
    </header>
  );
};
