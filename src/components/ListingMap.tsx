// Copyright (c) 2026 Mike Ford, NMLS #288455. All Rights Reserved.
import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Maximize2, Minimize2, List, Layers, MapPin, Home } from 'lucide-react';
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
  const currentTileLayerRef = useRef<L.Layer | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mapTheme, setMapTheme] = useState<'osm' | 'esri'>('osm');

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

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Handle Tile Layers (100% Watermark-Free & Zero API Key Required: OSM & Esri World Street Map)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (currentTileLayerRef.current) {
      map.removeLayer(currentTileLayerRef.current);
    }

    if (mapTheme === 'osm') {
      // Standard OpenStreetMap Tiles — keyless, zero watermarks across all zoom levels
      const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
      });

      osmLayer.addTo(map);
      currentTileLayerRef.current = osmLayer;
    } else {
      // Esri World Street Map — keyless, zero watermarks across all zoom levels
      const esriLayer = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: 'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ',
          maxZoom: 19
        }
      );

      esriLayer.addTo(map);
      currentTileLayerRef.current = esriLayer;
    }
  }, [mapTheme]);

  // Update Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current.clear();

    if (listings.length === 0) return;

    const bounds = L.latLngBounds([]);

    listings.forEach(item => {
      const isFav = favorites.includes(item.id);
      bounds.extend([item.latitude, item.longitude]);

      // Custom HTML Marker Pin
      const pinIcon = L.divIcon({
        className: 'custom-map-pin',
        html: `
          <div style="
            background: ${isFav ? '#e11d48' : '#0284c7'};
            color: #ffffff;
            font-weight: 700;
            font-size: 11px;
            padding: 4px 9px;
            border-radius: 9999px;
            box-shadow: 0 4px 14px rgba(0,0,0,0.6);
            border: 2px solid #ffffff;
            white-space: nowrap;
            cursor: pointer;
            transform: translate(-50%, -50%);
            display: flex;
            align-items: center;
            gap: 4px;
            transition: transform 0.15s ease;
          ">
            <span>$${item.price ? Math.round(item.price / 1000) + 'k' : 'Price'}</span>
            ${isFav ? '❤️' : ''}
          </div>
        `,
        iconSize: [44, 26],
        iconAnchor: [22, 13]
      });

      const marker = L.marker([item.latitude, item.longitude], { icon: pinIcon }).addTo(map);

      // Verbatim listing details
      const imageHtml = item.photoUrl
        ? `<img src="${item.photoUrl}" style="width: 100%; height: 115px; object-fit: cover; border-radius: 8px; margin-bottom: 8px;" />`
        : '';

      const agentDetailsHtml = item.listingAgentName
        ? `<div style="margin-top: 8px; font-size: 10px; color: #cbd5e1; border-top: 1px solid #334155; padding-top: 5px;">
            Listing Agent: <strong>${item.listingAgentName}</strong>${item.listingOfficeName ? ` (${item.listingOfficeName})` : ''}
            ${item.listingAgentPhone ? `<br/>Direct: ${item.listingAgentPhone}` : ''}
          </div>`
        : '';

      const popupHtml = `
        <div style="font-family: system-ui, -apple-system, sans-serif; color: #f8fafc; width: 230px; line-height: 1.4;">
          ${imageHtml}
          <div style="font-size: 15px; font-weight: bold; color: #ffffff;">$${item.price?.toLocaleString() || 'Contact'}</div>
          ${item.estimatedMonthlyPayment ? `<div style="font-size: 11px; color: #38bdf8; font-weight: 600;">~$${item.estimatedMonthlyPayment.toLocaleString()}/mo estimated</div>` : ''}
          <div style="font-size: 12px; font-weight: 600; margin-top: 3px; color: #e2e8f0;">${item.address}</div>
          <div style="font-size: 11px; color: #94a3b8;">${item.city}, ${item.state} • ${item.bedrooms}b/${item.bathrooms}ba • ${item.squareFootage} sqft</div>
          
          ${item.programTags && item.programTags.length > 0 ? `
            <div style="margin-top: 6px; display: flex; flex-wrap: wrap; gap: 4px;">
              ${item.programTags.map(t => `<span style="font-size: 9px; padding: 2px 6px; border-radius: 4px; background: rgba(56,189,248,0.2); color: #38bdf8; border: 1px solid rgba(56,189,248,0.3); font-weight: 600;">${t}</span>`).join('')}
            </div>
          ` : ''}

          ${agentDetailsHtml}

          <div style="margin-top: 8px; display: flex; gap: 6px;">
            <button id="map-fav-${item.id}" style="
              flex: 1;
              padding: 6px;
              background: ${isFav ? '#e11d48' : '#334155'};
              color: #ffffff;
              border: none;
              border-radius: 6px;
              font-size: 10px;
              font-weight: 600;
              cursor: pointer;
            ">
              ${isFav ? '❤️ Hearted' : '🤍 Heart (Top 3)'}
            </button>
            <button id="map-note-${item.id}" style="
              flex: 1;
              padding: 6px;
              background: #0284c7;
              color: #ffffff;
              border: none;
              border-radius: 6px;
              font-size: 10px;
              font-weight: 600;
              cursor: pointer;
            ">
              💬 Notes & LO
            </button>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml, {
        className: 'dark-leaflet-popup',
        maxWidth: 270
      });

      marker.on('popupopen', () => {
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

    if (listings.length > 0 && !deepLinkedListingId && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
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
    <div className={`relative ${isFullscreen ? 'fixed inset-0 z-50 bg-slate-950' : 'h-[calc(100dvh-13rem)] min-h-[460px] sm:h-[620px] w-full rounded-2xl overflow-hidden border border-slate-800 shadow-2xl'}`}>
      {/* Map Canvas */}
      <div ref={mapContainerRef} className="w-full h-full bg-slate-950" />

      {/* Honest Empty State Overlay when Firestore curated_listings is empty */}
      {listings.length === 0 && (
        <div className="absolute inset-0 z-[999] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm pointer-events-auto p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center shadow-2xl space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto text-slate-400">
              <Home className="w-6 h-6 text-cyan-400" />
            </div>
            <h3 className="text-sm font-bold text-white">No Curated Listings in Database</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Curated single-family homes are sourced directly from the shared Firestore database. No listings currently exist in the database or match active filters.
            </p>
            <button
              onClick={onBackToList}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-xl shadow-md transition-all"
            >
              Back to Homes Platter
            </button>
          </div>
        </div>
      )}

      {/* Floating Controls Bar: Left */}
      <div className="absolute top-3 left-3 z-[1000] flex flex-wrap items-center gap-1.5">
        <button
          onClick={onBackToList}
          className="px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-slate-900/90 hover:bg-slate-900 text-white font-medium text-xs border border-slate-700 shadow-xl backdrop-blur-md flex items-center gap-1.5 transition-all"
        >
          <List className="w-4 h-4 text-cyan-400 shrink-0" />
          <span className="hidden sm:inline">Back to Curated Homes List</span>
          <span className="sm:hidden text-[11px]">List</span>
        </button>

        {/* Amenity Icon Chips on Map (parks, schools, transit) */}
        <div className="hidden md:flex items-center space-x-1 px-2 py-1 rounded-xl bg-slate-900/90 border border-slate-700/80 shadow-xl backdrop-blur-md text-[11px] text-slate-300">
          <span className="text-[10px] text-slate-400 font-mono pr-1">Amenities:</span>
          <span className="px-2 py-0.5 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 flex items-center gap-1 cursor-default" title="Neighborhood Parks & Green Spaces">
            🌳 Parks
          </span>
          <span className="px-2 py-0.5 rounded-lg bg-indigo-950/60 border border-indigo-500/30 text-indigo-300 flex items-center gap-1 cursor-default" title="Elementary & High Schools">
            🏫 Schools
          </span>
          <span className="px-2 py-0.5 rounded-lg bg-amber-950/60 border border-amber-500/30 text-amber-300 flex items-center gap-1 cursor-default" title="Local Coffee & MAX/Transit Hubs">
            ☕ Transit
          </span>
        </div>
      </div>

      {/* Floating Controls Bar: Right */}
      <div className="absolute top-3 right-3 z-[1000] flex items-center space-x-1.5">
        {/* Map Layer Switcher: OpenStreetMap vs Esri World Street Map */}
        <button
          onClick={() => setMapTheme(mapTheme === 'osm' ? 'esri' : 'osm')}
          className="px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-slate-900/90 hover:bg-slate-900 text-white font-medium text-xs border border-slate-700 shadow-xl backdrop-blur-md flex items-center gap-1.5 transition-all"
          title="Toggle Keyless Map Tile Provider"
        >
          <Layers className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span className="hidden sm:inline">{mapTheme === 'osm' ? '🗺️ OpenStreetMap' : '🗺️ Esri Streets'}</span>
          <span className="sm:hidden text-[11px]">{mapTheme === 'osm' ? 'OSM' : 'Esri'}</span>
        </button>

        {/* Fullscreen Button */}
        <button
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="p-1.5 sm:p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-900 text-white font-medium text-xs border border-slate-700 shadow-xl backdrop-blur-md transition-all shrink-0"
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Map'}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Map Legend Overlay */}
      {listings.length > 0 && (
        <div className="absolute bottom-3 left-3 z-[1000] bg-slate-900/90 border border-slate-800 rounded-xl p-2 sm:p-2.5 text-[10px] sm:text-[11px] text-slate-300 backdrop-blur-md shadow-lg hidden sm:block">
          <div className="font-bold text-white mb-1 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-cyan-400" />
            <span>Curated FTHB Pins</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-cyan-600 inline-block border border-white"></span>
            <span>Curated Home</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="w-3 h-3 rounded-full bg-rose-500 inline-block border border-white"></span>
            <span>Hearted Favorite</span>
          </div>
        </div>
      )}
    </div>
  );
};
