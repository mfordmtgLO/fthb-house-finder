// Copyright (c) 2026 Mike Ford, NMLS #288455. All Rights Reserved.
import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Send,
  User,
  Shield,
  PhoneCall,
  Calendar,
  Layers,
  ChevronRight,
  Info,
  Sliders,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';
import { ChatMessage, CuratedListing } from '../types';
import { sendMuseChatMessage, fetchMuseChatHistory } from '../api';

interface MuseSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  leadId: string;
  onSelectListing: (listing: CuratedListing) => void;
  onOpenBuydown: () => void;
  onOpenMikeSchedule: () => void;
}

const INCOME_BRACKETS = [
  { id: 'under_60k', label: 'Under $60k' },
  { id: '60k_to_85k', label: '$60k – $85k' },
  { id: '85k_to_115k', label: '$85k – $115k' },
  { id: '115k_to_150k', label: '$115k – $150k' },
  { id: 'over_150k', label: '$150k+' }
];

export const MuseSidebar: React.FC<MuseSidebarProps> = ({
  isOpen,
  onClose,
  leadId,
  onSelectListing,
  onOpenBuydown,
  onOpenMikeSchedule
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [incomeSliderIndex, setIncomeSliderIndex] = useState(1); // default $60k-$85k
  const [showIntakeForm, setShowIntakeForm] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load chat history for persistent buyer memory
  useEffect(() => {
    if (!leadId) return;
    fetchMuseChatHistory(leadId)
      .then(res => {
        if (res.messages && res.messages.length > 0) {
          setMessages(res.messages);
        }
      })
      .catch(err => {
        console.warn('Could not load chat history:', err);
      });
  }, [leadId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (customText?: string) => {
    const textToSend = (customText || inputMessage).trim();
    if (!textToSend || loading) return;

    setInputMessage('');
    setLoading(true);

    // Optimistic user message
    const tempUserMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      sender: 'buyer',
      text: textToSend,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      const reply = await sendMuseChatMessage(leadId, textToSend);
      setMessages(prev => [...prev.filter(m => m.id !== tempUserMsg.id), tempUserMsg, reply]);
    } catch (err) {
      console.error('Chat error:', err);
      const errMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: 'muse',
        text: "I couldn't reach the server right now. Let's check in with Mike directly for questions about your scenario!",
        timestamp: new Date().toISOString(),
        isEscalation: true
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleIncomeBracketSubmit = () => {
    const bracket = INCOME_BRACKETS[incomeSliderIndex];
    handleSend(`My household income bracket is ${bracket.label}. What programs likely fit?`);
    setShowIntakeForm(false);
  };

  if (!isOpen) return null;

  return (
    <aside className="fixed inset-y-0 left-0 z-50 w-full sm:w-96 md:w-[420px] bg-slate-900 border-r border-slate-800 shadow-2xl flex flex-col pt-16 sm:pt-0">
      {/* Sidebar Header */}
      <div className="p-3.5 bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <h2 className="text-sm font-bold text-white">Muse AI Assistant</h2>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-mono">
                3-Way Capable
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Coached by Mike Ford (NMLS #288455)
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 text-xs"
        >
          ✕
        </button>
      </div>

      {/* Renter Intake Quick-Action Helper Banner */}
      <div className="bg-slate-950 px-3.5 py-2 border-b border-slate-800/80 flex items-center justify-between text-xs">
        <span className="text-slate-400 flex items-center gap-1.5">
          <Sliders className="w-3.5 h-3.5 text-cyan-400" />
          <span>Renter Qualification Helpers:</span>
        </span>
        <button
          onClick={() => setShowIntakeForm(!showIntakeForm)}
          className="text-xs text-cyan-400 hover:text-cyan-300 font-medium underline"
        >
          {showIntakeForm ? 'Hide Helpers' : 'Income Slider'}
        </button>
      </div>

      {/* Income Bracket Slider (Non-Negotiable: Never exact income storage!) */}
      {showIntakeForm && (
        <div className="bg-slate-950/90 border-b border-cyan-900/30 p-3.5 text-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-semibold text-slate-200">Annual Household Income Bracket:</span>
            <span className="font-mono text-cyan-300 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
              {INCOME_BRACKETS[incomeSliderIndex].label}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max={INCOME_BRACKETS.length - 1}
            value={incomeSliderIndex}
            onChange={(e) => setIncomeSliderIndex(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
          <div className="flex justify-between text-[10px] text-slate-500 mt-1">
            <span>&lt;$60k</span>
            <span>$150k+</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-2 mb-2 italic">
            Zero-Trust Rule: Income is strictly evaluated by bracket to protect privacy.
          </p>
          <button
            onClick={handleIncomeBracketSubmit}
            className="w-full py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium text-xs shadow-sm transition-all"
          >
            Apply Bracket to Platter
          </button>
        </div>
      )}

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${
              msg.sender === 'buyer'
                ? 'items-end'
                : 'items-start'
            }`}
          >
            {/* Sender Label */}
            <div className="flex items-center space-x-1.5 mb-1 text-[11px] text-slate-400">
              {msg.sender === 'buyer' && (
                <>
                  <span>You (Buyer)</span>
                  <User className="w-3 h-3 text-cyan-400" />
                </>
              )}
              {msg.sender === 'muse' && (
                <>
                  <Sparkles className="w-3 h-3 text-cyan-400" />
                  <span className="text-cyan-300 font-medium">Muse AI (Mike's FTHB Assistant)</span>
                </>
              )}
              {msg.sender === 'mike' && (
                <>
                  <Shield className="w-3 h-3 text-amber-400" />
                  <span className="text-amber-300 font-bold">Mike Ford (NMLS #288455)</span>
                  <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1 py-0.2 rounded font-mono">
                    iPhone Direct Reply
                  </span>
                </>
              )}
              <span className="text-slate-600">•</span>
              <span className="text-[10px]">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            {/* Bubble */}
            <div
              className={`max-w-[92%] rounded-2xl p-3 text-xs leading-relaxed ${
                msg.sender === 'buyer'
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md'
                  : msg.sender === 'mike'
                  ? 'bg-amber-950/40 border border-amber-500/50 text-amber-100 shadow-lg shadow-amber-950/30'
                  : 'bg-slate-800/90 border border-slate-700 text-slate-200 shadow-md'
              }`}
            >
              <div className="whitespace-pre-line">{msg.text}</div>

              {/* Citations */}
              {msg.citations && msg.citations.length > 0 && (
                <div className="mt-2.5 pt-2 border-t border-slate-700/50 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
                  <Info className="w-3 h-3 text-cyan-400 flex-shrink-0" />
                  <span>Grounding:</span>
                  {msg.citations.map((cite, i) => (
                    <span
                      key={i}
                      className="px-1.5 py-0.5 rounded bg-slate-900/60 border border-slate-700 text-slate-300 font-mono"
                    >
                      {cite}
                    </span>
                  ))}
                </div>
              )}

              {/* Escalation Action Button */}
              {msg.isEscalation && (
                <div className="mt-3 p-2.5 bg-cyan-950/40 border border-cyan-500/40 rounded-xl flex items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <PhoneCall className="w-4 h-4 text-cyan-400" />
                    <div>
                      <p className="text-[11px] font-bold text-cyan-200">Let's check in with Mike!</p>
                      <p className="text-[10px] text-slate-400">Get pre-approved & verify real numbers</p>
                    </div>
                  </div>
                  <button
                    onClick={onOpenMikeSchedule}
                    className="px-2.5 py-1 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg text-[11px] flex-shrink-0 transition-all"
                  >
                    Connect
                  </button>
                </div>
              )}

              {/* Platter Recommendations */}
              {msg.platterListings && msg.platterListings.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-slate-700/60 space-y-2">
                  <p className="text-[11px] font-bold text-cyan-300 flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5" />
                    <span>Curated Platter for Your Scenario:</span>
                  </p>
                  {msg.platterListings.map(item => (
                    <div
                      key={item.id}
                      onClick={() => onSelectListing(item)}
                      className="cursor-pointer bg-slate-950/70 hover:bg-slate-900 border border-slate-800 hover:border-cyan-500/50 rounded-xl p-2 flex items-center gap-2.5 transition-all"
                    >
                      <img
                        src={item.photoUrl}
                        alt={item.address}
                        className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-white truncate">
                          ${item.price?.toLocaleString()} • {item.address}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {item.city} • ~${item.estimatedMonthlyPayment?.toLocaleString()}/mo
                        </p>
                        <span className="text-[9px] text-cyan-400 font-mono">
                          {item.programTags[0]}
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-500" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center space-x-2 text-xs text-cyan-400 p-2">
            <Sparkles className="w-4 h-4 animate-spin" />
            <span>Muse is analyzing curated inventory & loan overlays...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Questions */}
      <div className="px-3.5 py-2 bg-slate-950 border-t border-slate-800/80 flex gap-2 overflow-x-auto text-[11px] no-scrollbar">
        <button
          onClick={() => handleSend('How does a 2-1 buydown lower my payment for the first two years?')}
          className="whitespace-nowrap px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 hover:border-cyan-500/40"
        >
          2-1 Buydown Explainer
        </button>
        <button
          onClick={() => handleSend('What are the best zero-down or low-down programs in Oregon and Washington?')}
          className="whitespace-nowrap px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 hover:border-cyan-500/40"
        >
          0% & 3% Down Programs
        </button>
        <button
          onClick={() => handleSend('Can I ask the seller for closing cost credits to minimize my out of pocket cash?')}
          className="whitespace-nowrap px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 hover:border-cyan-500/40"
        >
          Seller Credits
        </button>
      </div>

      {/* Input Box */}
      <div className="p-3 bg-slate-900 border-t border-slate-800">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center space-x-2"
        >
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Ask Muse about stopping renting, payments, or homes..."
            className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
          <button
            type="submit"
            disabled={!inputMessage.trim() || loading}
            className="p-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-xl shadow-md transition-all"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
        <p className="text-[10px] text-slate-500 text-center mt-1.5">
          Confidential. PII scrubbed. Direct 3-way line with Mike Ford, NMLS #288455.
        </p>
      </div>
    </aside>
  );
};
