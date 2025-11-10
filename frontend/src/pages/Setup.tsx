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
      <div className="max-w-xl w-full">
        <div className="text-center mb-6 md:mb-8">
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary-500 to-secondary-500 bg-clip-text text-transparent mb-2">
            PlexDownloadarr
          </h1>
          <p className="text-base md:text-lg text-gray-300 font-medium">Welcome! Let's get started</p>
        </div>

        {/* Info Callout */}
        <div className="card p-4 md:p-6 mb-6 border-2 border-primary-500/20 bg-primary-500/5">
          <div className="flex items-start space-x-3">
            <div className="text-2xl md:text-3xl mt-0.5">🔐</div>
            <div>
              <h2 className="text-lg md:text-xl font-bold text-primary-400 mb-2">One-Time Setup: Create Admin Account</h2>
              <p className="text-sm md:text-base text-gray-300 mb-2">
                This is a <strong>one-time setup</strong> to create your administrator account. You'll only need to do this once.
              </p>
              <ul className="text-xs md:text-sm text-gray-400 space-y-1 list-disc list-inside">
                <li>This admin account will have full access to settings and logs</li>
                <li>After setup, you'll configure your Plex server connection</li>
                <li>Regular users will sign in using their Plex accounts</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="card p-6 md:p-8">
          <h3 className="text-xl md:text-2xl font-bold mb-6">Create Your Admin Account</h3>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm md:text-base font-medium mb-2 text-gray-200">Admin Username</label>
              <input
                type="text"
                required
                className="input text-sm md:text-base"
                placeholder="Choose a username"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              />
              <p className="text-xs text-gray-500 mt-1">This will be your administrator login</p>
            </div>

            <div>
              <label className="block text-sm md:text-base font-medium mb-2 text-gray-200">Admin Password</label>
              <input
                type="password"
                required
                minLength={6}
                className="input text-sm md:text-base"
                placeholder="Choose a secure password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
              <p className="text-xs text-gray-500 mt-1">Minimum 6 characters</p>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-xs md:text-sm">
                {error}
              </div>
            )}

            <button type="submit" disabled={isLoading} className="btn-primary w-full text-sm md:text-base py-3 font-semibold">
              {isLoading ? 'Creating Account...' : 'Create Admin Account & Continue'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-dark-50">
            <p className="text-xs md:text-sm text-gray-400 text-center">
              <strong>Next step:</strong> After creating your admin account, you'll configure your Plex server connection in the Settings page.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
