// Copyright (c) 2026 Mike Ford, NMLS #288455. All Rights Reserved.
import React, { useState, useEffect } from 'react';
import {
  initBuyerSession,
  fetchCuratedListings,
  updateFavoritesServer,
  getLocalLeadId
} from './api';
import { CuratedListing } from './types';
import { Header } from './components/Header';
import { FavoritesRail } from './components/FavoritesRail';
import { MuseSidebar } from './components/MuseSidebar';
import { ListingCard } from './components/ListingCard';
import { ListingMap } from './components/ListingMap';
import { PropertyNotesModal } from './components/PropertyNotesModal';
import { PublishingModal } from './components/PublishingModal';
import { BuydownExplainerModal } from './components/BuydownExplainerModal';
import { PriceDropAlertModal } from './components/PriceDropAlertModal';
import { PreApprovalModal } from './components/PreApprovalModal';
import { PwaInstallGuideModal } from './components/PwaInstallGuideModal';
import { MikeReplySimulatorModal } from './components/MikeReplySimulatorModal';
import {
  Home,
  ShieldCheck,
  AlertCircle,
  Sparkles,
  Heart,
  ChevronRight,
  Info,
  Layers,
  ArrowRight
} from 'lucide-react';

export default function App() {
  const [leadId, setLeadId] = useState<string>('');
  const [disclaimerServed, setDisclaimerServed] = useState<boolean>(false);
  const [listings, setListings] = useState<CuratedListing[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // View state
  const [activeView, setActiveView] = useState<'list' | 'map'>('list');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);

  // Filters
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [selectedProgram, setSelectedProgram] = useState<string>('');
  const [maxMonthlyPayment, setMaxMonthlyPayment] = useState<number | ''>('');

  // Favorites (Strict 3-item cap)
  const [favorites, setFavorites] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals state
  const [notesListing, setNotesListing] = useState<CuratedListing | null>(null);
  const [publishingListing, setPublishingListing] = useState<CuratedListing | null>(null);
  const [buydownListing, setBuydownListing] = useState<CuratedListing | null>(null);
  const [preApprovalListing, setPreApprovalListing] = useState<CuratedListing | null>(null);
  const [isAlertsOpen, setIsAlertsOpen] = useState<boolean>(false);
  const [isPublishingGeneralOpen, setIsPublishingGeneralOpen] = useState<boolean>(false);
  const [isInstallGuideOpen, setIsInstallGuideOpen] = useState<boolean>(false);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState<boolean>(false);

  // Deep-linking map state
  const [deepLinkedListingId, setDeepLinkedListingId] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // 1. Initialize Buyer Session & Disclaimer
  useEffect(() => {
    initBuyerSession()
      .then(session => {
        setLeadId(session.leadId);
        setDisclaimerServed(session.disclaimerServed);
        if (session.statedPreferences?.favorites) {
          setFavorites(session.statedPreferences.favorites);
        }
      })
      .catch(err => {
        console.error('Session init error:', err);
      });
  }, []);

  // 2. Fetch Curated Listings when filters change
  useEffect(() => {
    if (!leadId) return;

    setLoading(true);
    setError(null);

    fetchCuratedListings({
      city: selectedCity || undefined,
      program: selectedProgram && selectedProgram !== 'All Programs' ? selectedProgram : undefined,
      maxMonthlyPayment: typeof maxMonthlyPayment === 'number' ? maxMonthlyPayment : undefined
    })
      .then(data => {
        setListings(data);
      })
      .catch(err => {
        console.error('Fetch listings error:', err);
        setError('Unable to load curated listings. Please verify server connection.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [leadId, selectedCity, selectedProgram, maxMonthlyPayment]);

  // 3. Handle URL query parameters (e.g. ?listing=curated-or-portland-001)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const listingQuery = params.get('listing');
    if (listingQuery && listings.length > 0) {
      const match = listings.find(l => l.id === listingQuery);
      if (match) {
        setNotesListing(match);
      }
    }
  }, [listings]);

  // Favorites Toggle with Strict 3-Cap Enforcement
  const handleToggleFavorite = async (id: string) => {
    let nextFavorites: string[];

    if (favorites.includes(id)) {
      nextFavorites = favorites.filter(favId => favId !== id);
      showToast('Removed from favorites');
    } else {
      if (favorites.length >= 3) {
        showToast('Top 3 Limit reached! First-time buyers achieve better outcomes focusing on top 3 homes. Unheart one to add another.');
        return;
      }
      nextFavorites = [...favorites, id];
      showToast('Added to your Top 3 Favorites!');
    }

    setFavorites(nextFavorites);
    if (leadId) {
      try {
        await updateFavoritesServer(leadId, nextFavorites);
      } catch (err) {
        console.error('Failed to sync favorites with server:', err);
      }
    }
  };

  const handleClearAllFavorites = async () => {
    setFavorites([]);
    if (leadId) {
      try {
        await updateFavoritesServer(leadId, []);
      } catch {
        // ignore
      }
    }
    showToast('Favorites cleared');
  };

  // Card to Map Deep-Link Handler
  const handleViewOnMap = (listing: CuratedListing) => {
    setDeepLinkedListingId(listing.id);
    setActiveView('map');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <Header
        activeView={activeView}
        setActiveView={setActiveView}
        selectedCity={selectedCity}
        setSelectedCity={setSelectedCity}
        selectedProgram={selectedProgram}
        setSelectedProgram={setSelectedProgram}
        maxMonthlyPayment={maxMonthlyPayment}
        setMaxMonthlyPayment={setMaxMonthlyPayment}
        favoritesCount={favorites.length}
        onOpenAlerts={() => setIsAlertsOpen(true)}
        onOpenPublishing={() => setIsPublishingGeneralOpen(true)}
        onOpenInstallGuide={() => setIsInstallGuideOpen(true)}
        onOpenSimulator={() => setIsSimulatorOpen(true)}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        disclaimerServed={disclaimerServed}
      />

      {/* Toast Alert Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-4 z-50 bg-slate-900 border border-cyan-500/50 text-cyan-200 px-4 py-2.5 rounded-xl shadow-2xl text-xs flex items-center gap-2 animate-bounce">
          <Sparkles className="w-4 h-4 text-cyan-400 flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Muse AI Persistent Left Sidebar */}
        <MuseSidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          leadId={leadId}
          onSelectListing={(listing) => {
            setNotesListing(listing);
          }}
          onOpenBuydown={() => setBuydownListing(listings[0] || null)}
          onOpenMikeSchedule={() => setPreApprovalListing(listings[0] || null)}
        />

        {/* Content Canvas */}
        <main className={`flex-1 transition-all duration-300 overflow-y-auto ${isSidebarOpen ? 'md:ml-[420px]' : ''}`}>
          {/* Favorites Rail (Pinned Above Content) */}
          <FavoritesRail
            favorites={favorites}
            allListings={listings}
            onRemoveFavorite={handleToggleFavorite}
            onSelectListing={(listing) => setNotesListing(listing)}
            onClearAllFavorites={handleClearAllFavorites}
          />

          <div className="max-w-7xl mx-auto px-4 py-4 space-y-6">
            {/* View Switch: List vs Map */}
            {activeView === 'map' ? (
              <ListingMap
                listings={listings}
                favorites={favorites}
                onToggleFavorite={handleToggleFavorite}
                onOpenNotes={(listing) => setNotesListing(listing)}
                onBackToList={() => setActiveView('list')}
                deepLinkedListingId={deepLinkedListingId}
              />
            ) : (
              <div>
                {/* Section Header */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                      <span>Curated First-Time Homebuyer Platter</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                        {listings.length} Single-Family Homes
                      </span>
                    </h2>
                    <p className="text-xs text-slate-400">
                      Pre-screened for 0%–3.5% down programs, 2-1 temporary buydowns, and local agent tours
                    </p>
                  </div>

                  <button
                    onClick={() => setActiveView('map')}
                    className="hidden sm:flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-medium"
                  >
                    <span>View All on GeoSphere Map</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Loading / Error States */}
                {loading ? (
                  <div className="text-center py-24 space-y-3">
                    <Sparkles className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
                    <p className="text-sm font-semibold text-slate-300">Loading verbatim curated homes...</p>
                    <p className="text-xs text-slate-500">Checking loan program overlays and upstream sweep flags</p>
                  </div>
                ) : error ? (
                  <div className="text-center py-16 px-4 bg-rose-950/20 border border-rose-900/40 rounded-2xl max-w-lg mx-auto">
                    <AlertCircle className="w-8 h-8 text-rose-400 mx-auto mb-2" />
                    <p className="text-sm font-bold text-rose-300">{error}</p>
                    <button
                      onClick={() => window.location.reload()}
                      className="mt-3 px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold"
                    >
                      Retry
                    </button>
                  </div>
                ) : listings.length === 0 ? (
                  /* Honest Empty State */
                  <div className="text-center py-20 px-4 bg-slate-900/50 border border-dashed border-slate-800 rounded-2xl max-w-md mx-auto">
                    <Home className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                    <h3 className="text-base font-bold text-slate-300">No homes match this specific filter</h3>
                    <p className="text-xs text-slate-500 mt-1 mb-4">
                      Try clearing the city or price filter to browse all Pacific Northwest curated single-family homes.
                    </p>
                    <button
                      onClick={() => {
                        setSelectedCity('');
                        setSelectedProgram('');
                        setMaxMonthlyPayment('');
                      }}
                      className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold shadow-md"
                    >
                      Reset All Filters
                    </button>
                  </div>
                ) : (
                  /* Curated Cards Grid / Carousel */
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {listings.map(listing => (
                      <ListingCard
                        key={listing.id}
                        listing={listing}
                        isFavorite={favorites.includes(listing.id)}
                        onToggleFavorite={handleToggleFavorite}
                        onOpenNotes={(l) => setNotesListing(l)}
                        onOpenBuydown={(l) => setBuydownListing(l)}
                        onOpenPublishing={(l) => setPublishingListing(l)}
                        onViewOnMap={handleViewOnMap}
                        onOpenSchedule={(l) => setPreApprovalListing(l)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Compliance Footer Banner */}
            <footer className="pt-8 pb-12 border-t border-slate-800/80 text-[11px] text-slate-500 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-3 text-slate-400">
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-cyan-400" />
                  <span className="font-semibold text-slate-300">Mike Ford, NMLS #288455</span>
                  <span>• Senior Mortgage Loan Officer</span>
                </div>
                <span>Equal Housing Opportunity</span>
              </div>
              <p className="leading-relaxed text-slate-500">
                Mandatory First-Time Homebuyer Disclosure: Price caps, income qualifiers, census tracts, listing price, status, and program eligibility are not guaranteed; pre-screened for your curated experience; must be confirmed by your licensed loan officer and local real estate agent. Pre-approval must be obtained from your loan officer. All listings presented verbatim from upstream GeoSphere RentCast curation.
              </p>
              <p className="text-[10px] text-slate-600 font-mono">
                Copyright (c) 2026 Mike Ford, NMLS #288455. All Rights Reserved. Lead-generation plugin architecture.
              </p>
            </footer>
          </div>
        </main>
      </div>

      {/* Modals Container */}
      {notesListing && (
        <PropertyNotesModal
          listing={notesListing}
          leadId={leadId}
          onClose={() => setNotesListing(null)}
        />
      )}

      {publishingListing && (
        <PublishingModal
          listing={publishingListing}
          onClose={() => setPublishingListing(null)}
        />
      )}

      {isPublishingGeneralOpen && (
        <PublishingModal
          listing={null}
          onClose={() => setIsPublishingGeneralOpen(false)}
        />
      )}

      {buydownListing && (
        <BuydownExplainerModal
          listing={buydownListing}
          onClose={() => setBuydownListing(null)}
          onConnectMike={() => {
            setBuydownListing(null);
            setPreApprovalListing(buydownListing);
          }}
        />
      )}

      {preApprovalListing && (
        <PreApprovalModal
          listing={preApprovalListing}
          onClose={() => setPreApprovalListing(null)}
        />
      )}

      {isAlertsOpen && (
        <PriceDropAlertModal
          leadId={leadId}
          favorites={favorites}
          selectedCity={selectedCity}
          onClose={() => setIsAlertsOpen(false)}
        />
      )}

      {isInstallGuideOpen && (
        <PwaInstallGuideModal
          onClose={() => setIsInstallGuideOpen(false)}
        />
      )}

      {isSimulatorOpen && (
        <MikeReplySimulatorModal
          leadId={leadId}
          onClose={() => setIsSimulatorOpen(false)}
          onRefreshHistory={() => {
            showToast('History refreshed with Mike Ford reply!');
          }}
        />
      )}
    </div>
  );
}
