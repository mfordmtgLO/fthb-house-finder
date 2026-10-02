// Copyright (c) 2026 Mike Ford, NMLS #288455. All Rights Reserved.
import React, { useState } from 'react';
import { X, Bell, ShieldCheck, CheckCircle2, AlertTriangle, Smartphone } from 'lucide-react';
import { subscribeBuyerAlerts } from '../api';

interface PriceDropAlertModalProps {
  leadId: string;
  favorites: string[];
  selectedCity: string;
  onClose: () => void;
}

export const PriceDropAlertModal: React.FC<PriceDropAlertModalProps> = ({
  leadId,
  favorites,
  selectedCity,
  onClose
}) => {
  const [contactValue, setContactValue] = useState('');
  const [enableBrowserPush, setEnableBrowserPush] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      await subscribeBuyerAlerts({
        leadId,
        emailOrPhone: contactValue.trim(),
        criteria: {
          city: selectedCity || undefined,
          favoriteListingIds: favorites
        }
      });
      setSubmitted(true);
    } catch (err) {
      console.error('Alert subscription error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
              <Bell className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Price-Drop &amp; Sweep Alerts</h3>
              <p className="text-[11px] text-slate-400">Direct notifications on your saved criteria</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 text-xs text-slate-300 space-y-4">
          {submitted ? (
            <div className="text-center py-6 space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
              <h4 className="text-base font-bold text-white">Alerts Active!</h4>
              <p className="text-slate-400 text-xs">
                You will be notified immediately when a price reduction, status update, or new matching low-down home is screened in your target area.
              </p>
              <button
                onClick={onClose}
                className="mt-2 px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold"
              >
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1.5">
                <span className="font-semibold text-slate-200 block">Monitored Criteria:</span>
                <p className="text-slate-400">• Area: <strong>{selectedCity || 'All Curated Pacific Northwest'}</strong></p>
                <p className="text-slate-400">• Hearted Favorites Monitored: <strong>{favorites.length} homes</strong></p>
                <p className="text-slate-400">• Upstream Sweep: <strong>GeoSphere RentCast daily sweeps</strong></p>
              </div>

              <div>
                <label className="block text-slate-400 text-[11px] font-medium mb-1">
                  Contact Phone or Email (Optional):
                </label>
                <input
                  type="text"
                  value={contactValue}
                  onChange={(e) => setContactValue(e.target.value)}
                  placeholder="(503) 555-0199 or name@example.com"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="browser-push-check"
                  checked={enableBrowserPush}
                  onChange={(e) => setEnableBrowserPush(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-cyan-600"
                />
                <label htmlFor="browser-push-check" className="text-[11px] text-slate-300">
                  Enable instant in-browser / PWA push notifications
                </label>
              </div>

              <p className="text-[10px] text-slate-500 italic">
                Zero-Trust Guarantee: Your information is never sold or shared with third parties. Used strictly for Mike Ford LO pre-approval updates.
              </p>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5"
              >
                <Bell className="w-3.5 h-3.5" />
                <span>{submitting ? 'Activating...' : 'Activate Price-Drop Alerts'}</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
