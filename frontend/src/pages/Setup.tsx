import React, { useState } from 'react';
import { api } from '../services/api';
import { useAuthStore } from '../stores/authStore';

export const Setup: React.FC = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { setUser, setToken } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await api.setup(formData);
      setUser(response.user);
      setToken(response.token);
      // Reload the app to trigger the setup check again
      window.location.href = '/';
    } catch (err: any) {
      setError(err.response?.data?.error || 'Setup failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-6 md:mb-8">
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary-500 to-secondary-500 bg-clip-text text-transparent mb-2">
            PlexDownloadarr
          </h1>
          <p className="text-sm md:text-base text-gray-400">Initial Setup</p>
        </div>

        <div className="card p-6 md:p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm md:text-base font-medium mb-2">Admin Username</label>
              <input
                type="text"
                required
                className="input text-sm md:text-base"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm md:text-base font-medium mb-2">Admin Password</label>
              <input
                type="password"
                required
                className="input text-sm md:text-base"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>

            <div className="text-xs md:text-sm text-gray-400 mt-4">
              You can configure your Plex server connection in the Settings page after setup.
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-2 rounded-lg text-xs md:text-sm">
                {error}
              </div>
            )}

            <button type="submit" disabled={isLoading} className="btn-primary w-full text-sm md:text-base">
              {isLoading ? 'Setting up...' : 'Complete Setup'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
