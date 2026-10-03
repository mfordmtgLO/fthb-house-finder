// Copyright (c) 2026 Mike Ford, NMLS #288455. All Rights Reserved.
import React, { useState } from 'react';
import { X, Mail, ShieldCheck, Sparkles, CheckCircle2, ArrowRight } from 'lucide-react';
import { resolveBuyerIdentity } from '../api';

interface IdentifyModalProps {
  currentLeadId: string;
  onClose: () => void;
  onIdentityResolved: (newLeadId: string, email: string) => void;
}

export const IdentifyModal: React.FC<IdentifyModalProps> = ({
  currentLeadId,
  onClose,
  onIdentityResolved
}) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await resolveBuyerIdentity(email.trim(), currentLeadId);
      setSuccessMessage(res.message);
      setTimeout(() => {
        onIdentityResolved(res.leadId, res.email);
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Identity resolution failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-cyan-500/40 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center">
              <Mail className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Sign In / Link Lead Profile</h3>
              <p className="text-[11px] text-slate-400">Passwordless email-link identity resolution</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-300 leading-relaxed">
            Enter your email to link your session across devices and access homes personally curated for you by <strong className="text-white">Mike Ford (NMLS #288455)</strong>.
          </p>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-slate-400 text-[11px] font-medium mb-1">
                Your Email Address:
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="buyer@example.com"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
              />
            </div>

            {error && (
              <div className="p-2.5 rounded-lg text-xs bg-rose-950/60 text-rose-300 border border-rose-800">
                {error}
              </div>
            )}

            {successMessage && (
              <div className="p-2.5 rounded-lg text-xs bg-emerald-950/60 text-emerald-300 border border-emerald-800 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || Boolean(successMessage)}
              className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
            >
              {loading ? (
                <span>Resolving identity...</span>
              ) : (
                <>
                  <span>Link Profile & View Curations</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          <div className="pt-2 border-t border-slate-800 flex items-center gap-2 text-[10px] text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
            <span>Zero-trust secure • Normalized server-side • GLBA Privacy Compliant</span>
          </div>
        </div>
      </div>
    </div>
  );
};
