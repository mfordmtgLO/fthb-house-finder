// Copyright (c) 2026 Mike Ford, NMLS #288455. All Rights Reserved.
import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Heart,
  MapPin,
  MessageSquare,
  Share2,
  Calendar,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  TrendingDown,
  BadgePercent,
  UserCheck,
  ArrowRight,
  ExternalLink,
  Clock,
  Home
} from 'lucide-react';
import { CuratedListing } from '../types';

interface ListingCardProps {
  listing: CuratedListing;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  onOpenNotes: (listing: CuratedListing) => void;
  onOpenBuydown: (listing: CuratedListing) => void;
  onOpenPublishing: (listing: CuratedListing) => void;
  onViewOnMap: (listing: CuratedListing) => void;
  onOpenSchedule: (listing: CuratedListing) => void;
}

export const ListingCard: React.FC<ListingCardProps> = ({
  listing,
  isFavorite,
  onToggleFavorite,
  onOpenNotes,
  onOpenBuydown,
  onOpenPublishing,
  onViewOnMap,
  onOpenSchedule
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  const priceDropAmount = listing._previousPrice && listing.price
    ? listing._previousPrice - listing.price
    : null;

  const photos = (listing.galleryUrls && listing.galleryUrls.filter(Boolean).length > 0)
    ? listing.galleryUrls.filter(Boolean)
    : (listing.photoUrl ? [listing.photoUrl] : []);

  const currentPhoto = photos[activePhotoIndex] || listing.photoUrl;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl overflow-hidden shadow-xl transition-all flex flex-col group"
    >
      {/* Photo Header & Badges */}
      <div className="relative aspect-[16/10] bg-slate-950 overflow-hidden">
        {currentPhoto ? (
          <img
            src={currentPhoto}
            alt={listing.address}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 text-slate-700 gap-2">
            <Home className="w-12 h-12 stroke-[1.2] text-slate-600" />
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Curated Single-Family Home</span>
          </div>
        )}

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-black/30 pointer-events-none" />

        {/* Sweep Badges (Upstream Outcome Surfacing - F7) */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
          {listing._priceReduced && (
            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/90 text-slate-950 font-bold text-xs flex items-center gap-1 shadow-lg backdrop-blur-sm">
              <TrendingDown className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>
                PRICE DROP {priceDropAmount ? `-$${priceDropAmount.toLocaleString()}` : ''}
              </span>
            </span>
          )}

          {listing._new && (
            <span className="px-2.5 py-1 rounded-lg bg-cyan-400/90 text-slate-950 font-bold text-xs flex items-center gap-1 shadow-lg backdrop-blur-sm">
              <Sparkles className="w-3.5 h-3.5" />
              <span>JUST CURATED</span>
            </span>
          )}

          {listing._statusChanged && (
            <span className="px-2.5 py-1 rounded-lg bg-indigo-500/90 text-white font-bold text-xs flex items-center gap-1 shadow-lg backdrop-blur-sm">
              <Clock className="w-3.5 h-3.5" />
              <span>STATUS UPDATED</span>
            </span>
          )}
        </div>

        {/* Favorite Heart Button (Strict 3-Cap) */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(listing.id);
          }}
          className={`absolute top-3 right-3 p-2.5 rounded-full backdrop-blur-md transition-all shadow-lg z-10 ${
            isFavorite
              ? 'bg-rose-500 text-white shadow-rose-500/40 scale-110'
              : 'bg-black/50 text-slate-200 hover:text-white hover:bg-black/70'
          }`}
          title={isFavorite ? 'Remove from top 3 favorites' : 'Heart to top 3 favorites'}
        >
          <Heart className={`w-4 h-4 ${isFavorite ? 'fill-white stroke-white' : ''}`} />
        </button>

        {/* Price & Monthly Payment Overlay */}
        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between z-10">
          <div>
            <div className="text-2xl font-black text-white tracking-tight drop-shadow-md">
              ${listing.price?.toLocaleString() || 'Contact for Price'}
            </div>
            {listing.estimatedMonthlyPayment && (
              <div className="text-xs font-semibold text-cyan-300 drop-shadow flex items-center gap-1">
                <span>Estimated: ~${listing.estimatedMonthlyPayment.toLocaleString()}/mo</span>
                <span className="text-[10px] text-slate-300 font-normal">(PITI)</span>
              </div>
            )}
          </div>

          {/* Days on market badge */}
          {listing.daysOnMarket !== null && (
            <span className="px-2 py-0.5 rounded-md bg-black/60 text-slate-300 text-[11px] font-mono border border-slate-700/60 backdrop-blur-sm">
              {listing.daysOnMarket}d on market
            </span>
          )}
        </div>

        {/* Multiple photos thumbnail dots if available */}
        {photos.length > 1 && (
          <div className="absolute bottom-12 right-3 flex space-x-1 z-10">
            {photos.map((_, idx) => (
              <button
                key={idx}
                onClick={(e) => {
                  e.stopPropagation();
                  setActivePhotoIndex(idx);
                }}
                className={`w-2 h-2 rounded-full transition-all ${
                  activePhotoIndex === idx ? 'bg-cyan-400 w-4' : 'bg-white/60 hover:bg-white'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Primary Info (Visible in both Compact & Expanded Mobile) */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          {/* Address & City */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <h3 className="text-base font-bold text-white leading-snug group-hover:text-cyan-300 transition-colors">
                {listing.address}
              </h3>
              <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                <span>{listing.city}, {listing.state} {listing.zipCode}</span>
              </p>
            </div>
            <button
              onClick={() => onViewOnMap(listing)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border border-slate-700 hover:border-cyan-500/40 text-xs flex items-center gap-1 flex-shrink-0 transition-all"
              title="See this home on your local map"
            >
              <MapPin className="w-3.5 h-3.5" />
              <span className="text-[10px] hidden sm:inline">Map</span>
            </button>
          </div>

          {/* Key Specs */}
          <div className="grid grid-cols-4 gap-2 py-2 border-y border-slate-800 text-center text-xs">
            <div>
              <span className="text-slate-400 text-[10px] block">Beds</span>
              <span className="font-bold text-slate-100">{listing.bedrooms}</span>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] block">Baths</span>
              <span className="font-bold text-slate-100">{listing.bathrooms}</span>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] block">Sq Ft</span>
              <span className="font-bold text-slate-100">{listing.squareFootage.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] block">Built</span>
              <span className="font-bold text-slate-100">{listing.yearBuilt}</span>
            </div>
          </div>

          {/* Program Tags (Verbatim Upstream) */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {listing.programTags.map((tag, i) => (
              <span
                key={i}
                className="px-2 py-0.5 rounded-md bg-cyan-950/60 border border-cyan-800/50 text-cyan-300 text-[11px] font-medium font-mono"
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Mobile Tap-To-Expand Toggle (F6 Mobile Requirement) */}
          <div className="mt-3 sm:hidden">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-full py-1.5 bg-slate-800/80 hover:bg-slate-800 text-slate-300 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-all"
            >
              <span>{isExpanded ? 'Collapse Details' : 'Tap to View Full Card & Nudges'}</span>
              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Expanded Content (Always shown on desktop; toggled on mobile) */}
          <div className={`${isExpanded ? 'block' : 'hidden sm:block'} mt-3 space-y-3`}>
            {/* Qualifier Notes / Overlay Details */}
            <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300">
              <div className="flex items-center space-x-1.5 text-cyan-400 text-[11px] font-semibold mb-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Likely Qualification Insights:</span>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-400">
                {listing.overlayEligibility.qualifierNotes}
              </p>
            </div>

            {/* Listing Agent Contact (Verbatim RentCast) */}
            <div className="p-2.5 rounded-xl bg-slate-950/50 border border-slate-800/80 text-xs text-slate-400 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-mono">Curated Listing Agent</span>
                <span className="font-semibold text-slate-200">{listing.listingAgentName}</span>
                <span className="text-[11px] text-slate-400 block">{listing.listingOfficeName}</span>
              </div>
              <div className="text-right text-[11px]">
                <a href={`tel:${listing.listingAgentPhone}`} className="text-cyan-400 hover:underline block font-mono">
                  {listing.listingAgentPhone}
                </a>
              </div>
            </div>

            {/* Nudge Strip: F4 Mandate */}
            <div className="p-2.5 bg-gradient-to-r from-cyan-950/40 via-indigo-950/30 to-slate-950 rounded-xl border border-cyan-500/20 space-y-2">
              <div className="text-[11px] font-bold text-cyan-200 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>First-Time Buyer Next Steps</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {/* Pre-Approval with Mike Ford */}
                <button
                  onClick={() => onOpenSchedule(listing)}
                  className="py-1.5 px-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium rounded-lg shadow-sm flex items-center justify-center gap-1.5 transition-all text-[11px]"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Pre-Approve w/ Mike</span>
                </button>

                {/* Book a Tour */}
                <button
                  onClick={() => onOpenNotes(listing)}
                  className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-lg border border-slate-700 flex items-center justify-center gap-1.5 transition-all text-[11px]"
                >
                  <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Book Private Tour</span>
                </button>
              </div>

              {/* 2-1 Buydown Explainer Link */}
              <button
                onClick={() => onOpenBuydown(listing)}
                className="w-full py-1 text-center text-[11px] text-cyan-300 hover:text-cyan-200 hover:underline flex items-center justify-center gap-1"
              >
                <BadgePercent className="w-3.5 h-3.5 text-amber-400" />
                <span>How a 2-1 buydown drops your payment year 1 & 2 &rarr;</span>
              </button>
            </div>
          </div>
        </div>

        {/* Card Footer Actions */}
        <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
          {/* Two-Way Notes Button */}
          <button
            onClick={() => onOpenNotes(listing)}
            className="flex-1 py-2 px-3 rounded-xl bg-slate-800/90 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700 text-xs font-medium flex items-center justify-center gap-1.5 transition-all"
          >
            <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
            <span>Property Notes</span>
          </button>

          {/* Publishing / Share Toolkit */}
          <button
            onClick={() => onOpenPublishing(listing)}
            className="p-2 rounded-xl bg-slate-800/90 hover:bg-slate-800 text-slate-400 hover:text-cyan-300 border border-slate-700 transition-all"
            title="Publish & Share Kit (iPhone Reach SMS / Facebook / Email)"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};
