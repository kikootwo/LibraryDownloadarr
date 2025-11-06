import React, { useEffect, useState } from 'react';
import { Header } from '../components/Header';
import { Sidebar } from '../components/Sidebar';
import { api } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { useNavigate } from 'react-router-dom';

export const DownloadHistory: React.FC = () => {
  const [history, setHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const { user } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect non-admin users
    if (user && !user.isAdmin) {
      navigate('/', { replace: true });
      return;
    }

    if (user) {
      loadHistory();
    }
  }, [user]);

  const loadHistory = async () => {
    setIsLoading(true);
    setError('');

    try {
      const data = await api.getAllDownloadHistory(200);
      setHistory(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load download history');
    } finally {
      setIsLoading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (!bytes) return 'N/A';
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 p-8">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">Download History</h1>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg mb-6">
                {error}
              </div>
            )}

            {isLoading ? (
              <div className="text-center text-gray-400 py-12">Loading...</div>
            ) : history.length === 0 ? (
              <div className="card p-8 text-center">
                <p className="text-gray-400">No downloads yet</p>
              </div>
            ) : (
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-dark-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                          User
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                          Media Title
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                          File Size
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                          Downloaded At
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-dark-50">
                      {history.map((item) => (
                        <tr key={item.id} className="hover:bg-dark-200/50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {item.username || 'Unknown User'}
                          </td>
                          <td className="px-6 py-4 text-sm">{item.media_title}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                            {formatFileSize(item.file_size)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                            {formatDate(item.downloaded_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};
