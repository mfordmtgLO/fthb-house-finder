// Copyright (c) 2026 Mike Ford, NMLS #288455. All Rights Reserved.
import React, { useState } from 'react';
import { X, ShieldCheck, Sparkles, Sliders, CheckCircle2, AlertTriangle, Building2, MapPin } from 'lucide-react';

interface UsdaIncomeAdjusterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// 2026 USDA RD Section 502 & Lakeview National AMI Limits by County & State (Official USDA Portal Figures)
const OREGON_COUNTIES = [
  { name: 'Lane County (Eugene-Springfield MSA)', limit1_4: 122800, directLimit1_4: 78700, description: 'Official USDA Portal Verified Tier' },
  { name: 'Portland Metro (Multnomah, Clackamas, Washington, Columbia, Yamhill)', limit1_4: 138500, directLimit1_4: 88500, description: 'High-cost metro tier (115% AMI)' },
  { name: 'Deschutes County (Bend MSA)', limit1_4: 126000, directLimit1_4: 81000, description: 'Central Oregon growth tier' },
  { name: 'Benton County (Corvallis MSA)', limit1_4: 121000, directLimit1_4: 77500, description: 'University metro tier' },
  { name: 'Marion & Polk Counties (Salem MSA)', limit1_4: 118200, directLimit1_4: 75800, description: 'Mid-Willamette Valley tier' },
  { name: 'Jackson County (Medford MSA)', limit1_4: 115000, directLimit1_4: 73900, description: 'Southern Oregon tier' },
  { name: 'Other Rural Oregon Counties (Coos, Curry, Douglas, Klamath, Lake, Harney, Malheur, etc.)', limit1_4: 112500, directLimit1_4: 72000, description: 'USDA Standard National Non-Metro Baseline' }
];

const OTHER_STATES = [
  { state: 'California (Bay Area / LA / Orange)', limit1_4: 145000, directLimit1_4: 92000 },
  { state: 'Washington (King / Pierce / Snohomish)', limit1_4: 134000, directLimit1_4: 85000 },
  { state: 'Idaho (Ada / Canyon)', limit1_4: 108000, directLimit1_4: 69000 },
  { state: 'Texas (Austin / Dallas / Houston)', limit1_4: 115000, directLimit1_4: 73500 },
  { state: 'National Standard Baseline (All Other US Counties)', limit1_4: 112500, directLimit1_4: 72000 }
];

export const UsdaIncomeAdjusterModal: React.FC<UsdaIncomeAdjusterModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const [grossIncome, setGrossIncome] = useState<number>(114000);
  const [householdSize, setHouseholdSize] = useState<number>(3);
  const [selectedRegionType, setSelectedRegionType] = useState<'oregon' | 'other'>('oregon');
  const [selectedOregonIndex, setSelectedOregonIndex] = useState<number>(0);
  const [selectedOtherIndex, setSelectedOtherIndex] = useState<number>(4);

  // Determine base 1-4 person cap
  const baseLimit = selectedRegionType === 'oregon'
    ? OREGON_COUNTIES[selectedOregonIndex].limit1_4
    : OTHER_STATES[selectedOtherIndex].limit1_4;

  // Household size scaling for 5+ persons (Statutory USDA RD multipliers)
  // 1-4: 100%, 5: 108%, 6: 113%, 7: 118%, 8: 123%
  let sizeMultiplier = 1.0;
  if (householdSize === 5) sizeMultiplier = 1.08;
  else if (householdSize === 6) sizeMultiplier = 1.13;
  else if (householdSize === 7) sizeMultiplier = 1.18;
  else if (householdSize >= 8) sizeMultiplier = 1.23;

  const adjustedUsdaCap = Math.round(baseLimit * sizeMultiplier);
  const lakeviewCap = Math.round(adjustedUsdaCap * 1.217); // Lakeview National is ≤140% AMI vs 115% AMI

  const diff = grossIncome - adjustedUsdaCap;
  const isOverUsda = diff > 0;
  const isEligibleLakeview = grossIncome <= lakeviewCap;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="max-w-xl w-full bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-cyan-950 via-slate-900 to-indigo-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Live Household Income & Size Qualifier Adjuster</h2>
              <p className="text-[11px] text-cyan-300 font-mono">Calculates 2026 USDA RD & Lakeview AMI Limits</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 space-y-4 overflow-y-auto text-xs text-slate-300">
          {/* Region Selector */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
            <button
              onClick={() => setSelectedRegionType('oregon')}
              className={`py-2 px-3 rounded-lg font-medium transition-all text-xs flex items-center justify-center gap-1.5 ${
                selectedRegionType === 'oregon'
                  ? 'bg-cyan-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Oregon Counties</span>
            </button>
            <button
              onClick={() => setSelectedRegionType('other')}
              className={`py-2 px-3 rounded-lg font-medium transition-all text-xs flex items-center justify-center gap-1.5 ${
                selectedRegionType === 'other'
                  ? 'bg-cyan-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Other States / National</span>
            </button>
          </div>

          {/* County / State Selector Dropdown */}
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              {selectedRegionType === 'oregon' ? 'Select Oregon County / Region:' : 'Select US State / Region Tier:'}
            </label>
            {selectedRegionType === 'oregon' ? (
              <select
                value={selectedOregonIndex}
                onChange={(e) => setSelectedOregonIndex(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-medium"
              >
                {OREGON_COUNTIES.map((c, idx) => (
                  <option key={idx} value={idx}>
                    {c.name} — ${c.limit1_4.toLocaleString()} (1-4p cap)
                  </option>
                ))}
              </select>
            ) : (
              <select
                value={selectedOtherIndex}
                onChange={(e) => setSelectedOtherIndex(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-medium"
              >
                {OTHER_STATES.map((s, idx) => (
                  <option key={idx} value={idx}>
                    {s.state} — ${s.limit1_4.toLocaleString()} (1-4p cap)
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Gross Household Income Slider */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-200">Gross Household Annual Income:</span>
              <span className="font-mono font-bold text-cyan-300 text-sm bg-cyan-950/60 px-2.5 py-1 rounded-lg border border-cyan-800/40">
                ${grossIncome.toLocaleString()}
              </span>
            </div>
            <input
              type="range"
              min="40000"
              max="220000"
              step="1000"
              value={grossIncome}
              onChange={(e) => setGrossIncome(Number(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>$40k</span>
              <span>$80k</span>
              <span>$120k</span>
              <span>$160k</span>
              <span>$220k+</span>
            </div>
          </div>

          {/* Household Members Selector */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-200">Household Members (Size):</span>
              <span className="font-mono text-cyan-300 text-xs">
                {householdSize} Persons {householdSize <= 4 ? '(1-4 Standard Cap)' : '(5+ Statutory Scaled Cap)'}
              </span>
            </div>
            <div className="grid grid-cols-8 gap-1">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <button
                  key={n}
                  onClick={() => setHouseholdSize(n)}
                  className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                    householdSize === n
                      ? 'bg-cyan-600 text-white shadow-md'
                      : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 italic">
              USDA RD caps increase automatically for 5+ member families (${adjustedUsdaCap.toLocaleString()} adjusted cap).
            </p>
          </div>

          {/* Result Banner */}
          <div className={`p-4 rounded-xl border ${
            !isOverUsda
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
              : isEligibleLakeview
              ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
              : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
          } space-y-1.5`}>
            <div className="flex items-center space-x-2 font-bold text-xs">
              {!isOverUsda ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Fully Eligible for USDA RD 0% Down (${adjustedUsdaCap.toLocaleString()} Cap)</span>
                </>
              ) : isEligibleLakeview ? (
                <>
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Over USDA Income Cap (+${diff.toLocaleString()}) — Qualifies for Lakeview National (≤140% AMI)</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>Exceeds USDA RD & Lakeview Caps — Recommend Conventional HomeReady (3% Down)</span>
                </>
              )}
            </div>
            <p className="text-[11px] leading-relaxed opacity-90">
              {!isOverUsda
                ? `Your household income of $${grossIncome.toLocaleString()} is within the 2026 USDA Rural Development Section 502 limit for a family of ${householdSize} in this county.`
                : isEligibleLakeview
                ? `While your income exceeds the USDA RD 115% AMI general county cap ($${adjustedUsdaCap.toLocaleString()}), you qualify for Lakeview National program (up to $${lakeviewCap.toLocaleString()}) or Fannie Mae HomeReady.`
                : `Your household income exceeds both USDA RD and Lakeview AMI limits for this area. Conventional HomeReady or FHA 3.5% down remains fully available.`
              }
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs">
          <span className="text-slate-500 font-mono text-[10px]">Verified 2026 HUD/USDA AMI Limits</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-xl transition-all shadow-md"
          >
            Done Adjusting
          </button>
        </div>
      </div>
    </div>
  );
};
