// Copyright (c) 2026 Mike Ford, NMLS #288455. All Rights Reserved.
import React, { useState } from 'react';
import { X, BadgePercent, ShieldCheck, ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';
import { CuratedListing } from '../types';

interface BuydownExplainerModalProps {
  listing?: CuratedListing | null;
  onClose: () => void;
  onConnectMike: () => void;
}

export const BuydownExplainerModal: React.FC<BuydownExplainerModalProps> = ({
  listing,
  onClose,
  onConnectMike
}) => {
  const basePrice = listing?.price || 400000;
  const [purchasePrice, setPurchasePrice] = useState(basePrice);
  const noteRate = 6.75; // Benchmark standard rate

  // Simplified calculation for monthly P&I
  const loanAmount = purchasePrice * 0.965; // 3.5% down

  const calcMonthly = (rate: number) => {
    const r = (rate / 100) / 12;
    const n = 360;
    return (loanAmount * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  };

  const pmtYear1 = calcMonthly(noteRate - 2.0);
  const pmtYear2 = calcMonthly(noteRate - 1.0);
  const pmtStandard = calcMonthly(noteRate);

  const savingsYear1 = (pmtStandard - pmtYear1) * 12;
  const savingsYear2 = (pmtStandard - pmtYear2) * 12;
  const totalSellerCreditNeeded = Math.round(savingsYear1 + savingsYear2);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-slate-950 via-indigo-950/40 to-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
              <BadgePercent className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-1.5">
                <span>The 2-1 Buydown Advantage</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">
                  Seller-Funded
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Ease into homeownership with dramatic payment discounts
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
          {/* Why this matters for renters */}
          <div className="p-3 bg-cyan-950/40 border border-cyan-500/30 rounded-xl text-cyan-200 leading-relaxed">
            <div className="font-bold flex items-center gap-1.5 mb-1 text-cyan-300">
              <Sparkles className="w-3.5 h-3.5" />
              <span>How It Works (Stop Renting Strategy):</span>
            </div>
            A <strong>2-1 temporary buydown</strong> lowers your interest rate by <strong>2.0% in Year 1</strong> and <strong>1.0% in Year 2</strong>. The discount is funded entirely by a seller credit or builder concession negotiated into your offer—<strong>NOT from your pocket</strong>.
          </div>

          {/* Interactive Calculator Comparison */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-slate-300">
              <span>Home Purchase Price:</span>
              <span className="font-bold text-white font-mono">${purchasePrice.toLocaleString()}</span>
            </div>
            <input
              type="range"
              min="300000"
              max="600000"
              step="10000"
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
          </div>

          {/* Step Down Cards */}
          <div className="grid grid-cols-3 gap-2.5 text-center">
            {/* Year 1 */}
            <div className="p-3 rounded-xl bg-slate-950 border border-emerald-500/40 relative overflow-hidden">
              <span className="text-[10px] uppercase font-bold text-emerald-400 block mb-0.5">Year 1 (-2.0%)</span>
              <div className="text-sm sm:text-base font-black text-white font-mono">
                ${Math.round(pmtYear1).toLocaleString()}
                <span className="text-[10px] text-slate-400 font-normal">/mo</span>
              </div>
              <span className="text-[10px] text-emerald-400 font-semibold block mt-1">
                Save ~${Math.round(pmtStandard - pmtYear1)}/mo
              </span>
            </div>

            {/* Year 2 */}
            <div className="p-3 rounded-xl bg-slate-950 border border-cyan-500/40 relative overflow-hidden">
              <span className="text-[10px] uppercase font-bold text-cyan-400 block mb-0.5">Year 2 (-1.0%)</span>
              <div className="text-sm sm:text-base font-black text-white font-mono">
                ${Math.round(pmtYear2).toLocaleString()}
                <span className="text-[10px] text-slate-400 font-normal">/mo</span>
              </div>
              <span className="text-[10px] text-cyan-400 font-semibold block mt-1">
                Save ~${Math.round(pmtStandard - pmtYear2)}/mo
              </span>
            </div>

            {/* Year 3+ */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 relative overflow-hidden">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Year 3+ (Note)</span>
              <div className="text-sm sm:text-base font-black text-white font-mono">
                ${Math.round(pmtStandard).toLocaleString()}
                <span className="text-[10px] text-slate-400 font-normal">/mo</span>
              </div>
              <span className="text-[10px] text-slate-500 block mt-1">
                Standard Note Rate
              </span>
            </div>
          </div>

          {/* Key Advantages */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <div className="flex items-start gap-2 text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <span><strong>Time to adjust:</strong> 24 months to transition from rent to homeownership expenses with extra breathing room.</span>
            </div>
            <div className="flex items-start gap-2 text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <span><strong>No Refinance Fee Risk:</strong> If market rates drop during the first two years, any remaining escrowed seller buydown funds are applied directly to principal upon refinance.</span>
            </div>
            <div className="flex items-start gap-2 text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <span><strong>Seller Concessions:</strong> Estimated seller concession needed for this scenario: ~${totalSellerCreditNeeded.toLocaleString()} (approx 2%–2.5% of purchase price).</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            Pre-approval &amp; custom scenario structuring: Mike Ford (NMLS #288455)
          </span>
          <button
            onClick={() => {
              onClose();
              onConnectMike();
            }}
            className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md"
          >
            Review Buydown with Mike &rarr;
          </button>
        </div>
      </div>
    </div>
  );
};
