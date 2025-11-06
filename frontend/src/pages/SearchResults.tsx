import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Header } from '../components/Header';
import { Sidebar } from '../components/Sidebar';
import { MediaGrid } from '../components/MediaGrid';
import { api } from '../services/api';
import { MediaItem } from '../types';

export const SearchResults: React.FC = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (query) {
      performSearch();
    }
  }, [query]);

  const performSearch = async () => {
    if (!query.trim()) return;

    setIsLoading(true);
    setError('');

    try {
      const results = await api.searchMedia(query);
      setMedia(results);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Search failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 p-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-2">Search Results</h1>
            {query && (
              <p className="text-gray-400">
                Showing results for: <span className="text-white font-medium">{query}</span>
              </p>
            )}
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          {!isLoading && !error && media.length === 0 && query && (
            <div className="text-center py-12">
              <p className="text-gray-400 text-lg">No results found for "{query}"</p>
            </div>
          )}

          <MediaGrid media={media} isLoading={isLoading} />
        </main>
      </div>
    </div>
  );
};
