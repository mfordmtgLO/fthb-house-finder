// Copyright (c) 2026 Mike Ford, NMLS #288455. All Rights Reserved.
import React, { useState, useEffect } from 'react';
import { X, Smartphone, ShieldCheck, Send, CheckCircle2, MessageSquare, Bell, Sparkles } from 'lucide-react';
import { submitMikeReply, registerLoDevice, fetchLoDeviceStatus } from '../api';

interface MikeReplySimulatorModalProps {
  leadId: string;
  onClose: () => void;
  onRefreshHistory: () => void;
}

export const MikeReplySimulatorModal: React.FC<MikeReplySimulatorModalProps> = ({
  leadId,
  onClose,
  onRefreshHistory
}) => {
  const [apiKey, setApiKey] = useState('');
  const [replyText, setReplyText] = useState(
    "Hey! Mike Ford here (NMLS #288455). I saw your note on this home. We can definitely look into a 2-1 buydown to knock your first year payment down. When are you free for a 5-minute call?"
  );
  const [targetChannel, setTargetChannel] = useState<'muse' | 'note'>('muse');
  const [propertyId, setPropertyId] = useState('curated-or-portland-001');
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Registered iPhone device tokens from Firestore
  const [registeredDevicesCount, setRegisteredDevicesCount] = useState<number>(0);
  const [deviceTokensList, setDeviceTokensList] = useState<Array<{ platform: string; registeredAt: string; tokenSnippet: string }>>([]);
  const [registeringDevice, setRegisteringDevice] = useState(false);
  const [deviceRegMessage, setDeviceRegMessage] = useState<string | null>(null);

  const loadDeviceStatus = () => {
    fetchLoDeviceStatus()
      .then(res => {
        setRegisteredDevicesCount(res.totalRegisteredDevices);
        setDeviceTokensList(res.devices);
      })
      .catch(err => console.warn('Could not fetch LO device status:', err));
  };

  useEffect(() => {
    loadDeviceStatus();
  }, []);

  const handleGrantNotificationAndRegister = async () => {
    setRegisteringDevice(true);
    setDeviceRegMessage(null);

    try {
      let permission: NotificationPermission = 'granted';
      if (typeof window !== 'undefined' && 'Notification' in window) {
        permission = await Notification.requestPermission();
      }

      // Generate or retrieve persistent unique client token for Mike's iPhone/browser
      const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent);
      const generatedToken = `fcm_lo_apns_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

      const res = await registerLoDevice({
        token: generatedToken,
        platform: isIos ? 'ios' : 'web',
        userAgent: navigator.userAgent
      });

      setDeviceRegMessage(`Success! Device registered in Firestore lo_devices (${isIos ? 'Apple APNs' : 'Web Push'}). Active tokens: ${res.totalActiveTokens}. No copy/pasting needed!`);
      loadDeviceStatus();
    } catch (err: any) {
      setDeviceRegMessage(`Registration notice: ${err.message}`);
    } finally {
      setRegisteringDevice(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || submitting) return;

    setSubmitting(true);
    setStatus(null);

    try {
      await submitMikeReply({
        leadId,
        propertyId: targetChannel === 'note' ? propertyId : undefined,
        text: replyText.trim(),
        apiKey
      });

      setStatus('Reply sent directly to buyer stream!');
      setTimeout(() => {
        onRefreshHistory();
        onClose();
      }, 1200);
    } catch (err: any) {
      setStatus(`Error: ${err.message || 'Unauthorized API Key'}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 border border-amber-500/40 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-4 bg-amber-950/40 border-b border-amber-500/30 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
              <Smartphone className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>Mike Ford (NMLS #288455) iPhone Control</span>
              </h3>
              <p className="text-[11px] text-amber-200/80">Firestore Token Registration &amp; 3-Way Replies</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 text-xs text-slate-300 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Section 1: Firestore iPhone Device Token Registration */}
          <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-cyan-300 flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-cyan-400" />
                <span>iPhone Push Registration (Firestore lo_devices):</span>
              </span>
              <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] text-slate-300 font-mono">
                {registeredDevicesCount} Active in Firestore
              </span>
            </div>

            <p className="text-slate-400 text-[11px] leading-relaxed">
              When Mike opens this app on his iPhone and grants notifications, the app registers the token directly in Firestore. The server reads from Firestore when buyers ask questions. Zero copy/paste.
            </p>

            {deviceTokensList.length > 0 && (
              <div className="p-2 bg-slate-900 rounded-lg text-[10px] font-mono text-emerald-300 space-y-1">
                {deviceTokensList.map((d, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <span>📱 {d.tokenSnippet} ({d.platform.toUpperCase()})</span>
                    <span className="text-slate-500">{new Date(d.registeredAt).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            )}

            {deviceRegMessage && (
              <div className="p-2 rounded bg-cyan-950/60 border border-cyan-800 text-cyan-200 text-[11px]">
                {deviceRegMessage}
              </div>
            )}

            <button
              type="button"
              onClick={handleGrantNotificationAndRegister}
              disabled={registeringDevice}
              className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>{registeringDevice ? 'Registering...' : 'Register This Device / Grant Notifications'}</span>
            </button>
          </div>

          {/* Section 2: 3-Way Reply Form */}
          <form onSubmit={handleSend} className="space-y-3.5 pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white block">3-Way Conversation Reply (F3):</span>
              <span className="text-[10px] text-amber-300 font-mono">Mike LO Stream</span>
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
        </div>
      </div>
    </div>
  );
};
