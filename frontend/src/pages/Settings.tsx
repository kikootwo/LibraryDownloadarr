import React, { useEffect, useState } from 'react';
import { Header } from '../components/Header';
import { Sidebar } from '../components/Sidebar';
import { api } from '../services/api';
import { Settings as SettingsType } from '../types';
import { useMobileMenu } from '../hooks/useMobileMenu';

export const Settings: React.FC = () => {
  const { isMobileMenuOpen, toggleMobileMenu, closeMobileMenu } = useMobileMenu();
  const [settings, setSettings] = useState<SettingsType>({
    plexUrl: '',
    hasPlexToken: false,
  });
  const [plexUrl, setPlexUrl] = useState('');
  const [plexToken, setPlexToken] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await api.getSettings();
      setSettings(data);
      setPlexUrl(data.plexUrl);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to load settings' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    try {
      const updateData: any = {};
      if (plexUrl) {
        updateData.plexUrl = plexUrl;
      }
      if (plexToken) {
        updateData.plexToken = plexToken;
      }

      await api.updateSettings(updateData);

      setMessage({ type: 'success', text: 'Settings saved successfully' });
      await loadSettings();
      setPlexToken('');
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to save settings' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setMessage(null);

    try {
      // Use values from input boxes if provided, otherwise use saved settings
      const urlToTest = plexUrl || settings.plexUrl;
      const tokenToTest = plexToken || (settings.hasPlexToken ? 'saved' : '');

      if (!urlToTest) {
        setMessage({ type: 'error', text: 'Please enter a Plex server URL' });
        setIsTesting(false);
        return;
      }

      if (!tokenToTest && !settings.hasPlexToken) {
        setMessage({ type: 'error', text: 'Please enter a Plex token' });
        setIsTesting(false);
        return;
      }

      const connected = await api.testPlexConnection(
        plexUrl || undefined,
        plexToken || undefined
      );
      if (connected) {
        setMessage({ type: 'success', text: 'Successfully connected to Plex server' });
      } else {
        setMessage({ type: 'error', text: 'Failed to connect to Plex server' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to test connection' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsChangingPassword(true);
    setPasswordMessage(null);

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'All fields are required' });
      setIsChangingPassword(false);
      return;
    }

    if (newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: 'New password must be at least 6 characters long' });
      setIsChangingPassword(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'New passwords do not match' });
      setIsChangingPassword(false);
      return;
    }

    try {
      await api.changePassword(currentPassword, newPassword);
      setPasswordMessage({ type: 'success', text: 'Password changed successfully' });

      // Clear form
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordMessage({
        type: 'error',
        text: err.response?.data?.error || 'Failed to change password'
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header onMenuClick={toggleMobileMenu} />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar isOpen={isMobileMenuOpen} onClose={closeMobileMenu} />
          <main className="flex-1 p-4 md:p-8 overflow-y-auto flex items-center justify-center">
            <div className="text-gray-400">Loading...</div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header onMenuClick={toggleMobileMenu} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar isOpen={isMobileMenuOpen} onClose={closeMobileMenu} />
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          <div className="max-w-3xl">
            <h1 className="text-2xl md:text-3xl font-bold mb-4 md:mb-6">Settings</h1>

            <div className="card p-4 md:p-6">
              <form onSubmit={handleSave} className="space-y-4 md:space-y-6">
                <div>
                  <h2 className="text-xl md:text-2xl font-semibold mb-4">Plex Server Configuration</h2>

                  <div className="space-y-3 md:space-y-4">
                    <div>
                      <label className="block text-sm md:text-base font-medium mb-2">Plex Server URL</label>
                      <input
                        type="text"
                        className="input text-sm md:text-base"
                        placeholder="http://127.0.0.1:32400"
                        value={plexUrl}
                        onChange={(e) => setPlexUrl(e.target.value)}
                      />
                      <p className="text-xs md:text-sm text-gray-500 mt-1">
                        The URL of your Plex Media Server. For local Docker containers, use:
                        <br />
                        • <code className="text-gray-400">http://127.0.0.1:32400</code> or <code className="text-gray-400">http://localhost:32400</code>
                        <br />
                        • <code className="text-gray-400">http://host.docker.internal:32400</code> (from Docker container)
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm md:text-base font-medium mb-2">Plex Token</label>
                      <input
                        type="password"
                        className="input text-sm md:text-base"
                        placeholder={
                          settings.hasPlexToken ? 'Token configured (enter new to update)' : 'Enter token'
                        }
                        value={plexToken}
                        onChange={(e) => setPlexToken(e.target.value)}
                      />
                      <p className="text-xs md:text-sm text-gray-500 mt-1">
                        Your Plex authentication token (admin token for server access)
                      </p>
                    </div>

                    {settings.plexServerName && (
                      <div>
                        <label className="block text-sm md:text-base font-medium mb-2">Configured Server</label>
                        <input
                          type="text"
                          className="input text-sm md:text-base bg-dark-200"
                          value={settings.plexServerName}
                          readOnly
                        />
                        <p className="text-xs md:text-sm text-gray-500 mt-1">
                          Server identity is automatically detected when you save your settings.
                          Users logging in via Plex OAuth will only be granted access if they have permission to this server.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {message && (
                  <div
                    className={`px-4 py-3 rounded-lg text-xs md:text-sm ${
                      message.type === 'success'
                        ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                        : 'bg-red-500/10 border border-red-500/20 text-red-400'
                    }`}
                  >
                    {message.text}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
                  <button type="submit" disabled={isSaving} className="btn-primary text-sm md:text-base">
                    {isSaving ? 'Saving...' : 'Save Settings'}
                  </button>

                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={isTesting || !(plexUrl || settings.plexUrl)}
                    className="btn-secondary text-sm md:text-base"
                  >
                    {isTesting ? 'Testing...' : 'Test Connection'}
                  </button>
                </div>
              </form>
            </div>

            <div className="card p-4 md:p-6 mt-4 md:mt-6">
              <h2 className="text-xl md:text-2xl font-semibold mb-4">Change Password</h2>
              <form onSubmit={handleChangePassword} className="space-y-3 md:space-y-4">
                <div>
                  <label className="block text-sm md:text-base font-medium mb-2">Current Password</label>
                  <input
                    type="password"
                    className="input text-sm md:text-base"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                  />
                </div>

                <div>
                  <label className="block text-sm md:text-base font-medium mb-2">New Password</label>
                  <input
                    type="password"
                    className="input text-sm md:text-base"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password (min. 6 characters)"
                  />
                </div>

                <div>
                  <label className="block text-sm md:text-base font-medium mb-2">Confirm New Password</label>
                  <input
                    type="password"
                    className="input text-sm md:text-base"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                  />
                </div>

                {passwordMessage && (
                  <div
                    className={`px-4 py-3 rounded-lg text-xs md:text-sm ${
                      passwordMessage.type === 'success'
                        ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                        : 'bg-red-500/10 border border-red-500/20 text-red-400'
                    }`}
                  >
                    {passwordMessage.text}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="btn-primary text-sm md:text-base"
                >
                  {isChangingPassword ? 'Changing Password...' : 'Change Password'}
                </button>
              </form>
            </div>

            <div className="card p-4 md:p-6 mt-4 md:mt-6">
              <h2 className="text-xl md:text-2xl font-semibold mb-4">About</h2>
              <div className="space-y-2 text-xs md:text-sm text-gray-400">
                <p>
                  <span className="font-medium text-gray-300">LibraryDownloadarr</span> v1.0.0
                </p>
                <p>A modern web application for downloading media from your media library server</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};
