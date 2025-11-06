import React, { createContext, useContext, useState, ReactNode } from 'react';
import { api } from '../services/api';

interface Download {
  id: string;
  ratingKey: string;
  partKey: string;
  filename: string;
  title: string;
  progress: number;
  status: 'downloading' | 'completed' | 'error';
  error?: string;
}

interface DownloadContextType {
  downloads: Download[];
  startDownload: (ratingKey: string, partKey: string, filename: string, title: string) => Promise<void>;
  removeDownload: (id: string) => void;
}

const DownloadContext = createContext<DownloadContextType | undefined>(undefined);

export const useDownloads = () => {
  const context = useContext(DownloadContext);
  if (!context) {
    throw new Error('useDownloads must be used within a DownloadProvider');
  }
  return context;
};

interface DownloadProviderProps {
  children: ReactNode;
}

export const DownloadProvider: React.FC<DownloadProviderProps> = ({ children }) => {
  const [downloads, setDownloads] = useState<Download[]>([]);

  const startDownload = async (
    ratingKey: string,
    partKey: string,
    filename: string,
    title: string
  ): Promise<void> => {
    const downloadId = `${ratingKey}-${partKey}-${Date.now()}`;

    // Add download to state
    const newDownload: Download = {
      id: downloadId,
      ratingKey,
      partKey,
      filename,
      title,
      progress: 0,
      status: 'downloading',
    };

    setDownloads((prev) => [...prev, newDownload]);

    try {
      const downloadUrl = api.getDownloadUrl(ratingKey, partKey);

      // Fetch with progress tracking
      const response = await fetch(downloadUrl, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Download failed');
      }

      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Stream not available');
      }

      const chunks: Uint8Array[] = [];
      let receivedLength = 0;

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        chunks.push(value);
        receivedLength += value.length;

        // Update progress
        const progress = total > 0 ? Math.round((receivedLength / total) * 100) : 0;
        setDownloads((prev) =>
          prev.map((d) =>
            d.id === downloadId
              ? { ...d, progress }
              : d
          )
        );
      }

      // Create blob and download
      const blob = new Blob(chunks as BlobPart[]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Mark as completed
      setDownloads((prev) =>
        prev.map((d) =>
          d.id === downloadId
            ? { ...d, status: 'completed', progress: 100 }
            : d
        )
      );

      // Remove after 3 seconds
      setTimeout(() => {
        setDownloads((prev) => prev.filter((d) => d.id !== downloadId));
      }, 3000);
    } catch (error: any) {
      // Mark as error
      setDownloads((prev) =>
        prev.map((d) =>
          d.id === downloadId
            ? { ...d, status: 'error', error: error.message }
            : d
        )
      );

      // Remove after 5 seconds
      setTimeout(() => {
        setDownloads((prev) => prev.filter((d) => d.id !== downloadId));
      }, 5000);
    }
  };

  const removeDownload = (id: string) => {
    setDownloads((prev) => prev.filter((d) => d.id !== id));
  };

  return (
    <DownloadContext.Provider value={{ downloads, startDownload, removeDownload }}>
      {children}
    </DownloadContext.Provider>
  );
};
