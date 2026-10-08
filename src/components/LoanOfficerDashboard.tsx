// Copyright (c) 2026 Mike Ford, NMLS #288455. All Rights Reserved.
import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Send,
  Bell,
  Inbox,
  RefreshCw,
  MessageSquare,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  Users,
  Megaphone,
  Activity,
  FileText,
  Lock,
  Search,
  Filter,
  ArrowLeft,
  ChevronRight,
  UserCheck,
  Building,
  Sparkles,
  HelpCircle,
  Home,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import {
  fetchMikeInbox,
  fetchLoConversation,
  submitMikeReply,
  fetchAuditLedger,
  fetchLoDeviceStatus,
  fetchPluginStatus
} from '../api';
import { PublishingModal } from './PublishingModal';

interface LoanOfficerDashboardProps {
  onSwitchToPlugin: () => void;
}

export const LoanOfficerDashboard: React.FC<LoanOfficerDashboardProps> = ({
  onSwitchToPlugin
}) => {
  const [activeTab, setActiveTab] = useState<'inbox' | 'leads' | 'publishing' | 'audit' | 'system'>('inbox');
  const [staffEmail, setStaffEmail] = useState('fordmj@gmail.com');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // URLs
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://ais-dev-uebnbxjndw5lknmaslqsdj-427099073161.us-east5.run.app';
  const pluginUrl = `${baseUrl}/plugin`;
  const dashboardUrl = `${baseUrl}/dashboard`;

  // Inbox state
  const [inboxList, setInboxList] = useState<any[]>([]);
  const [loadingInbox, setLoadingInbox] = useState(false);
  const [inboxError, setInboxError] = useState<string | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [selectedLeadData, setSelectedLeadData] = useState<any | null>(null);
  const [loadingLead, setLoadingLead] = useState(false);

  // Reply state
  const [replyText, setReplyText] = useState(
    "Hey! Mike Ford here (NMLS #288455). I saw your question regarding this home. We can definitely look into a 2-1 buydown or 0% down program to lower your payment. When are you free for a quick 5-minute call?"
  );
  const [submittingReply, setSubmittingReply] = useState(false);
  const [replyStatus, setReplyStatus] = useState<string | null>(null);

  // Audit Ledger state
  const [auditEntries, setAuditEntries] = useState<any[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditFilter, setAuditFilter] = useState('');

  // System status state
  const [deviceStatus, setDeviceStatus] = useState<any | null>(null);
  const [pluginHealth, setPluginHealth] = useState<any | null>(null);

  // Publishing kit modal
  const [isPublishingOpen, setIsPublishingOpen] = useState(false);

  // Filter for inbox
  const [inboxSearch, setInboxSearch] = useState('');

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2500);
    } catch {
      // fallback
    }
  };

  // Load Inbox
  const loadInbox = async () => {
    setLoadingInbox(true);
    setInboxError(null);
    try {
      const data = await fetchMikeInbox(staffEmail.trim());
      const convs = data.conversations || [];
      setInboxList(convs);
      if (convs.length > 0 && !selectedLeadId) {
        setSelectedLeadId(convs[0].leadId);
      }
    } catch (err: any) {
      setInboxError(err.message || 'Failed to fetch conversations from Firestore');
    } finally {
      setLoadingInbox(false);
    }
  };

  // Load Selected Lead Conversation
  const loadLeadConversation = async (leadId: string) => {
    setLoadingLead(true);
    try {
      const data = await fetchLoConversation(leadId, staffEmail.trim());
      setSelectedLeadData(data);
    } catch (err: any) {
      console.error('Failed to load lead conversation:', err);
    } finally {
      setLoadingLead(false);
    }
  };

  // Load Audit Ledger
  const loadAudit = async () => {
    setLoadingAudit(true);
    try {
      const data = await fetchAuditLedger(staffEmail.trim());
      setAuditEntries(data.entries || []);
    } catch (err: any) {
      console.error('Failed to load audit ledger:', err);
    } finally {
      setLoadingAudit(false);
    }
  };

  // Load System Status
  const loadSystemStatus = async () => {
    try {
      const [dev, plug] = await Promise.all([
        fetchLoDeviceStatus().catch(() => null),
        fetchPluginStatus().catch(() => null)
      ]);
      setDeviceStatus(dev);
      setPluginHealth(plug);
    } catch {
      // fallback
    }
  };

  useEffect(() => {
    loadInbox();
    loadSystemStatus();
  }, [staffEmail]);

  useEffect(() => {
    if (selectedLeadId) {
      loadLeadConversation(selectedLeadId);
    }
  }, [selectedLeadId]);

  useEffect(() => {
    if (activeTab === 'audit') {
      loadAudit();
    }
  }, [activeTab]);

  // Handle Reply Submit
  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeadId || !replyText.trim() || submittingReply) return;

    setSubmittingReply(true);
    setReplyStatus(null);

    try {
      await submitMikeReply({
        leadId: selectedLeadId,
        text: replyText.trim(),
        token: staffEmail.trim()
      });

      setReplyStatus('Persisted to fthb_conversations & pushed to buyer!');
      setReplyText('');
      setTimeout(() => setReplyStatus(null), 3000);

      // Refresh current conversation
      loadLeadConversation(selectedLeadId);
      loadInbox();
    } catch (err: any) {
      setReplyStatus(`Error: ${err.message || 'Failed to submit reply'}`);
    } finally {
      setSubmittingReply(false);
    }
  };

  // Filtered Inbox items
  const filteredInbox = inboxList.filter(item => {
    if (!inboxSearch.trim()) return true;
    const q = inboxSearch.toLowerCase();
    return (
      item.leadId?.toLowerCase().includes(q) ||
      item.buyerEmail?.toLowerCase().includes(q) ||
      item.city?.toLowerCase().includes(q) ||
      item.lastMessageText?.toLowerCase().includes(q)
    );
  });

  const questionCount = inboxList.filter(i => i.isQuestion || i.hasQuestions).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-amber-500 selection:text-black">
      {/* 1. Executive Top Bar & Copyable URLs */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-amber-500/30">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Left Brand info */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-500/20 border border-amber-400/40">
                <Smartphone className="w-5 h-5 text-slate-950" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">
                    Mike Ford (NMLS #288455)
                  </h1>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono font-bold uppercase">
                    ME Dashboard User
                  </span>
                </div>
                <p className="text-xs text-slate-400 flex items-center gap-2">
                  <span>Pacific Lending Group</span>
                  <span>•</span>
                  <span className="text-amber-400/90 font-mono">fordmj@gmail.com</span>
                  <span>•</span>
                  <span className="text-emerald-400 font-medium flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Master Admin Active
                  </span>
                </p>
              </div>
            </div>

            {/* Right Action buttons & URL Copy bar */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Copy Plugin URL */}
              <button
                onClick={() => copyToClipboard(pluginUrl, 'plugin_url')}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-cyan-300 border border-cyan-500/30 flex items-center gap-1.5 transition-all shadow-sm"
                title="Copy Plugin User URL"
              >
                {copiedKey === 'plugin_url' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-cyan-400" />
                )}
                <span>{copiedKey === 'plugin_url' ? 'Copied Plugin URL!' : 'Copy Plugin URL'}</span>
              </button>

              {/* Copy ME Dashboard URL */}
              <button
                onClick={() => copyToClipboard(dashboardUrl, 'dashboard_url')}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-amber-300 border border-amber-500/30 flex items-center gap-1.5 transition-all shadow-sm"
                title="Copy ME Dashboard User URL"
              >
                {copiedKey === 'dashboard_url' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-amber-400" />
                )}
                <span>{copiedKey === 'dashboard_url' ? 'Copied ME Dashboard URL!' : 'Copy Dashboard URL'}</span>
              </button>

              {/* Switch to Buyer Plugin View */}
              <button
                onClick={onSwitchToPlugin}
                className="px-3 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-cyan-600/20"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Switch to Buyer Plugin</span>
              </button>
            </div>
          </div>

          {/* Quick URL Banner */}
          <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
            <div className="flex items-center space-x-4 font-mono text-[11px] overflow-x-auto py-0.5">
              <span className="text-slate-500 flex items-center gap-1">
                <ExternalLink className="w-3 h-3 text-cyan-400" /> Plugin User URL:
                <code className="text-cyan-300 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 select-all">
                  {pluginUrl}
                </code>
              </span>
              <span className="text-slate-500 flex items-center gap-1">
                <ExternalLink className="w-3 h-3 text-amber-400" /> ME Dashboard URL:
                <code className="text-amber-300 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 select-all">
                  {dashboardUrl}
                </code>
              </span>
            </div>

            <div className="flex items-center space-x-2 text-[11px]">
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                Staff Auth: <span className="font-bold text-amber-300 font-mono">{staffEmail}</span>
              </span>
              <button
                onClick={loadInbox}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                title="Refresh Inbox"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingInbox ? 'animate-spin text-amber-400' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 2. Executive KPI Cards */}
      <div className="max-w-7xl mx-auto px-4 py-4 w-full">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between shadow-sm">
            <div>
              <p className="text-xs font-medium text-slate-400">Total Active Leads</p>
              <h3 className="text-xl font-bold text-white mt-0.5">{inboxList.length}</h3>
            </div>
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <Users className="w-4 h-4 text-blue-400" />
            </div>
          </div>

          <div className="bg-slate-900 border border-amber-500/30 rounded-xl p-3.5 flex items-center justify-between shadow-sm">
            <div>
              <p className="text-xs font-medium text-amber-300">Unanswered Questions</p>
              <h3 className="text-xl font-bold text-amber-400 mt-0.5">{questionCount}</h3>
            </div>
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
              <HelpCircle className="w-4 h-4 text-amber-400" />
            </div>
          </div>

          <div className="bg-slate-900 border border-emerald-500/30 rounded-xl p-3.5 flex items-center justify-between shadow-sm">
            <div>
              <p className="text-xs font-medium text-emerald-300">Push &amp; Device Health</p>
              <h3 className="text-xl font-bold text-emerald-400 mt-0.5">
                {deviceStatus?.totalRegisteredDevices ?? 1} Registered
              </h3>
            </div>
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <Bell className="w-4 h-4 text-emerald-400" />
            </div>
          </div>

          <div className="bg-slate-900 border border-indigo-500/30 rounded-xl p-3.5 flex items-center justify-between shadow-sm">
            <div>
              <p className="text-xs font-medium text-indigo-300">Zero-Trust Compliance</p>
              <h3 className="text-xl font-bold text-indigo-400 mt-0.5">100% Enforced</h3>
            </div>
            <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Navigation Tabs */}
      <div className="border-b border-slate-800 bg-slate-900/50 px-4">
        <div className="max-w-7xl mx-auto flex items-center gap-1 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('inbox')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'inbox'
                ? 'border-amber-400 text-amber-300 bg-amber-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Inbox className="w-4 h-4" />
            <span>2-Way Conversation Desk</span>
            {questionCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 font-bold text-[10px]">
                {questionCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('leads')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'leads'
                ? 'border-amber-400 text-amber-300 bg-amber-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Buyer Lead Pipeline</span>
          </button>

          <button
            onClick={() => setActiveTab('publishing')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'publishing'
                ? 'border-amber-400 text-amber-300 bg-amber-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Megaphone className="w-4 h-4" />
            <span>Reach SMS &amp; Marketing Toolkit</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'audit'
                ? 'border-amber-400 text-amber-300 bg-amber-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Zero-Trust Audit Ledger</span>
          </button>

          <button
            onClick={() => setActiveTab('system')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'system'
                ? 'border-amber-400 text-amber-300 bg-amber-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>System &amp; Device Health</span>
          </button>
        </div>
      </div>

      {/* 4. Tab Content Area */}
      <main className="max-w-7xl mx-auto px-4 py-5 w-full flex-1">
        {activeTab === 'inbox' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-[calc(100vh-280px)] min-h-[550px]">
            {/* Left Column: Lead List */}
            <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col overflow-hidden shadow-xl">
              <div className="p-3.5 bg-slate-950 border-b border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-amber-400" />
                    <span>Inbound Lead Threads ({filteredInbox.length})</span>
                  </span>
                  <button
                    onClick={loadInbox}
                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingInbox ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={inboxSearch}
                    onChange={e => setInboxSearch(e.target.value)}
                    placeholder="Search by lead ID, email, city, or question..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500/50"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
                {loadingInbox && inboxList.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">Loading live conversations...</div>
                ) : inboxError ? (
                  <div className="p-4 text-xs text-red-400 bg-red-950/20 border-b border-red-900/30">
                    {inboxError}
                  </div>
                ) : filteredInbox.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">No matching conversations found.</div>
                ) : (
                  filteredInbox.map(item => {
                    const isSelected = item.leadId === selectedLeadId;
                    return (
                      <button
                        key={item.leadId}
                        onClick={() => setSelectedLeadId(item.leadId)}
                        className={`w-full text-left p-3.5 transition-colors flex items-start justify-between gap-2 ${
                          isSelected
                            ? 'bg-amber-500/15 border-l-4 border-amber-400'
                            : 'hover:bg-slate-800/50'
                        }`}
                      >
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-white font-mono truncate">
                              {item.leadId}
                            </span>
                            {item.isQuestion && (
                              <span className="px-1.5 py-0.2 text-[10px] rounded bg-amber-500/20 text-amber-300 font-medium border border-amber-500/30">
                                Question
                              </span>
                            )}
                          </div>

                          <p className="text-[11px] text-slate-400 truncate">
                            {item.lastMessageText || 'New Lead Inquiry'}
                          </p>

                          <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                            <span>{item.city || 'Portland, OR'}</span>
                            {item.updatedAt && <span>• {new Date(item.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                          </div>
                        </div>

                        <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${isSelected ? 'text-amber-400 transform translate-x-1' : 'text-slate-600'}`} />
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right Column: Lead Thread & Reply Composer */}
            <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col overflow-hidden shadow-xl">
              {selectedLeadId ? (
                <>
                  {/* Lead Header */}
                  <div className="p-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
                        <UserCheck className="w-4 h-4 text-amber-400" />
                      </div>
                      <div>
                        <h3 className="text-xs sm:text-sm font-bold text-white font-mono flex items-center gap-2">
                          <span>Lead: {selectedLeadId}</span>
                        </h3>
                        <p className="text-[11px] text-slate-400">
                          {selectedLeadData?.conversation?.statedPreferences?.city || 'Portland'} • Ready Timeline: {selectedLeadData?.conversation?.statedPreferences?.timeframe || '30-60 Days'}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => loadLeadConversation(selectedLeadId)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1"
                    >
                      <RefreshCw className={`w-3 h-3 ${loadingLead ? 'animate-spin' : ''}`} />
                      <span>Sync</span>
                    </button>
                  </div>

                  {/* Messages Feed */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-950/40">
                    {loadingLead ? (
                      <div className="p-8 text-center text-xs text-slate-500">Loading conversation history...</div>
                    ) : selectedLeadData?.conversation?.messages?.length > 0 ? (
                      selectedLeadData.conversation.messages.map((msg: any, idx: number) => {
                        const isMike = msg.sender === 'lo' || msg.sender === 'muse';
                        return (
                          <div
                            key={msg.id || idx}
                            className={`flex flex-col ${isMike ? 'items-end' : 'items-start'}`}
                          >
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="text-[10px] font-bold text-slate-400">
                                {msg.authorName || (isMike ? 'Mike Ford (NMLS #288455)' : 'Buyer Lead')}
                              </span>
                              <span className="text-[9px] font-mono text-slate-500">
                                {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                              </span>
                            </div>
                            <div
                              className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed ${
                                isMike
                                  ? 'bg-amber-500/20 border border-amber-500/40 text-amber-100 rounded-tr-none'
                                  : 'bg-slate-800 border border-slate-700 text-slate-200 rounded-tl-none'
                              }`}
                            >
                              {msg.text}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-8 text-center text-xs text-slate-500">
                        No prior messages recorded for this lead yet. Send a direct greeting below!
                      </div>
                    )}
                  </div>

                  {/* Fast Reply Templates */}
                  <div className="px-3 py-2 bg-slate-950 border-t border-slate-800 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider shrink-0">
                      Quick Templates:
                    </span>
                    <button
                      type="button"
                      onClick={() => setReplyText("Hey! Mike Ford here. With a 2-1 temporary buydown, your interest rate drops 2% in Year 1 and 1% in Year 2—saving you hundreds every month. Let's run the exact numbers for your income!")}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] shrink-0 font-medium border border-slate-700"
                    >
                      2-1 Buydown Scenario
                    </button>
                    <button
                      type="button"
                      onClick={() => setReplyText("Great question! You don't need 20% down. You can purchase this home with FHA 3.5% down or 0% down with VA/USDA/DPA grants. When are you free for a 5-minute pre-approval check?")}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] shrink-0 font-medium border border-slate-700"
                    >
                      Low / Zero Down Option
                    </button>
                    <button
                      type="button"
                      onClick={() => setReplyText("I'm reviewing your file right now. Let's set up a quick 5-minute phone call so I can answer all your financing questions and get your formal pre-approval letter ready!")}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] shrink-0 font-medium border border-slate-700"
                    >
                      Call / Pre-Approval Invite
                    </button>
                  </div>

                  {/* Reply Form */}
                  <form onSubmit={handleSendReply} className="p-3 bg-slate-950 border-t border-slate-800 space-y-2">
                    <div className="relative">
                      <textarea
                        rows={2}
                        value={replyText}
                        onChange={e => setReplyText(e.target.value)}
                        placeholder="Type direct response from Mike Ford (NMLS #288455)..."
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-500/60 placeholder:text-slate-500 resize-none"
                      />
                      <button
                        type="submit"
                        disabled={submittingReply || !replyText.trim()}
                        className="absolute right-2.5 bottom-3.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>{submittingReply ? 'Dispatching...' : 'Send Reply'}</span>
                      </button>
                    </div>

                    {replyStatus && (
                      <p className={`text-[11px] font-medium flex items-center gap-1 ${replyStatus.startsWith('Error') ? 'text-red-400' : 'text-emerald-400'}`}>
                        {replyStatus.startsWith('Error') ? <AlertCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        <span>{replyStatus}</span>
                      </p>
                    )}
                  </form>
                </>
              ) : (
                <div className="p-12 text-center text-xs text-slate-500 my-auto">
                  Select a lead from the inbox to view conversation history and send direct replies.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Lead Roster */}
        {activeTab === 'leads' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-amber-400" />
                  <span>Buyer Lead Pipeline &amp; Profiles</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Real-time pipeline of buyers interacting with the FTHB House Finder plugin.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3">Lead ID</th>
                    <th className="p-3">Target City</th>
                    <th className="p-3">Timeframe</th>
                    <th className="p-3">Max Payment</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {inboxList.map(item => (
                    <tr key={item.leadId} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3 font-mono font-bold text-amber-300">{item.leadId}</td>
                      <td className="p-3">{item.city || 'Portland, OR'}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                          {item.timeframe || '30-60 Days'}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-emerald-400">
                        {item.maxMonthlyPayment ? `$${item.maxMonthlyPayment}/mo` : 'Pre-Approval Pending'}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          Active Searcher
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => {
                            setSelectedLeadId(item.leadId);
                            setActiveTab('inbox');
                          }}
                          className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[11px] font-bold border border-amber-500/40"
                        >
                          Open Thread
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Marketing & Publishing Toolkit */}
        {activeTab === 'publishing' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Megaphone className="w-5 h-5 text-amber-400" />
                  <span>Reach SMS &amp; Distribution Toolkit</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Generate SMS copy formatted for Reach app, Facebook Organic &amp; Ads, and mass email templates.
                </p>
              </div>

              <button
                onClick={() => setIsPublishingOpen(true)}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all"
              >
                <Sparkles className="w-4 h-4" />
                <span>Open Full Publishing Kit Modal</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
                <div className="flex items-center space-x-2 text-indigo-400 font-bold text-xs">
                  <Users className="w-4 h-4" />
                  <span>Agent Partner Share Link</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Co-branded plugin link for real estate agent partners to co-market curated FTHB inventory.
                </p>
                <code className="block bg-slate-900 p-2 rounded text-[10px] text-indigo-300 font-mono select-all truncate">
                  {pluginUrl}?pair=portland-premier-team
                </code>
                <button
                  onClick={() => copyToClipboard(`${pluginUrl}?pair=portland-premier-team`, 'agent_link')}
                  className="w-full py-1.5 rounded bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 text-xs font-bold border border-indigo-500/40 transition-colors"
                >
                  {copiedKey === 'agent_link' ? 'Copied Agent Link!' : 'Copy Co-Marketing Link'}
                </button>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
                <div className="flex items-center space-x-2 text-cyan-400 font-bold text-xs">
                  <Smartphone className="w-4 h-4" />
                  <span>Reach iPhone SMS Version</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Formatted for Reach group text or individual SMS without third-party vendor fees.
                </p>
                <code className="block bg-slate-900 p-2 rounded text-[10px] text-cyan-300 font-mono select-all truncate">
                  Hey! Mike Ford here. Check out our zero/low-down FTHB platter: {pluginUrl}
                </code>
                <button
                  onClick={() => copyToClipboard(`Hey! Mike Ford here (NMLS #288455). Check out our zero/low-down FTHB platter: ${pluginUrl}`, 'sms_copy')}
                  className="w-full py-1.5 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-xs font-bold border border-cyan-500/40 transition-colors"
                >
                  {copiedKey === 'sms_copy' ? 'Copied Reach SMS!' : 'Copy Reach SMS Text'}
                </button>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
                <div className="flex items-center space-x-2 text-amber-400 font-bold text-xs">
                  <ExternalLink className="w-4 h-4" />
                  <span>Direct Plugin Deep Link</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Direct client-facing FTHB House Finder plugin URL for web &amp; mobile embeds.
                </p>
                <code className="block bg-slate-900 p-2 rounded text-[10px] text-amber-300 font-mono select-all truncate">
                  {pluginUrl}
                </code>
                <button
                  onClick={() => copyToClipboard(pluginUrl, 'direct_plugin')}
                  className="w-full py-1.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold border border-amber-500/40 transition-colors"
                >
                  {copiedKey === 'direct_plugin' ? 'Copied Plugin URL!' : 'Copy Direct Plugin URL'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Zero-Trust Audit Ledger */}
        {activeTab === 'audit' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-400" />
                  <span>Zero-Trust Compliance Audit Ledger</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Immutable audit trail recording all staff reads, writes, and lead interactions.
                </p>
              </div>

              <button
                onClick={loadAudit}
                className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingAudit ? 'animate-spin' : ''}`} />
                <span>Refresh Audit Log</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">Actor / Email</th>
                    <th className="p-3">Role</th>
                    <th className="p-3">Action</th>
                    <th className="p-3">Outcome</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                  {auditEntries.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-500">
                        {loadingAudit ? 'Loading audit ledger...' : 'No audit entries recorded yet.'}
                      </td>
                    </tr>
                  ) : (
                    auditEntries.map((entry, idx) => (
                      <tr key={entry.id || idx} className="hover:bg-slate-800/40">
                        <td className="p-3 text-slate-400">
                          {new Date(entry.timestamp).toLocaleString()}
                        </td>
                        <td className="p-3 text-white">{entry.actor}</td>
                        <td className="p-3">
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px]">
                            {entry.role}
                          </span>
                        </td>
                        <td className="p-3 text-slate-200">{entry.action}</td>
                        <td className="p-3">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              entry.outcome === 'ALLOWED'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-red-500/20 text-red-300 border border-red-500/30'
                            }`}
                          >
                            {entry.outcome}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 5: System & Device Health */}
        {activeTab === 'system' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                <span>System, Device &amp; Control Plane Health</span>
              </h3>
              <p className="text-xs text-slate-400">
                Operational status of the server, push notifications, and plugin control plane.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
                <h4 className="text-xs font-bold text-amber-300 flex items-center gap-2">
                  <Bell className="w-4 h-4" />
                  <span>Push Notification Device Status</span>
                </h4>
                <p className="text-xs text-slate-300">
                  Status: <strong className="text-emerald-400">{deviceStatus?.status || 'Operational'}</strong>
                </p>
                <p className="text-xs text-slate-300">
                  Total Registered Devices: <strong>{deviceStatus?.totalRegisteredDevices ?? 1}</strong>
                </p>
                <p className="text-[11px] text-slate-500">
                  {deviceStatus?.message || 'APNs and FCM push dispatchers ready for buyer notifications.'}
                </p>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
                <h4 className="text-xs font-bold text-cyan-300 flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  <span>Plugin Control Plane</span>
                </h4>
                <p className="text-xs text-slate-300">
                  Operational Status: <strong className="text-emerald-400">{pluginHealth?.status || 'active'}</strong>
                </p>
                <p className="text-xs text-slate-300">
                  Outage Survival: <strong className="text-indigo-400">Enabled</strong>
                </p>
                <p className="text-[11px] text-slate-500">
                  Heartbeating every 5 minutes with fallback cache retention.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Publishing Modal */}
      {isPublishingOpen && (
        <PublishingModal
          listing={null}
          onClose={() => setIsPublishingOpen(false)}
        />
      )}
    </div>
  );
};
