// Copyright (c) 2026 Mike Ford, NMLS #288455. All Rights Reserved.
import React, { useState, useEffect } from 'react';
import {
  initBuyerSession,
  fetchCuratedListings,
  fetchBuyerCurations,
  updateFavoritesServer,
  getLocalLeadId,
  fetchPluginStatus
} from './api';
import { CuratedListing, BuyerCurationsResponse } from './types';
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
import { UsdaIncomeAdjusterModal } from './components/UsdaIncomeAdjusterModal';
import { IdentifyModal } from './components/IdentifyModal';
import LeadIntakeChatbot from './components/LeadIntakeChatbot';
import {
  Home,
  ShieldCheck,
  AlertCircle,
  Sparkles,
  Heart,
  ChevronRight,
  Info,
  Layers,
  ArrowRight,
  MapPin,
  Star,
  UserCheck,
  Mail
} from 'lucide-react';

export default function App() {
  const [leadId, setLeadId] = useState<string>('');
  const [buyerEmail, setBuyerEmail] = useState<string>('');
  const [pairing, setPairing] = useState<any | null>(null);
  const [disclaimerServed, setDisclaimerServed] = useState<boolean>(false);
  const [pluginStatus, setPluginStatus] = useState<'active' | 'suspended' | 'killed'>('active');
  const [pluginReason, setPluginReason] = useState<string>('');
  const [listings, setListings] = useState<CuratedListing[]>([]);
  const [curationsData, setCurationsData] = useState<BuyerCurationsResponse | null>(null);
  const [curationScope, setCurationScope] = useState<'all' | 'my-curations'>('all');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // View state: on mobile screens (<1024px), sidebar is closed initially to expose homes & map
  const [activeView, setActiveView] = useState<'list' | 'map'>('list');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1024;
    }
    return false;
  });

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
  const [isUsdaAdjusterOpen, setIsUsdaAdjusterOpen] = useState<boolean>(false);
  const [isIdentifyOpen, setIsIdentifyOpen] = useState<boolean>(false);

  // Deep-linking map state
  const [deepLinkedListingId, setDeepLinkedListingId] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // 1. Initialize Buyer Session & Disclaimer & Plugin Status
  useEffect(() => {
    initBuyerSession()
      .then(session => {
        setLeadId(session.leadId);
        setDisclaimerServed(session.disclaimerServed);
        if (session.pairing) {
          setPairing(session.pairing);
        }
        if (session.statedPreferences?.favorites) {
          setFavorites(session.statedPreferences.favorites);
        }
        if (session.pluginStatus) {
          setPluginStatus(session.pluginStatus);
        }
      })
      .catch(err => {
        console.error('Session init error:', err);
        if (err?.message?.includes('suspended') || err?.code === 'PLUGIN_SUSPENDED') {
          setPluginStatus('suspended');
        } else if (err?.message?.includes('killed') || err?.code === 'PLUGIN_KILLED') {
          setPluginStatus('killed');
        }
      });

    fetchPluginStatus()
      .then(res => {
        setPluginStatus(res.status);
        if (res.reason) setPluginReason(res.reason);
      })
      .catch(() => {});
  }, []);

  // 2. Fetch Buyer Personal Curations from GET /api/buyer/curations/:leadId
  const loadBuyerCurations = (id: string) => {
    if (!id) return;
    fetchBuyerCurations(id)
      .then(res => {
        setCurationsData(res);
      })
      .catch(err => {
        console.warn('Personal curations check:', err.message);
      });
  };

  useEffect(() => {
    if (leadId) {
      loadBuyerCurations(leadId);
    }
  }, [leadId]);

  // 3. Fetch Curated Listings when filters or scope change
  useEffect(() => {
    if (!leadId) return;

    setLoading(true);
    setError(null);

    if (curationScope === 'my-curations') {
      fetchBuyerCurations(leadId)
        .then(data => {
          setCurationsData(data);
          setListings(data.listings || []);
        })
        .catch(err => {
          console.error('Fetch curations error:', err);
          setError('Unable to load your curated homes. Please verify server connection.');
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      fetchCuratedListings({
        city: selectedCity || undefined,
        program: selectedProgram && selectedProgram !== 'All Programs' ? selectedProgram : undefined,
        maxMonthlyPayment: typeof maxMonthlyPayment === 'number' ? maxMonthlyPayment : undefined,
        leadId
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
    }
  }, [leadId, curationScope, selectedCity, selectedProgram, maxMonthlyPayment]);

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
    setIsSidebarOpen(false); // Close sidebar on mobile so map is immediately visible
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
        onOpenUsdaAdjuster={() => setIsUsdaAdjusterOpen(true)}
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

      {/* Kill Switch & Suspension Banners */}
      {pluginStatus === 'suspended' && (
        <div className="bg-amber-950/90 border-b border-amber-500/50 text-amber-200 px-4 py-2.5 text-xs flex items-center justify-between gap-3 shrink-0 z-30">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Service Notice:</strong> FTHB House Finder is temporarily unavailable while maintenance is being performed. Please contact Mike Ford (NMLS #288455) at <a href="mailto:fordmj@gmail.com" className="underline font-semibold hover:text-white">fordmj@gmail.com</a> for immediate assistance.
            </span>
          </div>
        </div>
      )}

      {pluginStatus === 'killed' && (
        <div className="bg-rose-950/95 border-b border-rose-500/60 text-rose-100 px-4 py-3 text-xs flex items-center justify-between gap-3 shrink-0 shadow-lg z-30">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>
              <strong>Service Notice:</strong> This FTHB House Finder plugin install has been permanently disabled by Mike Ford (NMLS #288455). Contact <a href="mailto:fordmj@gmail.com" className="underline font-bold text-white">fordmj@gmail.com</a> for access.
            </span>
          </div>
        </div>
      )}

      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Muse AI Persistent Left Sidebar */}
        <MuseSidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          leadId={leadId}
          pairing={pairing}
          onSelectListing={(listing) => {
            setNotesListing(listing);
          }}
          onOpenBuydown={() => setBuydownListing(listings[0] || null)}
          onOpenMikeSchedule={() => setPreApprovalListing(listings[0] || null)}
        />

        {/* Content Canvas */}
        <main className={`flex-1 transition-all duration-300 overflow-y-auto pb-24 md:pb-6 ${isSidebarOpen ? 'md:ml-[420px]' : ''}`}>
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
                {/* Scope Switcher & Personal Curation Banner */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurationScope('all')}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                        curationScope === 'all'
                          ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-950/50'
                          : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>All Curated Homes</span>
                    </button>

                    <button
                      onClick={() => setCurationScope('my-curations')}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                        curationScope === 'my-curations'
                          ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold shadow-lg shadow-amber-950/50'
                          : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <Star className="w-3.5 h-3.5 fill-current" />
                      <span>My Curated Homes</span>
                      {curationsData?.hasCurations && curationsData.listings?.length > 0 && (
                        <span className="ml-1 px-1.5 py-0.2 rounded-full bg-slate-950/80 text-amber-300 text-[10px] font-mono">
                          {curationsData.listings.length}
                        </span>
                      )}
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {buyerEmail ? (
                      <div className="px-3 py-1 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-300 flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="font-mono">{buyerEmail}</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => setIsIdentifyOpen(true)}
                        className="px-3 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors"
                      >
                        <Mail className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Sign In with Email</span>
                      </button>
                    )}

                    <button
                      onClick={() => setActiveView('map')}
                      className="hidden sm:flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-medium ml-2"
                    >
                      <span>View Map</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Personal Curation Notice Banner (when My Curated Homes active) */}
                {curationScope === 'my-curations' && curationsData?.hasCurations && (
                  <div className="my-4 p-4 bg-gradient-to-r from-amber-950/40 via-slate-900 to-amber-950/30 border border-amber-500/40 rounded-2xl flex items-center justify-between gap-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center flex-shrink-0">
                        <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                          <span>Homes Personally Curated for You by Mike Ford</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
                            NMLS #288455
                          </span>
                        </h3>
                        <p className="text-xs text-slate-300 mt-0.5">
                          {curationsData.buyerNote || 'These single-family homes were hand-selected for your target budget and low-down payment eligibility.'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Section Header */}
                <div className="flex items-center justify-between mt-4 mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                      <span>{curationScope === 'my-curations' ? 'Your Personal Curated List' : 'Curated First-Time Homebuyer Platter'}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                        {listings.length} Single-Family Homes
                      </span>
                    </h2>
                    <p className="text-xs text-slate-400">
                      {curationScope === 'my-curations'
                        ? 'Hand-selected homes paired directly with your borrower profile from Mike Ford'
                        : 'Pre-screened for 0%–3.5% down programs, 2-1 temporary buydowns, and local agent tours'}
                    </p>
                  </div>
                </div>

                {/* Loading / Error States */}
                {loading ? (
                  <div className="text-center py-24 space-y-3">
                    <Sparkles className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
                    <p className="text-sm font-semibold text-slate-300">
                      {curationScope === 'my-curations' ? 'Loading your married homes from Mike Ford...' : 'Loading verbatim curated homes...'}
                    </p>
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
                  <div className="text-center py-16 px-6 bg-slate-900/60 border border-dashed border-slate-800 rounded-2xl max-w-lg mx-auto space-y-4">
                    <div className="w-12 h-12 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center mx-auto text-slate-400">
                      <Home className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-200">
                        {curationScope === 'my-curations'
                          ? 'No personalized curated homes married yet'
                          : selectedCity || selectedProgram || maxMonthlyPayment
                          ? 'No homes match your current filter'
                          : 'No curated homes currently available'}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        {curationScope === 'my-curations'
                          ? 'Mike Ford has not yet married a custom list to this profile. You can ask Muse in the chat to submit a curation request, or sign in with your email if you already requested one.'
                          : selectedCity || selectedProgram || maxMonthlyPayment
                          ? 'Try resetting your filters, or request custom curation for your target area from Mike Ford.'
                          : 'Our candidate pool is refreshed regularly with verified low/no-down payment qualifying single-family homes.'}
                      </p>
                    </div>

                    <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl text-left space-y-1.5">
                      <div className="flex items-center space-x-2 text-cyan-400 font-semibold text-xs">
                        <ShieldCheck className="w-4 h-4 text-cyan-400" />
                        <span>Request Custom Curation with Mike Ford</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug">
                        Contact <strong className="text-slate-200">Mike Ford, Loan Officer | NMLS #288455</strong> to curate a personalized list of 0% down USDA, 3.5% FHA, or down payment assistance homes for your family.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                      {curationScope === 'all' && (selectedCity || selectedProgram || maxMonthlyPayment) && (
                        <button
                          onClick={() => {
                            setSelectedCity('');
                            setSelectedProgram('');
                            setMaxMonthlyPayment('');
                          }}
                          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-colors"
                        >
                          Reset Filters
                        </button>
                      )}

                      {curationScope === 'my-curations' && (
                        <button
                          onClick={() => setIsIdentifyOpen(true)}
                          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
                        >
                          <Mail className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Sign In with Email</span>
                        </button>
                      )}

                      <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md flex items-center gap-1.5"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Ask Muse to Request Curation</span>
                      </button>
                    </div>
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

      {/* Floating Chat Button: Repositioned with safe margins, hidden when Muse is open */}
      {!isSidebarOpen && (
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-30 p-3 sm:p-3.5 rounded-full bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white shadow-2xl shadow-cyan-950/80 border border-cyan-400/40 flex items-center gap-2 group transition-all duration-200 active:scale-95"
          title="Open Muse AI Assistant"
        >
          <Sparkles className="w-5 h-5 text-white animate-pulse" />
          <span className="text-xs font-bold hidden sm:inline pr-1">Ask Muse</span>
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-slate-900 absolute top-0.5 right-0.5"></span>
        </button>
      )}

      {/* Mobile Tab Navigation Bar (390px safe, fixed at bottom) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800 px-3 py-1.5 flex items-center justify-around shadow-2xl safe-bottom">
        <button
          onClick={() => {
            setActiveView('map');
            setIsSidebarOpen(false);
          }}
          className={`flex-1 flex flex-col items-center justify-center py-1 rounded-xl transition-all ${
            !isSidebarOpen && activeView === 'map'
              ? 'text-cyan-400 font-bold bg-cyan-950/40'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <MapPin className="w-5 h-5 mb-0.5" />
          <span className="text-[11px]">Map</span>
        </button>

        <button
          onClick={() => {
            setActiveView('list');
            setIsSidebarOpen(false);
          }}
          className={`flex-1 flex flex-col items-center justify-center py-1 rounded-xl transition-all ${
            !isSidebarOpen && activeView === 'list'
              ? 'text-cyan-400 font-bold bg-cyan-950/40'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Home className="w-5 h-5 mb-0.5" />
          <span className="text-[11px]">Homes</span>
        </button>

        <button
          onClick={() => setIsSidebarOpen(true)}
          className={`flex-1 flex flex-col items-center justify-center py-1 rounded-xl transition-all relative ${
            isSidebarOpen
              ? 'text-cyan-400 font-bold bg-cyan-950/40'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <Sparkles className="w-5 h-5 mb-0.5 text-cyan-400" />
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          </div>
          <span className="text-[11px] flex items-center gap-1">
            <span>Muse</span>
            <span className="text-[8px] px-1 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-mono">3-Way</span>
          </span>
        </button>
      </nav>

      {/* Modals Container */}
      {notesListing && (
        <PropertyNotesModal
          listing={notesListing}
          leadId={leadId}
          pairing={pairing}
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

      {isUsdaAdjusterOpen && (
        <UsdaIncomeAdjusterModal
          isOpen={isUsdaAdjusterOpen}
          onClose={() => setIsUsdaAdjusterOpen(false)}
        />
      )}

      {isIdentifyOpen && (
        <IdentifyModal
          currentLeadId={leadId}
          onClose={() => setIsIdentifyOpen(false)}
          onIdentityResolved={(newLeadId, email) => {
            setLeadId(newLeadId);
            setBuyerEmail(email);
            showToast(`Profile linked to ${email}!`);
            loadBuyerCurations(newLeadId);
          }}
        />
      )}

      <LeadIntakeChatbot
        leadId={leadId}
        pairing={pairing}
        isSidebarOpen={isSidebarOpen}
        onSaveLead={() => {
          loadBuyerCurations(leadId);
        }}
        onExploreListings={() => {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    </div>
  );
}
