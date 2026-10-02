// Copyright (c) 2026 Mike Ford, NMLS #288455. All Rights Reserved.
import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Maximize2, Minimize2, List, Heart, MessageSquare, ExternalLink } from 'lucide-react';
import { CuratedListing } from '../types';

interface ListingMapProps {
  listings: CuratedListing[];
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  onOpenNotes: (listing: CuratedListing) => void;
  onBackToList: () => void;
  deepLinkedListingId: string | null;
}

export const ListingMap: React.FC<ListingMapProps> = ({
  listings,
  favorites,
  onToggleFavorite,
  onOpenNotes,
  onBackToList,
  deepLinkedListingId
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    // Centered around Portland Metro / Pacific Northwest
    const map = L.map(mapContainerRef.current, {
      center: [45.5152, -122.6784],
      zoom: 11,
      zoomControl: true
    });

    // Dark-mode styled map tiles (CartoDB Dark Matter)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://carto.com/">CartoDB</a> &copy; OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current.clear();

    const bounds = L.latLngBounds([]);

    listings.forEach(item => {
      const isFav = favorites.includes(item.id);
      bounds.extend([item.latitude, item.longitude]);

      // Custom HTML Marker Pin
      const pinIcon = L.divIcon({
        className: 'custom-map-pin',
        html: `
          <div style="
            background: ${isFav ? '#f43f5e' : '#0284c7'};
            color: #ffffff;
            font-weight: 700;
            font-size: 11px;
            padding: 3px 8px;
            border-radius: 9999px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.5);
            border: 2px solid #ffffff;
            white-space: nowrap;
            cursor: pointer;
            transform: translate(-50%, -50%);
            display: flex;
            align-items: center;
            gap: 4px;
          ">
            <span>$${item.price ? Math.round(item.price / 1000) + 'k' : 'Price'}</span>
            ${isFav ? '❤️' : ''}
          </div>
        `,
        iconSize: [40, 24],
        iconAnchor: [20, 12]
      });

      const marker = L.marker([item.latitude, item.longitude], { icon: pinIcon }).addTo(map);

      // Popup Content (Verbatim RentCast Data + Program Tags + Notes + Heart)
      const popupHtml = `
        <div style="font-family: sans-serif; color: #f8fafc; width: 220px; line-height: 1.4;">
          <img src="${item.photoUrl}" style="width: 100%; height: 110px; object-fit: cover; border-radius: 8px; margin-bottom: 8px;" />
          <div style="font-size: 14px; font-weight: bold; color: #ffffff;">$${item.price?.toLocaleString()}</div>
          <div style="font-size: 11px; color: #38bdf8;">~$${item.estimatedMonthlyPayment?.toLocaleString()}/mo estimated</div>
          <div style="font-size: 12px; font-weight: 600; margin-top: 2px;">${item.address}</div>
          <div style="font-size: 11px; color: #94a3b8;">${item.city}, ${item.state} • ${item.bedrooms}b/${item.bathrooms}ba</div>
          
          <div style="margin-top: 6px; display: flex; flex-wrap: wrap; gap: 4px;">
            ${item.programTags.map(t => `<span style="font-size: 9px; padding: 2px 6px; border-radius: 4px; background: rgba(56,189,248,0.2); color: #38bdf8;">${t}</span>`).join('')}
          </div>

          <div style="margin-top: 8px; font-size: 10px; color: #cbd5e1; border-top: 1px solid #334155; padding-top: 4px;">
            Listing Agent: <strong>${item.listingAgentName}</strong><br/>
            Phone: ${item.listingAgentPhone}
          </div>

          <div style="margin-top: 8px; display: flex; gap: 6px;">
            <button id="map-fav-${item.id}" style="
              flex: 1;
              padding: 5px;
              background: ${isFav ? '#e11d48' : '#334155'};
              color: #ffffff;
              border: none;
              border-radius: 6px;
              font-size: 10px;
              cursor: pointer;
            ">
              ${isFav ? '❤️ Favorited' : '🤍 Heart (Top 3)'}
            </button>
            <button id="map-note-${item.id}" style="
              flex: 1;
              padding: 5px;
              background: #0284c7;
              color: #ffffff;
              border: none;
              border-radius: 6px;
              font-size: 10px;
              cursor: pointer;
            ">
              💬 Notes
            </button>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml, {
        className: 'dark-leaflet-popup',
        maxWidth: 260
      });

      marker.on('popupopen', () => {
        // Wire up popup button listeners
        const favBtn = document.getElementById(`map-fav-${item.id}`);
        if (favBtn) {
          favBtn.onclick = () => {
            onToggleFavorite(item.id);
            marker.closePopup();
          };
        }
        const noteBtn = document.getElementById(`map-note-${item.id}`);
        if (noteBtn) {
          noteBtn.onclick = () => {
            onOpenNotes(item);
            marker.closePopup();
          };
        }
      });

      markersRef.current.set(item.id, marker);
    });

    if (listings.length > 0 && !deepLinkedListingId) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [listings, favorites]);

  // Deep-link handler: center and open popup when requested from card
  useEffect(() => {
    if (!deepLinkedListingId || !mapInstanceRef.current) return;
    const targetMarker = markersRef.current.get(deepLinkedListingId);
    const listing = listings.find(l => l.id === deepLinkedListingId);

    if (targetMarker && listing) {
      mapInstanceRef.current.flyTo([listing.latitude, listing.longitude], 15, { duration: 1.2 });
      setTimeout(() => {
        targetMarker.openPopup();
      }, 1300);
    }
  }, [deepLinkedListingId, listings]);

  return (
    <div className={`relative ${isFullscreen ? 'fixed inset-0 z-50 bg-slate-950' : 'h-[620px] w-full rounded-2xl overflow-hidden border border-slate-800 shadow-2xl'}`}>
      {/* Map Canvas */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Floating Controls Bar */}
      <div className="absolute top-4 left-4 z-[1000] flex items-center space-x-2">
        <button
          onClick={onBackToList}
          className="px-3.5 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-900 text-white font-medium text-xs border border-slate-700 shadow-xl backdrop-blur-md flex items-center gap-1.5 transition-all"
        >
          <List className="w-4 h-4 text-cyan-400" />
          <span>Back to Curated Homes List</span>
        </button>
      </div>

      <div className="absolute top-4 right-4 z-[1000] flex items-center space-x-2">
        <button
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-900 text-white font-medium text-xs border border-slate-700 shadow-xl backdrop-blur-md transition-all"
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Map'}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Map Legend Overlay */}
      <div className="absolute bottom-4 left-4 z-[1000] bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 text-[11px] text-slate-300 backdrop-blur-md shadow-lg hidden sm:block">
        <div className="font-bold text-white mb-1">GeoSphere Curated Pins</div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-cyan-600 inline-block"></span>
          <span>Curated FTHB Home</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="w-3 h-3 rounded-full bg-rose-500 inline-block"></span>
          <span>Your Hearted Favorite</span>
        </div>
      </div>
    </div>
  );
};
