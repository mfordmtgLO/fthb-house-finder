// Copyright (c) 2026 Mike Ford, NMLS #288455. All Rights Reserved.
import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  MapPin, 
  Heart, 
  Trophy, 
  TrendingDown, 
  Compass, 
  X, 
  ChevronRight,
  Smile,
  Bot,
  Volume2,
  VolumeX,
  ShieldCheck
} from 'lucide-react';

export type GuideCharacter = 'pin' | 'geo';
export type GuidePose = 'idle' | 'celebrating' | 'exploring' | 'alert' | 'proud';

interface GuideDockProps {
  favoritesCount: number;
  lastAction?: {
    type: 'favorite' | 'top3' | 'price_drop' | 'explore' | 'welcome';
    timestamp: number;
    meta?: any;
  } | null;
  onOpenGuidebook?: () => void;
  onOpenChat?: () => void;
  isChatOpen?: boolean;
}

const STORAGE_GUIDE_KEY = 'fthb_selected_guide_v1';

export const GuideDock: React.FC<GuideDockProps> = ({
  favoritesCount,
  lastAction,
  onOpenGuidebook,
  onOpenChat,
  isChatOpen
}) => {
  const [selectedGuide, setSelectedGuide] = useState<GuideCharacter>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_GUIDE_KEY);
        if (saved === 'pin' || saved === 'geo') return saved;
      } catch {}
    }
    return 'pin'; // Pin is the default scout guide
  });

  const [pose, setPose] = useState<GuidePose>('idle');
  const [speechBubble, setSpeechBubble] = useState<string>('');
  const [showBubble, setShowBubble] = useState<boolean>(true);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);

  // Scripted dialog library (zero AI hallucination, deterministic responses per spec)
  useEffect(() => {
    if (!lastAction) {
      if (favoritesCount === 0) {
        setPose('exploring');
        setSpeechBubble(
          selectedGuide === 'pin'
            ? "Hey there! I'm Pin, your neighborhood scout. Browse the platter and tap the heart to save homes you love!"
            : "Welcome! I'm Geo, your mapping companion. Explore curated homes across the PNW and find your fit!"
        );
      } else if (favoritesCount >= 3) {
        setPose('proud');
        setSpeechBubble("You've got your Top 3 finalists! Mike Ford can run numbers on these whenever you're ready.");
      } else {
        setPose('idle');
        setSpeechBubble(`You've pinned ${favoritesCount} favorite${favoritesCount > 1 ? 's' : ''}! Pick up to 3 to compare side-by-side.`);
      }
      return;
    }

    if (lastAction.type === 'favorite') {
      setPose('celebrating');
      setSpeechBubble(
        selectedGuide === 'pin'
          ? "Great find! Hearting homes keeps your search focused on what matters to you."
          : "Saved to your list! Building your tour makes visiting open houses simple."
      );
    } else if (lastAction.type === 'top3') {
      setPose('proud');
      setSpeechBubble("Top 3 set! Having three focused contenders keeps your first-time purchase sharp and stress-free.");
    } else if (lastAction.type === 'price_drop') {
      setPose('alert');
      setSpeechBubble("Good news! One of your saved homes had a price reduction. Check out the updated monthly payment!");
    } else if (lastAction.type === 'explore') {
      setPose('exploring');
      setSpeechBubble("Every home here is pre-screened for low or zero down payment options in Oregon and Washington.");
    }

    setShowBubble(true);
    const timer = setTimeout(() => {
      setPose('idle');
    }, 5000);
    return () => clearTimeout(timer);
  }, [lastAction, selectedGuide, favoritesCount]);

  const toggleGuide = () => {
    const next: GuideCharacter = selectedGuide === 'pin' ? 'geo' : 'pin';
    setSelectedGuide(next);
    try {
      localStorage.setItem(STORAGE_GUIDE_KEY, next);
    } catch {}
  };

  return (
    <div className="relative group">
      {/* Dock Card */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900/95 to-cyan-950/30 border border-slate-800 hover:border-cyan-500/40 rounded-2xl p-3 sm:p-3.5 shadow-xl transition-all flex items-center justify-between gap-3">
        {/* Left: Guide Avatar & Status */}
        <div className="flex items-center space-x-3 min-w-0">
          {/* Avatar Character Badge with Pose Animation */}
          <button
            onClick={toggleGuide}
            className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500/20 via-slate-800 to-indigo-500/20 border-2 border-cyan-400/50 flex items-center justify-center text-white shadow-lg shrink-0 hover:scale-105 active:scale-95 transition-all"
            title={`Active Guide: ${selectedGuide === 'pin' ? 'Pin (Scout)' : 'Geo (Navigator)'}. Tap to switch companion.`}
          >
            {selectedGuide === 'pin' ? (
              <div className="flex flex-col items-center">
                <MapPin className={`w-6 h-6 text-cyan-400 ${pose === 'celebrating' ? 'animate-bounce' : pose === 'alert' ? 'animate-pulse text-amber-400' : ''}`} />
                <span className="text-[9px] font-mono font-bold text-cyan-300 -mt-0.5">PIN</span>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <Compass className={`w-6 h-6 text-indigo-400 ${pose === 'celebrating' ? 'animate-spin' : pose === 'alert' ? 'animate-pulse text-amber-400' : ''}`} />
                <span className="text-[9px] font-mono font-bold text-indigo-300 -mt-0.5">GEO</span>
              </div>
            )}

            {/* Pose indicator ping */}
            {pose === 'celebrating' && (
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-slate-900 animate-ping" />
            )}
            {pose === 'alert' && (
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-400 border-2 border-slate-900 animate-ping" />
            )}
          </button>

          {/* Guide Description & Speech Bubble */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-white flex items-center gap-1.5 truncate">
                <span>{selectedGuide === 'pin' ? 'Pin the Neighborhood Scout' : 'Geo the Home Navigator'}</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-mono">
                  Your Home Guide
                </span>
              </span>
              <button
                onClick={toggleGuide}
                className="text-[10px] text-cyan-400 hover:text-cyan-300 underline font-medium shrink-0"
              >
                Switch to {selectedGuide === 'pin' ? 'Geo' : 'Pin'}
              </button>
            </div>

            {/* Speech Line */}
            {showBubble && speechBubble && (
              <p className="text-xs text-slate-300 mt-0.5 line-clamp-2 leading-snug">
                "{speechBubble}"
              </p>
            )}
          </div>
        </div>

        {/* Right Actions: Quick Guidebook & Muse triggers */}
        <div className="flex items-center space-x-2 shrink-0">
          {onOpenGuidebook && (
            <button
              onClick={onOpenGuidebook}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition-all shadow-sm"
              title="Open My Home Guidebook stamps"
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Guidebook</span>
            </button>
          )}

          {onOpenChat && !isChatOpen && (
            <button
              onClick={onOpenChat}
              className="px-3 py-1.5 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md flex items-center gap-1.5 transition-all"
              title="Ask Muse Lending Assistant"
            >
              <Bot className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Ask Muse</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default GuideDock;
