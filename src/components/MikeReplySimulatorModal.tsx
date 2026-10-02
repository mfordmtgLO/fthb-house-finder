// Copyright (c) 2026 Mike Ford, NMLS #288455. All Rights Reserved.
import React, { useState, useEffect } from 'react';
import { X, Smartphone, Send, Bell, Inbox, RefreshCw, MessageSquare } from 'lucide-react';
import { submitMikeReply, fetchMikeInbox } from '../api';

interface MikeReplySimulatorModalProps {
  leadId: string;
  onClose: () => void;
  onRefreshHistory: () => void;
}

export const MikeReplySimulatorModal: React.FC<MikeReplySimulatorModalProps> = ({
  leadId: initialLeadId,
  onClose,
  onRefreshHistory
}) => {
  const [activeTab, setActiveTab] = useState<'reply' | 'inbox'>('reply');
  const [selectedLeadId, setSelectedLeadId] = useState(initialLeadId);
  const [apiKey, setApiKey] = useState('');
  const [replyText, setReplyText] = useState(
    "Hey! Mike Ford here (NMLS #288455). I saw your note on this home. We can definitely look into a 2-1 buydown to knock your first year payment down. When are you free for a 5-minute call?"
  );
  const [targetChannel, setTargetChannel] = useState<'muse' | 'note'>('muse');
  const [propertyId, setPropertyId] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Firestore Inbox state
  const [inboxList, setInboxList] = useState<any[]>([]);
  const [loadingInbox, setLoadingInbox] = useState(false);
  const [inboxError, setInboxError] = useState<string | null>(null);

  const loadInbox = async () => {
    if (!apiKey.trim()) {
      setInboxError('Enter MUSE_API_KEY below to load Firestore conversation inbox');
      return;
    }
    setLoadingInbox(true);
    setInboxError(null);
    try {
      const data = await fetchMikeInbox(apiKey.trim());
      setInboxList(data.conversations || []);
    } catch (err: any) {
      setInboxError(err.message || 'Failed to fetch conversations from Firestore');
    } finally {
      setLoadingInbox(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'inbox' && apiKey.trim()) {
      loadInbox();
    }
  }, [activeTab]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || submitting) return;

    setSubmitting(true);
    setStatus(null);

    try {
      await submitMikeReply({
        leadId: selectedLeadId,
        propertyId: targetChannel === 'note' && propertyId ? propertyId : undefined,
        text: replyText.trim(),
        apiKey
      });

      setStatus('Reply persisted to fthb_conversations and dispatched!');
      setTimeout(() => {
        onRefreshHistory();
        if (selectedLeadId === initialLeadId) {
          onClose();
        }
      }, 1200);
    } catch (err: any) {
      setStatus(`Error: ${err.message || 'Unauthorized API Key'}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 border border-amber-500/40 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-amber-950/40 border-b border-amber-500/30 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
              <Smartphone className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>Mike Ford (NMLS #288455) Conversation Desk</span>
              </h3>
              <p className="text-[11px] text-amber-200/80">Firestore fthb_conversations inbox • fordmj@gmail.com</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-800 bg-slate-950/50 px-4 pt-2">
          <button
            onClick={() => setActiveTab('reply')}
            className={`py-2 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all ${
              activeTab === 'reply'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send Direct Reply</span>
          </button>
          <button
            onClick={() => setActiveTab('inbox')}
            className={`py-2 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all ${
              activeTab === 'inbox'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Inbox className="w-3.5 h-3.5" />
            <span>Firestore Inbox</span>
            {inboxList.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 text-[10px]">
                {inboxList.length}
              </span>
            )}
          </button>
        </div>

        {/* Content */}
        <div className="p-5 text-xs text-slate-300 space-y-4 overflow-y-auto flex-1">
          {/* Status Banner */}
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-300 flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-slate-400" />
                <span>APNs Push Notification Status:</span>
              </span>
              <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-[10px] text-amber-300 font-mono">
                Not Yet Wired
              </span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              All messages persist server-side to Firestore <code className="text-amber-300 font-mono">fthb_conversations/&#123;leadId&#125;</code> with PII scrubbing applied.
            </p>
          </div>

          {activeTab === 'inbox' ? (
            /* Firestore Inbox View */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <Inbox className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Buyer Conversations (Firestore fthb_conversations):</span>
                </span>
                <button
                  type="button"
                  onClick={loadInbox}
                  disabled={loadingInbox}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[11px] flex items-center gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${loadingInbox ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>

              {!apiKey && (
                <div className="p-3 bg-slate-950 border border-amber-500/30 rounded-xl space-y-1.5">
                  <label className="block text-slate-300 text-[11px] font-medium">
                    Enter LO Secret Key to Unlock Inbox:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="Paste MUSE_API_KEY from env"
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 font-mono"
                    />
                    <button
                      onClick={loadInbox}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs"
                    >
                      Load
                    </button>
                  </div>
                </div>
              )}

              {inboxError && (
                <div className="p-2.5 rounded-lg text-xs bg-rose-950/50 text-rose-300 border border-rose-800">
                  {inboxError}
                </div>
              )}

              {loadingInbox ? (
                <div className="text-center py-6 text-slate-500">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-400" />
                  Loading conversations from Firestore...
                </div>
              ) : inboxList.length === 0 ? (
                <div className="text-center py-6 bg-slate-950/60 rounded-xl border border-dashed border-slate-800 text-slate-500">
                  No conversation threads in Firestore yet.
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {inboxList.map((conv) => (
                    <div
                      key={conv.leadId}
                      onClick={() => {
                        setSelectedLeadId(conv.leadId);
                        setActiveTab('reply');
                      }}
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${
                        selectedLeadId === conv.leadId
                          ? 'bg-amber-950/30 border-amber-500 text-white'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-[11px] font-bold text-amber-300 truncate max-w-[200px]">
                          {conv.leadId}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {new Date(conv.lastActiveAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <MessageSquare className="w-3 h-3 text-cyan-400" />
                          {conv.messages?.length || 0} messages
                        </span>
                        {conv.statedPreferences?.city && (
                          <span className="text-slate-300 font-medium">
                            {conv.statedPreferences.city}
                          </span>
                        )}
                        {conv.statedPreferences?.maxMonthlyPayment && (
                          <span className="text-cyan-400">
                            ~${conv.statedPreferences.maxMonthlyPayment}/mo
                          </span>
                        )}
                      </div>
                      {conv.messages && conv.messages.length > 0 && (
                        <p className="mt-1.5 text-[10px] text-slate-500 truncate italic">
                          Latest: {conv.messages[conv.messages.length - 1].text}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Reply Form */
            <form onSubmit={handleSend} className="space-y-3.5">
              <div>
                <label className="block text-slate-400 text-[11px] font-medium mb-1">
                  Active Buyer Lead ID (Firestore key):
                </label>
                <input
                  type="text"
                  value={selectedLeadId}
                  onChange={(e) => setSelectedLeadId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-amber-300 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 text-[11px] font-medium mb-1">
                  Select Reply Stream:
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setTargetChannel('muse')}
                    className={`flex-1 py-1.5 px-3 rounded-lg border text-xs font-semibold ${
                      targetChannel === 'muse'
                        ? 'bg-cyan-600/30 border-cyan-500 text-cyan-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    Muse AI Chat Stream
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetChannel('note')}
                    className={`flex-1 py-1.5 px-3 rounded-lg border text-xs font-semibold ${
                      targetChannel === 'note'
                        ? 'bg-amber-600/30 border-amber-500 text-amber-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    Property Notes Thread
                  </button>
                </div>
              </div>

              {targetChannel === 'note' && (
                <div>
                  <label className="block text-slate-400 text-[11px] font-medium mb-1">
                    Target Property ID:
                  </label>
                  <input
                    type="text"
                    value={propertyId}
                    onChange={(e) => setPropertyId(e.target.value)}
                    placeholder="e.g. curated-or-portland-001"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              )}

              <div>
                <label className="block text-slate-400 text-[11px] font-medium mb-1">
                  Mike's LO Reply Message:
                </label>
                <textarea
                  rows={3}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 text-[11px] font-medium mb-1">
                  LO Secret Key (from env):
                </label>
                <input
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Paste MUSE_API_KEY from env"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-300 font-mono"
                />
              </div>

              {status && (
                <div className={`p-2.5 rounded-lg text-xs font-medium ${
                  status.includes('Error') ? 'bg-rose-950/50 text-rose-300 border border-rose-800' : 'bg-emerald-950/50 text-emerald-300 border border-emerald-800'
                }`}>
                  {status}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{submitting ? 'Transmitting...' : 'Dispatch Reply as Mike Ford'}</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
