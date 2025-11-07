import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/Header';
import { Sidebar } from '../components/Sidebar';
import { api } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { useMobileMenu } from '../hooks/useMobileMenu';

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  meta?: any;
}

export const Logs: React.FC = () => {
  const { isMobileMenuOpen, toggleMobileMenu, closeMobileMenu } = useMobileMenu();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // Filters and pagination
  const [level, setLevel] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 50;

  useEffect(() => {
    // Redirect non-admin users
    if (user && !user.isAdmin) {
      navigate('/');
      return;
    }

    if (user) {
      loadLogs();
    }
  }, [user, level, search, page]);

  const loadLogs = async () => {
    setIsLoading(true);
    setError('');

    try {
      const result = await api.getLogs({
        level: level === 'all' ? undefined : level,
        search: search || undefined,
        page,
        limit,
        sortOrder: 'desc',
      });

      setLogs(result.logs);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load logs');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1); // Reset to first page when searching
    loadLogs();
  };

  const getLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'error':
        return 'text-red-400 bg-red-500/10 border-red-500/20';
      case 'warn':
        return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
      case 'info':
        return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
      case 'debug':
        return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
      default:
        return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header onMenuClick={toggleMobileMenu} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar isOpen={isMobileMenuOpen} onClose={closeMobileMenu} />
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 md:mb-6">
              <h1 className="text-2xl md:text-3xl font-bold">Application Logs</h1>
              <button
                onClick={() => loadLogs()}
                className="btn-primary text-sm md:text-base"
              >
                🔄 Refresh
              </button>
            </div>

            {/* Filters */}
            <div className="card p-4 md:p-6 mb-4 md:mb-6">
              <div className="flex flex-col md:flex-row gap-4 md:gap-6">
                {/* Level Filter */}
                <div className="flex-1">
                  <label className="block text-xs md:text-sm font-medium text-gray-400 mb-2">
                    Log Level
                  </label>
                  <select
                    value={level}
                    onChange={(e) => {
                      setLevel(e.target.value);
                      setPage(1);
                    }}
                    className="input w-full text-sm md:text-base"
                  >
                    <option value="all">All Levels</option>
                    <option value="error">Error</option>
                    <option value="warn">Warning</option>
                    <option value="info">Info</option>
                    <option value="debug">Debug</option>
                  </select>
                </div>

                {/* Search Filter */}
                <div className="flex-1">
                  <label className="block text-xs md:text-sm font-medium text-gray-400 mb-2">
                    Search
                  </label>
                  <form onSubmit={handleSearch} className="flex gap-2">
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search in logs..."
                      className="input flex-1 text-sm md:text-base"
                    />
                    <button type="submit" className="btn-primary text-sm md:text-base">
                      Search
                    </button>
                  </form>
                </div>
              </div>

              {/* Stats */}
              <div className="mt-4 text-xs md:text-sm text-gray-400">
                Showing {logs.length} of {total} logs
                {search && ` (filtered by "${search}")`}
                {level !== 'all' && ` (level: ${level})`}
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg mb-4 md:mb-6 text-sm md:text-base">
                {error}
              </div>
            )}

            {isLoading ? (
              <div className="text-center text-gray-400 py-12">Loading logs...</div>
            ) : logs.length === 0 ? (
              <div className="card p-6 md:p-8 text-center">
                <p className="text-sm md:text-base text-gray-400">No logs found</p>
                <p className="text-xs md:text-sm text-gray-500 mt-2">
                  Logs are only available when file logging is enabled.
                </p>
              </div>
            ) : (
              <>
                {/* Logs Table */}
                <div className="space-y-2">
                  {logs.map((log, index) => (
                    <div
                      key={index}
                      className="card p-3 md:p-4 hover:bg-dark-200 transition-colors"
                    >
                      <div className="flex items-start gap-2 md:gap-4">
                        {/* Level Badge */}
                        <div className={`px-2 md:px-3 py-1 rounded-lg text-xs font-semibold uppercase border ${getLevelColor(log.level)}`}>
                          {log.level}
                        </div>

                        {/* Log Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs md:text-sm text-gray-400">
                              {formatTimestamp(log.timestamp)}
                            </span>
                          </div>
                          <div className="text-sm md:text-base text-white break-words">
                            {log.message}
                          </div>
                          {(() => {
                            if (!log.meta) return null;
                            const excludedKeys = ['timestamp', 'level', 'message', 'service'];
                            const filteredEntries = Object.entries(log.meta).filter(([key]) => !excludedKeys.includes(key));
                            if (filteredEntries.length === 0) return null;

                            return (
                              <details className="mt-2">
                                <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-400">
                                  Show metadata
                                </summary>
                                <pre className="mt-2 p-2 bg-dark-300 rounded text-xs text-gray-400 overflow-auto">
                                  {JSON.stringify(Object.fromEntries(filteredEntries), null, 2)}
                                </pre>
                              </details>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-6 md:mt-8">
                    <button
                      onClick={() => setPage(Math.max(1, page - 1))}
                      disabled={page === 1}
                      className="btn text-sm md:text-base disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <div className="flex items-center gap-1 md:gap-2">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (page <= 3) {
                          pageNum = i + 1;
                        } else if (page >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = page - 2 + i;
                        }

                        return (
                          <button
                            key={pageNum}
                            onClick={() => setPage(pageNum)}
                            className={`w-8 h-8 md:w-10 md:h-10 rounded-lg transition-colors text-sm md:text-base ${
                              page === pageNum
                                ? 'bg-primary-500 text-white'
                                : 'bg-dark-200 text-gray-400 hover:bg-dark-300'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      onClick={() => setPage(Math.min(totalPages, page + 1))}
                      disabled={page === totalPages}
                      className="btn text-sm md:text-base disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};
