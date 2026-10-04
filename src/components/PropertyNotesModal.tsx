// Copyright (c) 2026 Mike Ford, NMLS #288455. All Rights Reserved.
import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Send,
  MessageSquare,
  ShieldCheck,
  User,
  CheckCircle,
  HelpCircle,
  Phone,
  Mail,
  Building2,
  AlertCircle,
  UserCheck,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { CuratedListing, PropertyThread, PropertyNoteMessage } from '../types';
import { fetchPropertyThread, postPropertyNote } from '../api';

interface PropertyNotesModalProps {
  listing: CuratedListing | null;
  leadId: string;
  pairing?: any;
  onClose: () => void;
}

export const PropertyNotesModal: React.FC<PropertyNotesModalProps> = ({
  listing,
  leadId,
  pairing,
  onClose
}) => {
  const [thread, setThread] = useState<PropertyThread | null>(null);
  const [noteText, setNoteText] = useState('');
  const [authorName, setAuthorName] = useState('Buyer');
  const [tcpaAccepted, setTcpaAccepted] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleDismiss = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    onClose();
  };

  useEffect(() => {
    if (!listing || !leadId) return;
    setLoading(true);
    setErrorMessage(null);

    const controller = new AbortController();
    fetchPropertyThread(listing.id, leadId, controller.signal)
      .then(res => {
        if (isMountedRef.current) {
          setThread(res);
        }
      })
      .catch(err => {
        if (err?.name !== 'AbortError' && isMountedRef.current) {
          console.warn('Failed to load thread:', err);
        }
      })
      .finally(() => {
        if (isMountedRef.current) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [listing, leadId]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!listing || !leadId || !noteText.trim() || submitting) return;

    setSubmitting(true);
    setErrorMessage(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await postPropertyNote({
        propertyId: listing.id,
        leadId,
        authorName,
        text: noteText.trim(),
        tcpaAccepted,
        signal: controller.signal
      });

      if (isMountedRef.current) {
        if (res.note) {
          setThread(prev => {
            if (!prev) return null;
            const newMsgs = [res.note];
            if (res.aiReply) newMsgs.push(res.aiReply);
            return {
              ...prev,
              messages: [...prev.messages, ...newMsgs]
            };
          });
        }
        setNoteText('');
        setErrorMessage(null);
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        // Ignored on purposeful dismiss
        return;
      }
      if (isMountedRef.current) {
        console.warn('Note submission error:', err);
        setErrorMessage(err?.friendlyMessage || err?.message || "Couldn't post your note — check your connection and try again.");
      }
    } finally {
      if (isMountedRef.current) {
        setSubmitting(false);
        abortControllerRef.current = null;
      }
    }
  };

  if (!listing) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
      onClick={handleDismiss}
    >
      <div
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white">
                Property Notes &amp; Inquiries
              </h3>
              <p className="text-xs text-slate-400 truncate max-w-xs sm:max-w-md">
                {listing.address}, {listing.city} • ${listing.price?.toLocaleString()}
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            title="Close Notes Modal (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notes Thread Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="text-center py-8 text-xs text-slate-400 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
              <span>Loading conversation history...</span>
            </div>
          ) : thread && thread.messages.length > 0 ? (
            thread.messages.map(msg => (
              <div
                key={msg.id}
                className={`p-3.5 rounded-xl text-xs leading-relaxed ${
                  msg.sender === 'buyer'
                    ? 'bg-slate-800/90 border border-slate-700 ml-6 text-slate-200'
                    : msg.sender === 'muse'
                    ? 'bg-gradient-to-br from-indigo-950/60 to-slate-900 border border-indigo-500/40 mr-4 text-slate-100 shadow-md'
                    : 'bg-amber-950/40 border border-amber-500/40 mr-6 text-amber-100'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5 text-[11px]">
                  <span className="font-bold flex items-center gap-1.5">
                    {msg.sender === 'buyer' ? (
                      <User className="w-3 h-3 text-cyan-400" />
                    ) : msg.sender === 'muse' ? (
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    ) : (
                      <ShieldCheck className="w-3 h-3 text-amber-400" />
                    )}
                    <span>{msg.authorName}</span>
                    {msg.sender === 'muse' && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono">
                        AI Instant Response
                      </span>
                    )}
                  </span>
                  <span className="text-slate-400 text-[10px]">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <p className="whitespace-pre-line">{msg.text}</p>

                {msg.citations && msg.citations.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-indigo-900/40 flex flex-wrap gap-1.5 text-[10px] text-indigo-300/80 font-mono">
                    <span className="text-slate-400">Sources:</span>
                    {msg.citations.map((c, i) => (
                      <span key={i} className="px-1.5 py-0.5 rounded bg-indigo-950 border border-indigo-800/50">
                        {c}
                      </span>
                    ))}
                  </div>
                )}

                {msg.isQuestion && (
                  <div className="mt-2 text-[10px] text-cyan-300 font-mono flex items-center gap-1">
                    <HelpCircle className="w-3 h-3" />
                    <span>Action Item Routed to Mike Ford's iPhone: {msg.actionCategory}</span>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-6 px-4 bg-slate-950/60 rounded-xl border border-dashed border-slate-800">
              <MessageSquare className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-300">No notes on this home yet</p>
              <p className="text-[11px] text-slate-500 max-w-sm mx-auto mt-1">
                Ask a question about financing, seller credits, monthly payments, or request a weekend showing. Questions are auto-routed directly to Mike Ford and our partner agent.
              </p>
            </div>
          )}

          {/* Co-Branded LO + Agent Profile Cards */}
          <div className="mt-6 pt-4 border-t border-slate-800 space-y-3">
            <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              <span>Co-Branded Advisory Team</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Mike Ford LO Profile Card */}
              {thread?.loProfile && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-start gap-3">
                  {thread.loProfile.photoUrl ? (
                    <img
                      src={thread.loProfile.photoUrl}
                      alt={thread.loProfile.name}
                      className="w-12 h-12 rounded-full object-cover border border-cyan-500/40 flex-shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400 font-bold flex-shrink-0">
                      <ShieldCheck className="w-6 h-6 text-cyan-400" />
                    </div>
                  )}
                  <div className="min-w-0 text-xs">
                    <span className="font-bold text-white block">{thread.loProfile.name}</span>
                    <span className="text-[11px] text-cyan-300 font-mono block">NMLS #{thread.loProfile.nmlsId}</span>
                    <span className="text-[11px] text-slate-400 block">{thread.loProfile.company}</span>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
                      <span className="flex items-center gap-0.5">
                        <Phone className="w-2.5 h-2.5 text-cyan-400" />
                        {thread.loProfile.phone}
                      </span>
                      <span className="text-cyan-400/80 truncate">{thread.loProfile.email}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Partner Agent Profile Card (Or Honest Empty State) */}
              {thread?.agentProfile ? (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-start gap-3">
                  {thread.agentProfile.photoUrl ? (
                    <img
                      src={thread.agentProfile.photoUrl}
                      alt={thread.agentProfile.name}
                      className="w-12 h-12 rounded-full object-cover border border-indigo-500/40 flex-shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-indigo-950/80 border border-indigo-500/40 flex items-center justify-center text-indigo-400 font-bold flex-shrink-0">
                      <UserCheck className="w-6 h-6 text-indigo-400" />
                    </div>
                  )}
                  <div className="min-w-0 text-xs">
                    <span className="font-bold text-white block">{thread.agentProfile.name}</span>
                    <span className="text-[11px] text-indigo-300 font-mono block">Lic #{thread.agentProfile.licenseNumber}</span>
                    <span className="text-[11px] text-slate-400 block truncate">{thread.agentProfile.brokerage}</span>
                    <div className="mt-1.5 flex items-center gap-2 text-[10px] text-slate-400">
                      <span className="flex items-center gap-0.5">
                        <Phone className="w-2.5 h-2.5 text-indigo-400" />
                        {thread.agentProfile.phone}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                /* Honest Empty State: ZERO Fabricated Fallbacks */
                <div className="bg-slate-950/60 border border-dashed border-slate-800 rounded-xl p-3 flex items-center gap-3 text-xs text-slate-500">
                  <AlertCircle className="w-5 h-5 text-slate-500 flex-shrink-0" />
                  <div>
                    <span className="font-medium text-slate-400 block">Agent Partnership Pending</span>
                    <span className="text-[11px] text-slate-500">
                      No partner assigned yet for this territory. Mike Ford will coordinate showing access directly.
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Inline Error Banner */}
        {errorMessage && (
          <div className="px-4 py-2.5 bg-rose-950/80 border-t border-b border-rose-800/80 flex items-center justify-between gap-2 text-xs text-rose-200 animate-fadeIn">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => handleSubmit()}
              className="px-2.5 py-1 bg-rose-800 hover:bg-rose-700 text-white rounded-lg text-[11px] font-semibold flex-shrink-0 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Input Form & TCPA Consent */}
        <form onSubmit={handleSubmit} className="p-4 bg-slate-950 border-t border-slate-800 space-y-2.5">
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={authorName}
              onChange={(e) => {
                setAuthorName(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="Your Name (e.g. Alex M.)"
              className="w-40 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
            />
            <span className="text-[11px] text-slate-500">Post note visible to Mike &amp; Partner Agent</span>
          </div>

          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={noteText}
                maxLength={500}
                onChange={(e) => {
                  setNoteText(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="Type your question (e.g. 'Can we negotiate a 2-1 buydown here?')"
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
              <button
                type="submit"
                disabled={!noteText.trim() || submitting}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md active:scale-95"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Posting…</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Post Note</span>
                  </>
                )}
              </button>
            </div>
            <div className="flex justify-end pr-1 text-[10px] text-slate-500 font-mono">
              <span className={noteText.length >= 480 ? 'text-amber-400 font-semibold' : ''}>
                {noteText.length}/500
              </span>
            </div>
          </div>

          <div className="flex items-start space-x-2 text-[10px] text-slate-400">
            <input
              type="checkbox"
              id="tcpa-checkbox"
              checked={tcpaAccepted}
              onChange={(e) => setTcpaAccepted(e.target.checked)}
              className="mt-0.5 rounded border-slate-700 bg-slate-900 text-cyan-600"
            />
            <label htmlFor="tcpa-checkbox" className="leading-tight">
              I agree to receive communications regarding this property from Mike Ford (NMLS #288455) and paired agents. Stamped in compliance audit ledger.
            </label>
          </div>
        </form>
      </div>

      {pairing && (
        <div className="shrink-0 p-3 bg-slate-800 border-t border-slate-700/60 flex items-center justify-between text-xs text-slate-300">
          <div className="flex items-center space-x-2">
            <Building2 className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>Your paired agent: <strong className="text-white">{pairing.agent.name}</strong> ({pairing.agent.brokerage})</span>
          </div>
          {pairing.agent.phone && (
            <a href={`tel:${pairing.agent.phone}`} className="text-cyan-400 hover:underline flex items-center space-x-1">
              <Phone className="w-3.5 h-3.5" />
              <span>{pairing.agent.phone}</span>
            </a>
          )}
        </div>
      )}
    </div>
  );
};
