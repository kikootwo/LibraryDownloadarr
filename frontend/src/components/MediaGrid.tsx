import React from 'react';
import { MediaItem } from '../types';
import { MediaCard } from './MediaCard';
import { useNavigate } from 'react-router-dom';

interface MediaGridProps {
  media: MediaItem[];
  isLoading?: boolean;
}

export const MediaGrid: React.FC<MediaGridProps> = ({ media, isLoading }) => {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (media.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-gray-400">No media found</div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4">
      {media.map((item) => (
        <MediaCard
          key={item.ratingKey}
          media={item}
          onClick={() => navigate(`/media/${item.ratingKey}`)}
        />
      ))}
    </div>
  );
};
