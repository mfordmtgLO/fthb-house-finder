// Copyright (c) 2026 Mike Ford, NMLS #288455. All Rights Reserved.
import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  CheckCircle2, 
  Circle, 
  ArrowRight, 
  Sparkles, 
  ChevronDown, 
  ChevronUp, 
  Compass, 
  Heart, 
  ShieldCheck, 
  Calendar,
  MessageSquare,
  Award,
  Layers
} from 'lucide-react';
import confetti from 'canvas-confetti';

export interface Milestone {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  completed: boolean;
  actionLabel?: string;
  actionKey?: string;
}

interface GamifiedBuyerJourneyProps {
  favoritesCount: number;
  hasCurations: boolean;
  notesCount?: number;
  isChatOpen: boolean;
  onOpenChat: () => void;
  onOpenIntake: () => void;
  onOpenBuydown: () => void;
  onOpenSchedule: () => void;
}

const STORAGE_KEY = 'fthb_guidebook_progress_v1';

export const GamifiedBuyerJourney: React.FC<GamifiedBuyerJourneyProps> = ({
  favoritesCount,
  hasCurations,
  notesCount = 0,
  isChatOpen,
  onOpenChat,
  onOpenIntake,
  onOpenBuydown,
  onOpenSchedule
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY + '_expanded');
        if (saved !== null) return JSON.parse(saved);
      } catch {}
      return window.innerWidth >= 768; // open by default on tablet/desktop, compact on mobile
    }
    return true;
  });

  const [milestonesManual, setMilestonesManual] = useState<Record<string, boolean>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return {};
  });

  // Calculate dynamic stamps based on buyer actions + state
  const m1_explore = true; // Started browsing
  const m2_intake = Boolean(hasCurations || milestonesManual['intake_done']);
  const m3_favorites = favoritesCount >= 1;
  const m4_top3 = favoritesCount >= 3;
  const m5_buydown = Boolean(milestonesManual['buydown_explored']);
  const m6_note = notesCount > 0 || Boolean(milestonesManual['note_sent']);
  const m7_strategy = Boolean(milestonesManual['strategy_booked']);

  const milestones: Milestone[] = [
    {
      id: 'm1_explore',
      title: 'Explore Curated Homes',
      subtitle: "Browse curated low- and no-down-payment homes",
      icon: 'compass',
      completed: m1_explore
    },
    {
      id: 'm2_intake',
      title: 'Share Your Home Goals',
      subtitle: "Tell us what you're dreaming of — zero SSN, no obligation",
      icon: 'sparkles',
      completed: m2_intake,
      actionLabel: m2_intake ? 'Completed' : 'Start',
      actionKey: 'intake'
    },
    {
      id: 'm3_favorites',
      title: 'Heart Your First Contender',
      subtitle: 'Save a home you love',
      icon: 'heart',
      completed: m3_favorites,
      actionLabel: m3_favorites ? 'Saved' : 'Heart a Home'
    },
    {
      id: 'm4_top3',
      title: 'Lock In Your Top 3',
      subtitle: 'Your three finalists, front and center',
      icon: 'award',
      completed: m4_top3,
      actionLabel: m4_top3 ? `${favoritesCount}/3 Locked` : `${favoritesCount}/3 Saved`
    },
    {
      id: 'm5_buydown',
      title: 'Explore the 2-1 Buydown',
      subtitle: 'See how a 2-1 buydown can lower the early payments on a home',
      icon: 'sparkles',
      completed: m5_buydown,
      actionLabel: m5_buydown ? 'Explored' : 'Run Calculator',
      actionKey: 'buydown'
    },
    {
      id: 'm6_note',
      title: 'Ask a Question',
      subtitle: 'Leave a note for Mike Ford or your paired agent on any listing',
      icon: 'message',
      completed: m6_note,
      actionLabel: m6_note ? 'Note Left' : 'Leave a Note'
    },
    {
      id: 'm7_strategy',
      title: 'Meet Your Team',
      subtitle: 'Book a friendly strategy chat with Mike Ford (NMLS #288455)',
      icon: 'shield',
      completed: m7_strategy,
      actionLabel: m7_strategy ? 'Chat Booked' : 'Schedule',
      actionKey: 'strategy'
    }
  ];

  const completedCount = milestones.filter(m => m.completed).length;
  const totalCount = milestones.length;

  // Trigger celebratory confetti when all stamps are earned
  useEffect(() => {
    if (completedCount === totalCount && totalCount > 0) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  }, [completedCount, totalCount]);

  const toggleExpand = () => {
    const next = !isExpanded;
    setIsExpanded(next);
    try {
      localStorage.setItem(STORAGE_KEY + '_expanded', JSON.stringify(next));
    } catch {}
  };

  const handleActionClick = (actionKey?: string) => {
    if (!actionKey) return;
    if (actionKey === 'intake') {
      onOpenIntake();
    } else if (actionKey === 'buydown') {
      onOpenBuydown();
      setMilestonesManual(prev => {
        const next = { ...prev, buydown_explored: true };
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
        return next;
      });
    } else if (actionKey === 'strategy') {
      onOpenSchedule();
      setMilestonesManual(prev => {
        const next = { ...prev, strategy_booked: true };
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
        return next;
      });
    }
  };

  return (
    <div className="bg-gradient-to-r from-slate-900 via-slate-900/95 to-indigo-950/30 border border-slate-800 hover:border-cyan-500/40 rounded-2xl p-4 shadow-xl transition-all">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-indigo-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300 shadow-inner">
            <BookOpen className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-wide">
                My Home Guidebook
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full border border-cyan-500/30 bg-cyan-950/40 text-cyan-300 font-mono font-semibold">
                {completedCount} of {totalCount} stamps
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Collect stamps as you explore homes and build your personalized tour
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Stamps Indicator Dots */}
          <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800">
            {milestones.map((m) => (
              <span
                key={m.id}
                title={m.title}
                className={`w-2.5 h-2.5 rounded-full transition-all ${
                  m.completed
                    ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50'
                    : 'bg-slate-700'
                }`}
              />
            ))}
          </div>

          <button
            onClick={toggleExpand}
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-all ml-1"
            title={isExpanded ? 'Collapse Guidebook' : 'Expand Guidebook'}
            aria-label={isExpanded ? 'Collapse Guidebook' : 'Expand Guidebook'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded Roadmap / Stamps Grid */}
      {isExpanded && (
        <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5 text-slate-300">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Each stamp marks an exploration milestone along your homebuying journey</span>
            </span>
            <span className="hidden sm:inline font-mono text-slate-500">
              Coached by Mike Ford (NMLS #288455)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
            {milestones.map((milestone, idx) => {
              const isCurrentFocus = !milestone.completed && milestones.slice(0, idx).every(m => m.completed);
              return (
                <div
                  key={milestone.id}
                  className={`p-3 rounded-xl border transition-all flex flex-col justify-between ${
                    milestone.completed
                      ? 'bg-slate-950/60 border-emerald-500/30 text-slate-300'
                      : isCurrentFocus
                      ? 'bg-gradient-to-br from-cyan-950/40 via-slate-950 to-indigo-950/40 border-cyan-500/60 shadow-lg shadow-cyan-950/30'
                      : 'bg-slate-950/40 border-slate-800/70 text-slate-400'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center space-x-1.5">
                        {milestone.completed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        ) : isCurrentFocus ? (
                          <div className="w-4 h-4 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin flex-shrink-0" />
                        ) : (
                          <Circle className="w-4 h-4 text-slate-600 flex-shrink-0" />
                        )}
                        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                          Stamp {idx + 1}
                        </span>
                      </div>
                      <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                        milestone.completed
                          ? 'bg-emerald-500/10 text-emerald-300'
                          : 'bg-slate-800 text-slate-400'
                      }`}>
                        {milestone.completed ? 'Earned' : 'Pending'}
                      </span>
                    </div>

                    <h4 className={`text-xs font-bold ${milestone.completed ? 'text-slate-200' : isCurrentFocus ? 'text-cyan-200 font-extrabold' : 'text-slate-300'}`}>
                      {milestone.title}
                    </h4>
                    <p className="text-[11px] text-slate-400 leading-snug mt-0.5 line-clamp-2">
                      {milestone.subtitle}
                    </p>
                  </div>

                  {milestone.actionLabel && (
                    <div className="mt-2.5 pt-2 border-t border-slate-800/60">
                      {milestone.completed ? (
                        <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{milestone.actionLabel}</span>
                        </span>
                      ) : (
                        <button
                          onClick={() => handleActionClick(milestone.actionKey)}
                          className={`w-full py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all ${
                            isCurrentFocus
                              ? 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-md shadow-cyan-950/40'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                          }`}
                        >
                          <span>{milestone.actionLabel}</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default GamifiedBuyerJourney;
