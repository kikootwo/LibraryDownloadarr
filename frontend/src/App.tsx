import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { api } from './services/api';
import { Setup } from './pages/Setup';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { LibraryView } from './pages/LibraryView';
import { MediaDetail } from './pages/MediaDetail';
import { Settings } from './pages/Settings';
import { SearchResults } from './pages/SearchResults';
import { DownloadHistory } from './pages/DownloadHistory';
import { Logs } from './pages/Logs';
import { DownloadProvider } from './contexts/DownloadContext';
import { DownloadManager } from './components/DownloadManager';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useAuthStore();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  const [setupRequired, setSetupRequired] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { checkAuth, token } = useAuthStore();

  useEffect(() => {
    initialize();
  }, []);

  const initialize = async () => {
    try {
      // Check if setup is required
      const required = await api.checkSetupRequired();
      setSetupRequired(required);

      // If setup is not required and we have a token, check auth
      if (!required && token) {
        await checkAuth();
      }
    } catch (error) {
      console.error('Initialization error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <DownloadProvider>
      <BrowserRouter>
        <DownloadManager />
        <Routes>
          {setupRequired ? (
            <>
              <Route path="/setup" element={<Setup />} />
              <Route path="*" element={<Navigate to="/setup" replace />} />
            </>
          ) : (
            <>
              <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/library/:libraryKey"
              element={
                <ProtectedRoute>
                  <LibraryView />
                </ProtectedRoute>
              }
            />
            <Route
              path="/media/:ratingKey"
              element={
                <ProtectedRoute>
                  <MediaDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/search"
              element={
                <ProtectedRoute>
                  <SearchResults />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/download-history"
              element={
                <ProtectedRoute>
                  <DownloadHistory />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/logs"
              element={
                <ProtectedRoute>
                  <Logs />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        )}
      </Routes>
    </BrowserRouter>
    </DownloadProvider>
  );
};

export default App;
