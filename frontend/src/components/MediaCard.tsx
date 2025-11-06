import React from 'react';
import { MediaItem } from '../types';
import { api } from '../services/api';

interface MediaCardProps {
  media: MediaItem;
  onClick: () => void;
}

export const MediaCard: React.FC<MediaCardProps> = ({ media, onClick }) => {
  const thumbnailUrl = media.thumb ? api.getThumbnailUrl(media.ratingKey, media.thumb) : null;

  return (
    <div
      onClick={onClick}
      className="card cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-2xl group"
    >
      <div className="relative aspect-[2/3] bg-dark-200">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={media.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-600">
            <span className="text-4xl">{media.type === 'movie' ? '🎬' : '📺'}</span>
          </div>
        )}

        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
          <h3 className="font-semibold text-sm line-clamp-2 mb-1">{media.title}</h3>
          {media.year && <p className="text-xs text-gray-300">{media.year}</p>}
          {media.contentRating && (
            <span className="text-xs text-gray-400 mt-1">{media.contentRating}</span>
          )}
        </div>
      </div>

      {/* Title below card (always visible) */}
      <div className="p-3">
        <h3 className="font-medium text-sm line-clamp-1">{media.title}</h3>
        {media.year && <p className="text-xs text-gray-400 mt-1">{media.year}</p>}
      </div>
    </div>
  );
};
