import React from 'react';
import { Header } from '../components/Header';
import { Sidebar } from '../components/Sidebar';

export const Dashboard: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 p-8">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-3xl font-bold mb-6">Welcome to PlexDownloadarr</h2>
            <p className="text-gray-400 mb-8">
              Select a library from the sidebar to browse your media.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="card p-6">
                <div className="text-4xl mb-4">🎬</div>
                <h3 className="text-xl font-semibold mb-2">Browse Libraries</h3>
                <p className="text-gray-400 text-sm">
                  Access all your Plex libraries with full metadata and artwork
                </p>
              </div>

              <div className="card p-6">
                <div className="text-4xl mb-4">🔍</div>
                <h3 className="text-xl font-semibold mb-2">Search Media</h3>
                <p className="text-gray-400 text-sm">
                  Quickly find any movie or TV show in your collection
                </p>
              </div>

              <div className="card p-6">
                <div className="text-4xl mb-4">⬇️</div>
                <h3 className="text-xl font-semibold mb-2">Download Content</h3>
                <p className="text-gray-400 text-sm">
                  Download original media files with a single click
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};
