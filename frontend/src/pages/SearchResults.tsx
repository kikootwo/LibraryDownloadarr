import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Header } from '../components/Header';
import { Sidebar } from '../components/Sidebar';
import { MediaGrid } from '../components/MediaGrid';
import { api } from '../services/api';
import { MediaItem } from '../types';
import { useMobileMenu } from '../hooks/useMobileMenu';

export const SearchResults: React.FC = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { isMobileMenuOpen, toggleMobileMenu, closeMobileMenu } = useMobileMenu();

  useEffect(() => {
    if (query) {
      performSearch();
    }
  }, [query]);

  const performSearch = async () => {
    if (!query.trim()) return;

    if (query.trim().length < 2) {
      setError('Search query must be at least 2 characters');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const results = await api.searchMedia(query);
      setMedia(results || []);
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || 'Search failed';
      const errorDetails = err.response?.data?.details;
      setError(errorDetails ? `${errorMessage}: ${errorDetails}` : errorMessage);
      setMedia([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header onMenuClick={toggleMobileMenu} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar isOpen={isMobileMenuOpen} onClose={closeMobileMenu} />
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          <div className="mb-4 md:mb-6">
            <h1 className="text-2xl md:text-3xl font-bold mb-2">Search Results</h1>
            {query && (
              <p className="text-gray-400 text-sm md:text-base">
                Showing results for: <span className="text-white font-medium">{query}</span>
              </p>
            )}
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-3 md:px-4 py-2 md:py-3 rounded-lg mb-4 md:mb-6 text-sm md:text-base">
              {error}
            </div>
          )}

          {!isLoading && !error && media.length === 0 && query && (
            <div className="text-center py-12">
              <p className="text-gray-400 text-base md:text-lg">No results found for "{query}"</p>
            </div>
          )}

          <MediaGrid media={media} isLoading={isLoading} />
        </main>
      </div>
    </div>
  );
};
