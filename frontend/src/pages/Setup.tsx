import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuthStore } from '../stores/authStore';

export const Setup: React.FC = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    email: '',
    plexUrl: '',
    plexToken: '',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { setUser, setToken } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await api.setup(formData);
      setUser(response.user);
      setToken(response.token);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Setup failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary-500 to-secondary-500 bg-clip-text text-transparent mb-2">
            PlexDownloadarr
          </h1>
          <p className="text-gray-400">Initial Setup</p>
        </div>

        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Admin Username</label>
              <input
                type="text"
                required
                className="input"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Admin Password</label>
              <input
                type="password"
                required
                className="input"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Admin Email</label>
              <input
                type="email"
                required
                className="input"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="pt-4 border-t border-dark-50">
              <p className="text-sm text-gray-400 mb-4">
                Plex Server Configuration (Optional - can be configured later)
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Plex Server URL</label>
                  <input
                    type="url"
                    className="input"
                    placeholder="http://your-plex-server:32400"
                    value={formData.plexUrl}
                    onChange={(e) => setFormData({ ...formData, plexUrl: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Plex Token</label>
                  <input
                    type="password"
                    className="input"
                    placeholder="Your Plex authentication token"
                    value={formData.plexToken}
                    onChange={(e) => setFormData({ ...formData, plexToken: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-2 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button type="submit" disabled={isLoading} className="btn-primary w-full">
              {isLoading ? 'Setting up...' : 'Complete Setup'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
