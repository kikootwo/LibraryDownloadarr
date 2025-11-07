import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { api } from '../services/api';

export const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPlexLoading, setIsPlexLoading] = useState(false);
  const navigate = useNavigate();
  const { login, setUser, setToken, token, user } = useAuthStore();

  // Redirect to home if already logged in
  useEffect(() => {
    if (token && user) {
      navigate('/', { replace: true });
    }
  }, [token, user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(username, password);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlexLogin = async () => {
    setError('');
    setIsPlexLoading(true);

    try {
      // Generate PIN
      const pin = await api.generatePlexPin();

      // Open Plex auth in new window
      window.open(pin.url, '_blank', 'width=600,height=700');

      // Poll for authentication
      const maxAttempts = 60; // 2 minutes (60 * 2 seconds)
      let attempts = 0;

      const pollInterval = setInterval(async () => {
        attempts++;

        try {
          const response = await api.authenticatePlexPin(pin.id);
          clearInterval(pollInterval);
          setUser(response.user);
          setToken(response.token);
          setIsPlexLoading(false);
          navigate('/');
        } catch (err: any) {
          // Check if this is a 403 (access denied) error
          if (err.response?.status === 403) {
            clearInterval(pollInterval);
            setError(err.response?.data?.error || 'Access denied. You do not have access to this Plex server.');
            setIsPlexLoading(false);
            return;
          }

          // Check if this is a 500 (server error) - likely machine ID not configured
          if (err.response?.status === 500) {
            clearInterval(pollInterval);
            setError(err.response?.data?.error || 'Server error. Please contact the administrator.');
            setIsPlexLoading(false);
            return;
          }

          // Check for timeout
          if (attempts >= maxAttempts) {
            clearInterval(pollInterval);
            setError('Plex authentication timeout. Please try again.');
            setIsPlexLoading(false);
          }
          // Continue polling for 400 errors (not yet authorized)
        }
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to initiate Plex login');
      setIsPlexLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-6 md:mb-8">
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary-500 to-secondary-500 bg-clip-text text-transparent mb-2">
            PlexDownloadarr
          </h1>
          <p className="text-sm md:text-base text-gray-400">Your Plex library, ready to download</p>
        </div>

        <div className="card p-6 md:p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm md:text-base font-medium mb-2">Username</label>
              <input
                type="text"
                required
                className="input text-sm md:text-base"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm md:text-base font-medium mb-2">Password</label>
              <input
                type="password"
                required
                className="input text-sm md:text-base"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-2 rounded-lg text-xs md:text-sm">
                {error}
              </div>
            )}

            <button type="submit" disabled={isLoading} className="btn-primary w-full text-sm md:text-base">
              {isLoading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-dark-50"></div>
            </div>
            <div className="relative flex justify-center text-xs md:text-sm">
              <span className="px-2 bg-dark-100 text-gray-400">Or</span>
            </div>
          </div>

          <button
            onClick={handlePlexLogin}
            disabled={isPlexLoading}
            className="btn-secondary w-full flex items-center justify-center space-x-2 text-sm md:text-base"
          >
            <span className="text-lg md:text-xl">🎬</span>
            <span>{isPlexLoading ? 'Waiting for Plex...' : 'Sign in with Plex'}</span>
          </button>

          {isPlexLoading && (
            <p className="text-xs md:text-sm text-gray-400 text-center mt-4">
              Please authorize in the Plex window that opened...
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
