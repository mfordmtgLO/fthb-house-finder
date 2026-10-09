// Copyright (c) 2026 Mike Ford, NMLS #288455. All Rights Reserved.
import React, { useState, useEffect } from 'react';
import { 
  Trophy, 
  CheckCircle2, 
  Circle, 
  ArrowRight, 
  Sparkles, 
  ChevronDown, 
  ChevronUp, 
  Compass, 
  Award, 
  Clock, 
  Calculator, 
  Heart, 
  MessageSquare, 
  ShieldCheck, 
  Calendar
} from 'lucide-react';
import confetti from 'canvas-confetti';

export interface Milestone {
  id: string;
  title: string;
  subtitle: string;
  xp: number;
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

const STORAGE_KEY = 'fthb_gamified_progress_v1';

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

  // Calculate dynamic milestones based on buyer actions + state
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
      title: 'Explore Curated Platter',
      subtitle: 'Browse pre-screened low & $0-down qualifying homes',
      xp: 15,
      icon: 'compass',
      completed: m1_explore
    },
    {
      id: 'm2_intake',
      title: 'Prequal Blueprint',
      subtitle: 'Generate zero-SSN pre-qualification numbers',
      xp: 25,
      icon: 'calculator',
      completed: m2_intake,
      actionLabel: m2_intake ? 'Completed' : 'Start Blueprint',
      actionKey: 'intake'
    },
    {
      id: 'm3_favorites',
      title: 'Heart 1st Contender',
      subtitle: 'Identify a home that fits your target monthly payment',
      xp: 15,
      icon: 'heart',
      completed: m3_favorites,
      actionLabel: m3_favorites ? 'Contender Saved' : 'Tap Heart on Home'
    },
    {
      id: 'm4_top3',
      title: 'Lock In Top 3 Contenders',
      subtitle: 'Cap focus to top 3 homes for highest closing success',
      xp: 20,
      icon: 'award',
      completed: m4_top3,
      actionLabel: m4_top3 ? `${favoritesCount}/3 Locked` : `${favoritesCount}/3 Saved`
    },
    {
      id: 'm5_buydown',
      title: 'Explore 2-1 Buydown',
      subtitle: 'See how temporary buydowns drop payments $300-$500/mo',
      xp: 15,
      icon: 'sparkles',
      completed: m5_buydown,
      actionLabel: m5_buydown ? 'Explored' : 'Run Calculator',
      actionKey: 'buydown'
    },
    {
      id: 'm6_note',
      title: 'Leave a Property Note',
      subtitle: 'Ask Mike Ford or paired agent a question on any listing',
      xp: 10,
      icon: 'message',
      completed: m6_note,
      actionLabel: m6_note ? 'Question Routed' : 'Open Any Listing Note'
    },
    {
      id: 'm7_strategy',
      title: '1-on-1 Strategy Call',
      subtitle: 'Review rate buydown & DPA overlays with Mike Ford (NMLS #288455)',
      xp: 25,
      icon: 'shield',
      completed: m7_strategy,
      actionLabel: m7_strategy ? 'Strategy Call Set' : 'Schedule Call',
      actionKey: 'strategy'
    }
  ];

  const totalPossibleXp = milestones.reduce((sum, m) => sum + m.xp, 0);
  const earnedXp = milestones.filter(m => m.completed).reduce((sum, m) => sum + m.xp, 0);
  const completedCount = milestones.filter(m => m.completed).length;
  const progressPercent = Math.round((earnedXp / totalPossibleXp) * 100);

  // Buyer Tier based on XP
  let tierName = 'First-Time Explorer';
  let tierBadge = 'Level 1';
  let tierColor = 'text-cyan-400 border-cyan-500/30 bg-cyan-950/40';
  let nextReward = 'Next unlock: Custom LO Curation Queue';

  if (earnedXp >= 100) {
    tierName = 'Purchase-Ready Buyer';
    tierBadge = 'Level 4 • VIP';
    tierColor = 'text-amber-300 border-amber-500/50 bg-amber-950/40';
    nextReward = 'Final Step: Pre-approval letter issued & agent tour dispatched!';
  } else if (earnedXp >= 70) {
    tierName = 'Serious Contender';
    tierBadge = 'Level 3';
    tierColor = 'text-indigo-300 border-indigo-500/40 bg-indigo-950/40';
    nextReward = 'Next unlock: Priority Showing Access with Paired Agent';
  } else if (earnedXp >= 35) {
    tierName = 'Financing Strategist';
    tierBadge = 'Level 2';
    tierColor = 'text-emerald-300 border-emerald-500/40 bg-emerald-950/40';
    nextReward = 'Next unlock: Top 3 Side-by-Side Comparison';
  }

  // Trigger celebratory confetti when reaching 100%
  useEffect(() => {
    if (progressPercent === 100) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  }, [progressPercent]);

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
    <div className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-indigo-950/30 border border-slate-800 hover:border-cyan-500/40 rounded-2xl p-4 shadow-xl transition-all">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-cyan-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 shadow-inner">
            <Trophy className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-wide">
                First-Time Homebuyer Readiness Track
              </h3>
              <span className={`text-[10px] px-2 py-0.5 rounded-full border font-mono font-semibold ${tierColor}`}>
                {tierBadge} • {tierName}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {completedCount} of {milestones.length} milestones complete • <span className="text-cyan-300 font-mono font-bold">{earnedXp} XP</span>
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Progress Bar Gauge */}
          <div className="w-32 sm:w-44 bg-slate-950 rounded-full h-2.5 p-0.5 border border-slate-800 overflow-hidden relative">
            <div
              className="bg-gradient-to-r from-cyan-500 via-indigo-500 to-amber-400 h-full rounded-full transition-all duration-500 shadow-sm"
              style={{ width: `${Math.max(progressPercent, 5)}%` }}
            />
          </div>
          <span className="text-xs font-mono font-bold text-cyan-300 min-w-[3rem] text-right">
            {progressPercent}%
          </span>

          <button
            onClick={toggleExpand}
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-all ml-1"
            title={isExpanded ? 'Collapse Quest Track' : 'Expand Quest Track'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded Roadmap / Quest Steps */}
      {isExpanded && (
        <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5 text-slate-300">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span><strong>Next Milestone Advantage:</strong> {nextReward}</span>
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
                          Step {idx + 1}
                        </span>
                      </div>
                      <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                        milestone.completed
                          ? 'bg-emerald-500/10 text-emerald-300'
                          : 'bg-slate-800 text-slate-400'
                      }`}>
                        +{milestone.xp} XP
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
