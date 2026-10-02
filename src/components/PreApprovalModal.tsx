// Copyright (c) 2026 Mike Ford, NMLS #288455. All Rights Reserved.
import React, { useState } from 'react';
import { X, ShieldCheck, Phone, Mail, Calendar, CheckCircle2, UserCheck, Sparkles } from 'lucide-react';
import { CuratedListing } from '../types';

interface PreApprovalModalProps {
  listing?: CuratedListing | null;
  onClose: () => void;
}

export const PreApprovalModal: React.FC<PreApprovalModalProps> = ({ listing, onClose }) => {
  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [preferredTime, setPreferredTime] = useState('Morning (9am - 12pm)');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-slate-950 via-cyan-950/40 to-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center">
              <UserCheck className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Pre-Approval &amp; Numbers Review</h3>
              <p className="text-[11px] text-slate-400">Direct consultation with Mike Ford, NMLS #288455</p>
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
              <h4 className="text-base font-bold text-white">Request Received!</h4>
              <p className="text-slate-400 text-xs">
                Mike Ford will reach out at your requested time to run your personalized numbers and determine low/no-down payment program eligibility with zero obligation.
              </p>
              <button
                onClick={onClose}
                className="mt-2 px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold"
              >
                Close
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3.5">
              {listing && (
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 block uppercase font-mono">Referenced Home</span>
                  <span className="font-bold text-white block">{listing.address}, {listing.city}</span>
                  <span className="text-cyan-400 font-mono">${listing.price?.toLocaleString()}</span>
                </div>
              )}

              <div className="p-3 bg-cyan-950/30 border border-cyan-800/40 rounded-xl text-cyan-200 space-y-1">
                <span className="font-bold block flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>The Mike Ford Pre-Approval Standard:</span>
                </span>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Fast, accurate pre-approval letters trusted by Pacific Northwest real estate agents, verified grant matching, and custom 2-1 seller buydown structuring.
                </p>
              </div>

              <div>
                <label className="block text-slate-400 text-[11px] font-medium mb-1">
                  Your Full Name:
                </label>
                <input
                  type="text"
                  required
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 text-[11px] font-medium mb-1">
                  Mobile Phone for Direct Text / Call:
                </label>
                <input
                  type="tel"
                  required
                  value={buyerPhone}
                  onChange={(e) => setBuyerPhone(e.target.value)}
                  placeholder="(503) 555-0123"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 text-[11px] font-medium mb-1">
                  Preferred Time for 10-Minute Numbers Call:
                </label>
                <select
                  value={preferredTime}
                  onChange={(e) => setPreferredTime(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="Morning (9am - 12pm)">Morning (9am - 12pm)</option>
                  <option value="Afternoon (12pm - 4pm)">Afternoon (12pm - 4pm)</option>
                  <option value="Evening (4pm - 7pm)">Evening (4pm - 7pm)</option>
                  <option value="Weekend (Saturday)">Weekend (Saturday)</option>
                </select>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Request Pre-Approval Consultation</span>
                </button>
              </div>

              <div className="text-center pt-1 text-[11px] text-slate-500">
                Or call Mike directly: <a href="tel:5035550199" className="text-cyan-400 font-mono hover:underline">(503) 555-0199</a>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
