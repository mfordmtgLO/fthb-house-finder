// Copyright (c) 2026 Mike Ford, NMLS #288455. All Rights Reserved.
import React from 'react';
import { Home, MapPin, Bell, Share2, Download, MessageSquare, ShieldCheck, Sparkles } from 'lucide-react';

interface HeaderProps {
  activeView: 'list' | 'map';
  setActiveView: (view: 'list' | 'map') => void;
  selectedCity: string;
  setSelectedCity: (city: string) => void;
  selectedProgram: string;
  setSelectedProgram: (prog: string) => void;
  maxMonthlyPayment: number | '';
  setMaxMonthlyPayment: (val: number | '') => void;
  favoritesCount: number;
  onOpenAlerts: () => void;
  onOpenPublishing: () => void;
  onOpenInstallGuide: () => void;
  onOpenSimulator: () => void;
  onOpenUsdaAdjuster: () => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  disclaimerServed: boolean;
}

const CITIES = ['All Cities', 'Portland', 'Gresham', 'Vancouver', 'Beaverton', 'Hillsboro', 'Oregon City'];
const PROGRAMS = ['All Programs', '0% Down (VA / USDA)', 'FHA 3.5%', 'Conventional 3%', '2-1 Buydown', 'DPA Grant'];

export const Header: React.FC<HeaderProps> = ({
  activeView,
  setActiveView,
  selectedCity,
  setSelectedCity,
  selectedProgram,
  setSelectedProgram,
  maxMonthlyPayment,
  setMaxMonthlyPayment,
  favoritesCount,
  onOpenAlerts,
  onOpenPublishing,
  onOpenInstallGuide,
  onOpenSimulator,
  onOpenUsdaAdjuster,
  isSidebarOpen,
  setIsSidebarOpen,
  disclaimerServed
}) => {
  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 shadow-lg">
      {/* Top Banner / Attribution */}
      <div className="bg-gradient-to-r from-cyan-950 via-slate-900 to-indigo-950 px-4 py-1.5 border-b border-cyan-900/30 flex flex-wrap items-center justify-between text-xs text-slate-300">
        <div className="flex items-center space-x-2">
          <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
          <span className="font-medium text-cyan-200">Mike Ford, NMLS #288455</span>
          <span className="hidden sm:inline text-slate-400">• Curated First-Time Homebuyer Low/No-Down Portal</span>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={onOpenUsdaAdjuster}
            className="text-xs text-cyan-300 hover:text-cyan-200 underline font-medium flex items-center gap-1"
            title="Open 2026 USDA & Lakeview AMI Income Adjuster"
          >
            <span>🌾 USDA Income Adjuster</span>
          </button>
          <span className="text-slate-500 hidden sm:inline">|</span>
          <button
            onClick={onOpenSimulator}
            className="text-xs text-amber-300 hover:text-amber-200 underline font-mono flex items-center gap-1"
            title="Simulate 3-way reply from Mike's iPhone"
          >
            <span>📱 LO Test Simulator</span>
          </button>
          <span className="text-slate-500 hidden sm:inline">|</span>
          <span className="text-slate-400 text-[11px]">Zero-Trust • Equal Housing Lender</span>
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
        {/* Brand & Toggle Sidebar */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={`p-2 rounded-lg border transition-all flex items-center gap-1.5 ${
              isSidebarOpen
                ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 shadow-sm shadow-cyan-500/20'
                : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
            title="Toggle Muse AI Intake Sidebar"
          >
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-semibold hidden md:inline">Muse AI</span>
          </button>

          <div className="flex flex-col">
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center shadow-md shadow-cyan-500/20">
                <Home className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
                <span>FTHB House Finder</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 uppercase font-mono tracking-wider">
                  Plugin
                </span>
              </h1>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Curated single-family homes that likely qualify for 0%–3.5% down
            </p>
          </div>
        </div>

        {/* View Switcher: List vs Map */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveView('list')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              activeView === 'list'
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Home className="w-3.5 h-3.5" />
            <span>Homes</span>
          </button>
          <button
            onClick={() => setActiveView('map')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              activeView === 'map'
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Map</span>
          </button>
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center space-x-2">
          {/* Price drop alert button */}
          <button
            onClick={onOpenAlerts}
            className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-cyan-300 transition-all text-xs flex items-center gap-1.5"
            title="Set up price-drop alerts"
          >
            <Bell className="w-4 h-4 text-amber-400" />
            <span className="hidden lg:inline font-medium">Drop Alerts</span>
          </button>

          {/* Publishing Toolkit */}
          <button
            onClick={onOpenPublishing}
            className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-cyan-300 transition-all text-xs flex items-center gap-1.5"
            title="Open Mike's Publishing & Social Toolkit"
          >
            <Share2 className="w-4 h-4 text-cyan-400" />
            <span className="hidden lg:inline font-medium">Publish & Share</span>
          </button>

          {/* PWA Install */}
          <button
            onClick={onOpenInstallGuide}
            className="p-2 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-cyan-300 transition-all text-xs flex items-center gap-1.5"
            title="Install as App on Phone / Home Screen"
          >
            <Download className="w-4 h-4" />
            <span className="hidden xl:inline font-medium">Install App</span>
          </button>
        </div>
      </div>

      {/* Filter Ribbon */}
      <div className="max-w-7xl mx-auto px-4 py-2 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* City selector */}
          <div className="flex items-center space-x-1.5">
            <span className="text-slate-400 font-medium">City:</span>
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 focus:outline-none focus:border-cyan-500 text-xs"
            >
              {CITIES.map(c => (
                <option key={c} value={c === 'All Cities' ? '' : c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Program filter */}
          <div className="flex items-center space-x-1.5">
            <span className="text-slate-400 font-medium">Program:</span>
            <select
              value={selectedProgram}
              onChange={(e) => setSelectedProgram(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 focus:outline-none focus:border-cyan-500 text-xs"
            >
              {PROGRAMS.map(p => (
                <option key={p} value={p === 'All Programs' ? '' : p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {/* Max Monthly Payment */}
          <div className="flex items-center space-x-1.5">
            <span className="text-slate-400 font-medium">Max Monthly:</span>
            <select
              value={maxMonthlyPayment || ''}
              onChange={(e) => setMaxMonthlyPayment(e.target.value ? Number(e.target.value) : '')}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 focus:outline-none focus:border-cyan-500 text-xs"
            >
              <option value="">Any Payment</option>
              <option value="2400">Up to $2,400/mo</option>
              <option value="2600">Up to $2,600/mo</option>
              <option value="2800">Up to $2,800/mo</option>
              <option value="3000">Up to $3,000/mo</option>
            </select>
          </div>
        </div>

        <div className="flex items-center space-x-3 text-slate-400">
          <span>Favorites: <strong className="text-cyan-400">{favoritesCount}/3</strong></span>
          <span className="text-slate-600">•</span>
          <span className="text-emerald-400 flex items-center gap-1 font-mono text-[11px]">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Verbatim Upstream Curation
          </span>
        </div>
      </div>
    </header>
  );
};
