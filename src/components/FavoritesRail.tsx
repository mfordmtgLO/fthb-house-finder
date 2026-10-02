// Copyright (c) 2026 Mike Ford, NMLS #288455. All Rights Reserved.
import React from 'react';
import { Heart, X, ExternalLink, Sparkles } from 'lucide-react';
import { CuratedListing } from '../types';

interface FavoritesRailProps {
  favorites: string[];
  allListings: CuratedListing[];
  onRemoveFavorite: (id: string) => void;
  onSelectListing: (listing: CuratedListing) => void;
  onClearAllFavorites: () => void;
}

export const FavoritesRail: React.FC<FavoritesRailProps> = ({
  favorites,
  allListings,
  onRemoveFavorite,
  onSelectListing,
  onClearAllFavorites
}) => {
  const favoriteItems = favorites
    .map(id => allListings.find(l => l.id === id))
    .filter((l): l is CuratedListing => Boolean(l));

  if (favoriteItems.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-2">
        <div className="bg-slate-900/60 border border-dashed border-slate-800 rounded-xl p-3 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center space-x-2">
            <Heart className="w-4 h-4 text-slate-500" />
            <span>
              <strong>Top 3 Favorites Rail:</strong> Heart up to 3 curated homes to compare side-by-side and keep your first-time purchase focus razor-sharp.
            </span>
          </div>
          <span className="text-[11px] font-mono text-cyan-400">0 of 3 Selected</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-2.5">
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-cyan-500/30 rounded-2xl p-3.5 shadow-xl shadow-cyan-950/20">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded-full bg-rose-500/20 border border-rose-500/30 flex items-center justify-center">
              <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-400" />
            </div>
            <h3 className="text-xs sm:text-sm font-bold text-white tracking-wide flex items-center gap-2">
              <span>Your Top 3 Curated Contenders</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-mono font-medium">
                {favoriteItems.length} / 3 Capped
              </span>
            </h3>
          </div>

          <div className="flex items-center space-x-3 text-xs">
            {favoriteItems.length === 3 && (
              <span className="text-amber-300 text-[11px] hidden md:flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Target 3 Limit Reached — Ready for LO Pre-Approval
              </span>
            )}
            <button
              onClick={onClearAllFavorites}
              className="text-slate-400 hover:text-slate-200 text-xs underline"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {favoriteItems.map(item => (
            <div
              key={item.id}
              className="group relative bg-slate-950/80 border border-slate-800 hover:border-cyan-500/50 rounded-xl p-2.5 flex items-center gap-3 transition-all hover:shadow-md"
            >
              <img
                src={item.photoUrl}
                alt={item.address}
                className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white truncate">
                    ${item.price?.toLocaleString()}
                  </span>
                  <button
                    onClick={() => onRemoveFavorite(item.id)}
                    className="text-slate-500 hover:text-rose-400 p-1"
                    title="Remove from favorites"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-[11px] text-slate-300 truncate">{item.address}</p>
                <p className="text-[10px] text-slate-400">
                  {item.city}, {item.state} • ~${item.estimatedMonthlyPayment?.toLocaleString()}/mo
                </p>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-mono">
                    {item.programTags[0] || 'Curated'}
                  </span>
                  <button
                    onClick={() => onSelectListing(item)}
                    className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5 font-medium"
                  >
                    <span>View</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
