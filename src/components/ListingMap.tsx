// Copyright (c) 2026 Mike Ford, NMLS #288455. All Rights Reserved.
import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Maximize2, Minimize2, List, Layers, MapPin } from 'lucide-react';
import { CuratedListing } from '../types';
import { OREGON_LMI_TRACTS } from '../data/oregonLmiTracts';

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
  const [mapTheme, setMapTheme] = useState<'osm' | 'esri' | 'satellite'>('osm');
  const [showLowTracts, setShowLowTracts] = useState(false);
  const [showModerateTracts, setShowModerateTracts] = useState(false);
  const [tractStatus, setTractStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [tractCount, setTractCount] = useState(0);
  const tractLayerRef = useRef<L.GeoJSON | null>(null);
  const [showLayers, setShowLayers] = useState(false);
  const [journeyOpen, setJourneyOpen] = useState(false);
  const [journeyMode, setJourneyMode] = useState<'tour' | 'commute'>('tour');
  const [journeyView, setJourneyView] = useState<'map' | 'drive' | 'street' | 'earth'>('map');
  const [journeyStatus, setJourneyStatus] = useState<'idle' | 'select' | 'loading' | 'ready' | 'error'>('idle');
  const [journeyError, setJourneyError] = useState('');
  const [journeyStop, setJourneyStop] = useState(0);
  const [journeyCoords, setJourneyCoords] = useState<[number, number][]>([]);
  const [commutePoint, setCommutePoint] = useState<[number, number] | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const routeCursorRef = useRef<L.CircleMarker | null>(null);
  const routeAbortRef = useRef<AbortController | null>(null);
  const playbackFrameRef = useRef<number | null>(null);
  const playbackProgressRef = useRef(0);
  const playbackLastRef = useRef<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [geoReady, setGeoReady] = useState(false);
  const geoFrameRef = useRef<HTMLIFrameElement | null>(null);
  const [geoState, setGeoState] = useState<'idle' | 'thinking' | 'point' | 'drive' | 'saturday' | 'arrive' | 'celebrate'>('idle');
  const tourStops = favorites.map(id => listings.find(item => item.id === id)).filter((item): item is CuratedListing => Boolean(item)).slice(0, 4);
  const activeJourneyStops = journeyMode === 'tour' ? tourStops : (tourStops.length ? [tourStops[0]] : []);
  const routeStopPositions: [number, number][] = activeJourneyStops.map(item => [item.latitude, item.longitude]);
  if (journeyMode === 'commute' && commutePoint) routeStopPositions.push(commutePoint);

  const stopPlayback = () => {
    if (playbackFrameRef.current !== null) cancelAnimationFrame(playbackFrameRef.current);
    playbackFrameRef.current = null;
    playbackLastRef.current = null;
    setIsPlaying(false);
  };
  const clearJourney = () => {
    stopPlayback();
    playbackProgressRef.current = 0;
    setGeoState('idle');
    routeAbortRef.current?.abort();
    const map = mapInstanceRef.current;
    if (map && routeLayerRef.current) map.removeLayer(routeLayerRef.current);
    if (map && routeCursorRef.current) map.removeLayer(routeCursorRef.current);
    routeLayerRef.current = null;
    routeCursorRef.current = null;
    setJourneyCoords([]);
    setJourneyStatus('idle');
    setJourneyStop(0);
  };
  const startJourney = async () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (journeyMode === 'commute' && !commutePoint) {
      setJourneyStatus('select');
      return;
    }
    if (routeStopPositions.length < 2) {
      setJourneyStatus('error');
      setJourneyError(journeyMode === 'tour' ? 'Favorite at least two curated homes to plan a tour (up to four).' : 'Favorite your starting home and choose a destination on the map.');
      return;
    }
    routeAbortRef.current?.abort();
    const controller = new AbortController();
    routeAbortRef.current = controller;
    stopPlayback();
    setGeoState('thinking');
    setJourneyStatus('loading');
    setJourneyError('');
    // Routing is server-configured. Never expose provider credentials or silently
    // fall back to a public demo service in production.
    try {
      const response = await fetch('/api/journey/route', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ points: routeStopPositions }), signal: controller.signal
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Routing service unavailable');
      if (!Array.isArray(data.coordinates) || data.coordinates.length < 2) throw new Error('No drivable route found');
      if (controller.signal.aborted) return;
      const points: [number, number][] = data.coordinates.map(([lon, lat]: [number, number]) => [lat, lon]);
      if (routeLayerRef.current) map.removeLayer(routeLayerRef.current);
      if (routeCursorRef.current) map.removeLayer(routeCursorRef.current);
      const route = L.polyline(points, { color: '#06b6d4', weight: 6, opacity: 0.9 }).addTo(map);
      routeLayerRef.current = route;
      routeCursorRef.current = L.circleMarker(points[0], { radius: 9, color: '#ffffff', fillColor: '#0891b2', fillOpacity: 1, weight: 3 }).addTo(map);
      map.fitBounds(route.getBounds(), { padding: [55, 55] });
      setJourneyCoords(points);
      setJourneyStop(0);
      setJourneyStatus('ready');
      setGeoState('point');
    } catch (error) {
      if (controller.signal.aborted) return;
      setJourneyStatus('error');
      setGeoState('idle');
      setJourneyError(error instanceof Error ? error.message : 'Unable to plan route');
    }
  };
  const moveJourneyCursor = (fraction: number) => {
    const map = mapInstanceRef.current;
    if (!map || !journeyCoords.length) return;
    const index = Math.min(journeyCoords.length - 1, Math.round(fraction * (journeyCoords.length - 1)));
    const position = journeyCoords[index];
    routeCursorRef.current?.setLatLng(position);
    if (journeyView === 'drive') map.panTo(position, { animate: false });
  };
  // A fixed-duration preview follows the actual route geometry. It is not real-time
  // driving/navigation and makes no ETA claims.
  useEffect(() => {
    if (!isPlaying || journeyStatus !== 'ready' || journeyCoords.length < 2 || !journeyOpen) return;
    setGeoState(journeyMode === 'tour' ? 'saturday' : 'drive');
    const tick = (now: number) => {
      const previous = playbackLastRef.current;
      playbackLastRef.current = now;
      if (previous !== null) {
        const next = Math.min(100, playbackProgressRef.current + (now - previous) / 1000 * (100 / 75) * playbackSpeed);
        playbackProgressRef.current = next;
        setJourneyStop(next);
        moveJourneyCursor(next / 100);
        if (next >= 100) {
          setIsPlaying(false);
          setGeoState('arrive');
          playbackFrameRef.current = null;
          playbackLastRef.current = null;
          return;
        }
      }
      playbackFrameRef.current = requestAnimationFrame(tick);
    };
    playbackFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (playbackFrameRef.current !== null) cancelAnimationFrame(playbackFrameRef.current);
      playbackFrameRef.current = null;
      playbackLastRef.current = null;
    };
  }, [isPlaying, journeyStatus, journeyCoords, journeyOpen, journeyMode, journeyView, playbackSpeed]);

  // Synchronize the real procedural 3D Geo rig's expressions and pin color with
  // the journey controls. Same-origin iframe messages only.
  useEffect(() => {
    if (!geoReady) return;
    geoFrameRef.current?.contentWindow?.postMessage({ type: 'geo-journey-state', state: geoState }, window.location.origin);
  }, [geoState, geoReady]);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin === window.location.origin && event.source === geoFrameRef.current?.contentWindow && event.data?.type === 'geo-journey-ready') setGeoReady(true);
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, []);

  // The journey's Street and Earth modes open real external viewers, not fake street imagery.
  const openJourneyExternal = (kind: 'street' | 'earth') => {
    const position = routeCursorRef.current?.getLatLng() ?? mapInstanceRef.current?.getCenter();
    if (!position) return;
    const latitude = position.lat.toFixed(6), longitude = position.lng.toFixed(6);
    const url = kind === 'street'
      ? `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${latitude}%2C${longitude}`
      : `https://earth.google.com/web/search/${latitude}%2C${longitude}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // External imagery viewers use the map center; no Google API keys or imagery are embedded.
  const openExternalView = (kind: 'street' | 'earth') => {
    const center = mapInstanceRef.current?.getCenter();
    if (!center) return;
    const latitude = center.lat.toFixed(6);
    const longitude = center.lng.toFixed(6);
    const url = kind === 'street'
      ? `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${latitude}%2C${longitude}`
      : `https://earth.google.com/web/search/${latitude}%2C${longitude}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

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

  // Base map switcher: street maps and Esri World Imagery (attribution required).
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
    } else if (mapTheme === 'esri') {
      // Esri World Street Map
      const esriLayer = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: 'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ',
          maxZoom: 19
        }
      );

      esriLayer.addTo(map);
      currentTileLayerRef.current = esriLayer;
    } else {
      // Esri World Imagery satellite/aerial basemap, subject to provider usage terms.
      const imagery = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community',
          maxZoom: 19
        }
      );
      imagery.addTo(map);
      currentTileLayerRef.current = imagery;
    }
  }, [mapTheme]);

  // Request actual census tract geometry for the visible Oregon map bounds, then
  // classify it using the Geosphere-maintained GEOID snapshot. Never guess polygons.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (tractLayerRef.current) {
      map.removeLayer(tractLayerRef.current);
      tractLayerRef.current = null;
    }
    if (!showLowTracts && !showModerateTracts) {
      setTractStatus('idle');
      setTractCount(0);
      return;
    }

    let controller: AbortController | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    const fetchTracts = () => {
      controller?.abort();
      controller = new AbortController();
      setTractStatus('loading');
      const bounds = map.getBounds();
      // Clip requested area to Oregon; avoid large and unnecessary geometry responses.
      const xmin = Math.max(-124.8, bounds.getWest());
      const ymin = Math.max(41.9, bounds.getSouth());
      const xmax = Math.min(-116.4, bounds.getEast());
      const ymax = Math.min(46.4, bounds.getNorth());
      if (xmin >= xmax || ymin >= ymax) {
        setTractStatus('ready');
        setTractCount(0);
        return;
      }
      const params = new URLSearchParams({
        where: "STATEFP='41'",
        geometry: JSON.stringify({ xmin, ymin, xmax, ymax, spatialReference: { wkid: 4326 } }),
        geometryType: 'esriGeometryEnvelope',
        spatialRel: 'esriSpatialRelIntersects',
        inSR: '4326',
        outSR: '4326',
        outFields: 'GEOID,NAME,STATEFP',
        returnGeometry: 'true',
        f: 'geojson'
      });
      const endpoint = 'https://services1.arcgis.com/Ua5sDmgJbxcvNy4f/arcgis/rest/services/Census_Tracts_2020/FeatureServer/0/query';
      fetch(endpoint + '?' + params.toString(), { signal: controller.signal })
        .then(async response => {
          if (!response.ok) throw new Error('Tract geometry source unavailable');
          const geojson = await response.json();
          if (geojson.error || geojson.type !== 'FeatureCollection' || !Array.isArray(geojson.features)) {
            throw new Error('Invalid tract geometry response');
          }
          if (disposed) return;
          const filtered = geojson.features.filter((feature: any) => {
            const geoid = String(feature.properties?.GEOID ?? feature.properties?.geoid ?? '');
            const category = OREGON_LMI_TRACTS[geoid];
            return category === 'Low' ? showLowTracts : category === 'Moderate' && showModerateTracts;
          });
          if (tractLayerRef.current) map.removeLayer(tractLayerRef.current);
          const layer = L.geoJSON({ type: 'FeatureCollection', features: filtered } as GeoJSON.FeatureCollection, {
            style: (feature) => {
              const low = OREGON_LMI_TRACTS[String(feature?.properties?.GEOID ?? '')] === 'Low';
              return { color: low ? '#e11d48' : '#ca8a04', fillColor: low ? '#fb7185' : '#fde047',
                fillOpacity: 0.28, weight: 1.6, opacity: 0.9 };
            },
            onEachFeature: (feature, tractLayer) => {
              const geoid = String(feature.properties?.GEOID ?? '');
              const category = OREGON_LMI_TRACTS[geoid];
              tractLayer.bindPopup(`<strong>${category === 'Low' ? 'Low-income' : 'Moderate-income'} census tract</strong><br/>GEOID: ${geoid}<br/><small>Geographic indicator only; program and buyer eligibility require verification.</small>`);
            }
          });
          layer.addTo(map);
          tractLayerRef.current = layer;
          setTractCount(filtered.length);
          setTractStatus('ready');
        })
        .catch(err => {
          if (disposed || err.name === 'AbortError') return;
          setTractStatus('error');
          setTractCount(0);
          if (tractLayerRef.current) {
            map.removeLayer(tractLayerRef.current);
            tractLayerRef.current = null;
          }
        });
    };
    const schedule = () => { if (timer) clearTimeout(timer); timer = setTimeout(fetchTracts, 350); };
    fetchTracts();
    map.on('moveend', schedule);
    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      controller?.abort();
      map.off('moveend', schedule);
      if (tractLayerRef.current) {
        map.removeLayer(tractLayerRef.current);
        tractLayerRef.current = null;
      }
    };
  }, [showLowTracts, showModerateTracts]);

  // In commute mode, a map click chooses the destination. Other modes preserve normal pin clicks.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !journeyOpen || journeyMode !== 'commute' || journeyStatus !== 'select') return;
    const choose = (event: L.LeafletMouseEvent) => {
      setCommutePoint([event.latlng.lat, event.latlng.lng]);
      setJourneyStatus('idle');
    };
    map.on('click', choose);
    return () => { map.off('click', choose); };
  }, [journeyOpen, journeyMode, journeyStatus]);

  // Remove transient route layers when the map unmounts.
  useEffect(() => () => {
    routeAbortRef.current?.abort();
    if (playbackFrameRef.current !== null) cancelAnimationFrame(playbackFrameRef.current);
  }, []);

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

      {/* Keep map navigation and census overlays usable even when there are no curated homes. */}
      {listings.length === 0 && (
        <div className="absolute bottom-3 left-3 z-[999] max-w-xs rounded-xl border border-slate-700 bg-slate-900/90 p-3 text-white shadow-xl pointer-events-none">
          <div className="text-xs font-bold">No curated homes to display</div>
          <p className="text-[11px] text-slate-300 mt-1">Explore the map and census tract overlays while your authorized listings are unavailable or filtered out.</p>
        </div>
      )}

      {/* Geo Journey controls: route geometry is real; first-person imagery is NOT simulated. */}
      {journeyOpen && (
        <div className="absolute top-16 left-3 z-[1000] w-[min(330px,calc(100vw-28px))] max-h-[calc(100%-90px)] overflow-y-auto rounded-xl border border-slate-700 bg-slate-900/95 p-4 text-white shadow-2xl space-y-3">
          <div className="flex items-center justify-between">
            <strong className="text-sm">Geo Journey Planner</strong>
            <button onClick={() => setJourneyOpen(false)} aria-label="Close journey planner" className="text-slate-300 hover:text-white">✕</button>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button onClick={() => { clearJourney(); setJourneyMode('tour'); }} aria-pressed={journeyMode === 'tour'} className={`rounded-lg p-2 ${journeyMode === 'tour' ? 'bg-cyan-600' : 'bg-slate-700'}`}>4-home tour</button>
            <button onClick={() => { clearJourney(); setJourneyMode('commute'); }} aria-pressed={journeyMode === 'commute'} className={`rounded-lg p-2 ${journeyMode === 'commute' ? 'bg-cyan-600' : 'bg-slate-700'}`}>Commute</button>
          </div>
          <p className="text-[11px] text-slate-300">
            {journeyMode === 'tour'
              ? `${tourStops.length} of 4 homes selected from favorites. The route follows your saved order.`
              : commutePoint ? `Destination selected: ${commutePoint[0].toFixed(4)}, ${commutePoint[1].toFixed(4)}` : 'Favorite a starting home, then select your commute destination on the map.'}
          </p>
          {journeyMode === 'tour' && <ol className="space-y-1 text-[11px] text-slate-200">{tourStops.map((home, i) => <li key={home.id}>{i + 1}. {home.address}</li>)}</ol>}
          {journeyMode === 'commute' && <button onClick={() => { clearJourney(); setJourneyStatus('select'); }} className="w-full rounded-lg bg-slate-700 p-2 text-xs">Choose destination on map</button>}
          {journeyStatus === 'select' && <p role="status" className="text-xs text-cyan-300">Click your destination on the map.</p>}
          <button onClick={startJourney} disabled={journeyStatus === 'loading'} className="w-full rounded-lg bg-cyan-600 p-2 text-xs font-bold hover:bg-cyan-500 disabled:opacity-50">{journeyStatus === 'loading' ? 'Finding drivable route…' : 'Plan route'}</button>
          {journeyStatus === 'error' && <p role="alert" className="text-xs text-rose-300">{journeyError}</p>}
          {journeyStatus === 'ready' && (
            <>
              <div className="grid grid-cols-4 gap-1 text-[10px]">
                {(['map','drive','street','earth'] as const).map(view => (
                  <button key={view} aria-pressed={journeyView === view} onClick={() => { setJourneyView(view); if (view === 'street' || view === 'earth') { stopPlayback(); setGeoState('point'); openJourneyExternal(view); } }} className={`rounded-lg p-2 capitalize ${journeyView === view ? 'bg-cyan-600' : 'bg-slate-700'}`}>{view === 'drive' ? 'Follow' : view === 'earth' ? '3D Earth ↗' : view === 'street' ? 'Street ↗' : 'Map'}</button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { if (journeyStop >= 100) { playbackProgressRef.current = 0; setJourneyStop(0); moveJourneyCursor(0); } setIsPlaying(!isPlaying); if (isPlaying) setGeoState('point'); }} className="flex-1 rounded-lg bg-cyan-600 p-2 text-xs font-bold">{isPlaying ? 'Pause' : journeyStop >= 100 ? 'Replay' : 'Play route'}</button>
                <button onClick={() => { stopPlayback(); playbackProgressRef.current = 0; setJourneyStop(0); moveJourneyCursor(0); setGeoState('idle'); }} className="rounded-lg bg-slate-700 p-2 text-xs">Restart</button>
                <select aria-label="Preview playback speed" value={playbackSpeed} onChange={e => setPlaybackSpeed(Number(e.target.value))} className="rounded-lg bg-slate-700 p-2 text-xs">
                  <option value={0.5}>0.5×</option><option value={1}>1×</option><option value={2}>2×</option>
                </select>
              </div>
              <label className="block text-xs text-slate-200">Preview route position: {Math.round(journeyStop)}%
                <input aria-label="Preview position along route" className="w-full mt-2 accent-cyan-500" type="range" min="0" max="100" value={journeyStop} onChange={e => { stopPlayback(); const n = Number(e.target.value); playbackProgressRef.current = n; setJourneyStop(n); moveJourneyCursor(n / 100); setGeoState(n >= 100 ? 'arrive' : 'point'); }} />
              </label>
              <p className="text-[10px] text-slate-400">Follow mode pans the overhead map. Geo's 3D preview reacts to journey state but his lab car uses a separate demonstration animation, not the real street route. Street and 3D Earth open external viewers.</p>
            </>
          )}
          <div className="relative h-40 overflow-hidden rounded-xl border border-slate-700 bg-slate-950">
            <iframe ref={geoFrameRef} title="Live 3D Geo journey guide preview" src="/geo-creation-lab-v2.html?journeyEmbed=1" sandbox="allow-scripts allow-same-origin" className="h-full w-full border-0" />
            <span className="pointer-events-none absolute bottom-1 left-2 rounded bg-slate-950/75 px-2 py-1 text-[10px] text-white">Geo 3D · {geoState} · procedural preview</span>
          </div>
          <button onClick={clearJourney} className="text-xs text-slate-300 underline">Clear route</button>
          <p className="text-[10px] text-slate-400">Routes require a configured server-side provider. Public demonstration routing is allowed only when explicitly enabled in a non-production preview. Not turn-by-turn navigation.</p>
        </div>
      )}

      {/* Floating Controls Bar: Left */}
      <div className="absolute top-3 left-3 z-[1000] flex items-center space-x-1.5">
        <button
          onClick={onBackToList}
          className="px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-slate-900/90 hover:bg-slate-900 text-white font-medium text-xs border border-slate-700 shadow-xl backdrop-blur-md flex items-center gap-1.5 transition-all"
        >
          <List className="w-4 h-4 text-cyan-400 shrink-0" />
          <span className="hidden sm:inline">Back to Curated Homes List</span>
          <span className="sm:hidden text-[11px]">List</span>
        </button>
      </div>

      <div className="absolute top-3 left-24 sm:left-44 z-[1000]">
        <button onClick={() => setJourneyOpen(!journeyOpen)} aria-expanded={journeyOpen} className="rounded-xl bg-cyan-700 hover:bg-cyan-600 px-3 py-2 text-white text-xs font-semibold border border-cyan-500 shadow-xl">Geo Journey</button>
      </div>

      {/* Floating Controls Bar: Right */}
      <div className="absolute top-3 right-3 z-[1000] flex items-center space-x-1.5">
        <div className="flex items-center gap-1 rounded-xl bg-slate-900/95 border border-slate-700 p-1 shadow-xl">
          <button onClick={() => setMapTheme('osm')} aria-pressed={mapTheme === 'osm'} className={`rounded-lg px-2 py-1.5 text-[11px] font-semibold ${mapTheme === 'osm' ? 'bg-cyan-600 text-white' : 'text-slate-200 hover:bg-slate-700'}`}>Street</button>
          <button onClick={() => setMapTheme('satellite')} aria-pressed={mapTheme === 'satellite'} className={`rounded-lg px-2 py-1.5 text-[11px] font-semibold ${mapTheme === 'satellite' ? 'bg-cyan-600 text-white' : 'text-slate-200 hover:bg-slate-700'}`}>Satellite</button>
          <button onClick={() => setMapTheme('esri')} aria-pressed={mapTheme === 'esri'} className={`hidden sm:block rounded-lg px-2 py-1.5 text-[11px] font-semibold ${mapTheme === 'esri' ? 'bg-cyan-600 text-white' : 'text-slate-200 hover:bg-slate-700'}`}>Esri</button>
          <button onClick={() => setShowLayers(!showLayers)} aria-expanded={showLayers} title="Census tract layers and external views" className="rounded-lg px-2 py-1.5 text-white hover:bg-slate-700"><Layers className="w-4 h-4" /></button>
        </div>

        {/* Fullscreen Button */}
        <button
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="p-1.5 sm:p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-900 text-white font-medium text-xs border border-slate-700 shadow-xl backdrop-blur-md transition-all shrink-0"
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Map'}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>

      {showLayers && (
        <div className="absolute top-16 right-3 z-[1000] w-[min(300px,calc(100vw-28px))] bg-slate-900/95 border border-slate-700 rounded-xl p-4 text-white shadow-2xl space-y-3">
          <div className="text-sm font-bold">Oregon Census Tract Overlays</div>
          <label className="flex items-center gap-2 text-xs cursor-pointer"><input type="checkbox" checked={showLowTracts} onChange={e => setShowLowTracts(e.target.checked)} className="accent-rose-500" /><span className="w-3 h-3 rounded bg-rose-400" />Low-income tracts</label>
          <label className="flex items-center gap-2 text-xs cursor-pointer"><input type="checkbox" checked={showModerateTracts} onChange={e => setShowModerateTracts(e.target.checked)} className="accent-yellow-400" /><span className="w-3 h-3 rounded bg-yellow-300" />Moderate-income tracts</label>
          <div role="status" className="text-[11px] text-slate-300">
            {tractStatus === 'loading' ? 'Loading tract boundaries…' : tractStatus === 'error' ? 'Tract geometry unavailable. No boundaries shown.' : tractStatus === 'ready' ? `${tractCount} matching tracts visible` : 'Enable an overlay to view tract boundaries.'}
          </div>
          <p className="text-[10px] text-slate-400 leading-relaxed">Geosphere LMI GEOID snapshot + 2020 census geometry. Geographic indicators only; not a mortgage eligibility determination. Verify program rules and data currency.</p>
          <div className="border-t border-slate-700 pt-3 text-xs font-bold">Explore map center</div>
          <div className="flex gap-2">
            <button onClick={() => openExternalView('street')} className="flex-1 rounded-lg bg-slate-700 hover:bg-slate-600 p-2 text-xs">Street View ↗</button>
            <button onClick={() => openExternalView('earth')} className="flex-1 rounded-lg bg-slate-700 hover:bg-slate-600 p-2 text-xs">Google Earth 3D ↗</button>
          </div>
          <p className="text-[10px] text-slate-400">Opens external Google viewers; imagery availability varies.</p>
        </div>
      )}

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
