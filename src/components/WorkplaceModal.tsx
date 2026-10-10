// Copyright (c) 2026 Mike Ford, NMLS #288455. All Rights Reserved.
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Briefcase, MapPin, Check, Car, Sparkles } from 'lucide-react';
import { DEFAULT_WORKPLACE } from '../services/commuteService';

interface WorkplaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentWorkplace: string;
  onSaveWorkplace: (newWorkplace: string) => void;
}

const PRESET_WORKPLACES = [
  {
    name: 'Downtown Portland (Pioneer Courthouse Sq)',
    address: 'Downtown Portland, OR',
    badge: 'Metro Core',
    icon: '🏙️'
  },
  {
    name: 'Nike World Headquarters',
    address: 'One Bowerman Dr, Beaverton, OR',
    badge: 'Beaverton',
    icon: '👟'
  },
  {
    name: 'Intel Ronler Acres Campus',
    address: '2501 NE Century Blvd, Hillsboro, OR',
    badge: 'Silicon Forest',
    icon: '💻'
  },
  {
    name: 'OHSU Marquam Hill Hospital',
    address: '3181 SW Sam Jackson Park Rd, Portland, OR',
    badge: 'Medical Center',
    icon: '🏥'
  },
  {
    name: 'Providence St. Vincent Medical Center',
    address: '9205 SW Barnes Rd, Portland, OR',
    badge: 'Barnes Road',
    icon: '🩺'
  },
  {
    name: 'Vancouver Waterfront / Downtown WA',
    address: 'Downtown Vancouver, WA',
    badge: 'Clark County',
    icon: '🌲'
  }
];

export const WorkplaceModal: React.FC<WorkplaceModalProps> = ({
  isOpen,
  onClose,
  currentWorkplace,
  onSaveWorkplace
}) => {
  const [customAddress, setCustomAddress] = useState(currentWorkplace);
  const [selectedAddress, setSelectedAddress] = useState(currentWorkplace);

  if (!isOpen) return null;

  const handleSelectPreset = (addr: string) => {
    setSelectedAddress(addr);
    setCustomAddress(addr);
  };

  const handleSave = () => {
    const trimmed = (customAddress || selectedAddress).trim();
    if (trimmed) {
      onSaveWorkplace(trimmed);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative overflow-hidden"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Modal Header */}
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Primary Workplace & Commute</h2>
              <p className="text-xs text-slate-400">
                Calculated dynamically via Google Maps Distance Matrix API
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-300 mb-4 leading-relaxed">
            Every curated listing card shows your exact driving commute time and distance to your primary office or job location. Choose a common regional employer below or enter your custom workplace address.
          </p>

          {/* Custom Address Input */}
          <div className="mb-5 space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300">
              Workplace Destination Address
            </label>
            <div className="relative">
              <input
                type="text"
                value={customAddress}
                onChange={(e) => {
                  setCustomAddress(e.target.value);
                  setSelectedAddress(e.target.value);
                }}
                placeholder="e.g., Downtown Portland, OR or 123 Main St, Beaverton"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-500 pr-10"
              />
              <MapPin className="w-4 h-4 text-slate-400 absolute right-3.5 top-3 pointer-events-none" />
            </div>
          </div>

          {/* Quick Employer Presets */}
          <div className="mb-6 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
              <span>Popular Portland Metro Employers</span>
              <span className="text-[10px] text-cyan-400 flex items-center gap-1 font-normal">
                <Sparkles className="w-3 h-3" /> Quick Tap
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
              {PRESET_WORKPLACES.map((preset) => {
                const isSelected = selectedAddress.toLowerCase() === preset.address.toLowerCase();
                return (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => handleSelectPreset(preset.address)}
                    className={`p-2.5 rounded-xl border text-left transition-all flex items-start gap-2 text-xs ${
                      isSelected
                        ? 'bg-cyan-950/60 border-cyan-500/60 text-white shadow-sm shadow-cyan-500/20'
                        : 'bg-slate-950/40 border-slate-800 text-slate-300 hover:bg-slate-800/60 hover:border-slate-700'
                    }`}
                  >
                    <span className="text-base select-none">{preset.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-100 flex items-center justify-between gap-1">
                        <span className="truncate">{preset.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />}
                      </div>
                      <span className="text-[10px] text-slate-400 truncate block mt-0.5">
                        {preset.badge}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => handleSelectPreset(DEFAULT_WORKPLACE)}
              className="text-slate-400 hover:text-slate-200 underline text-xs"
            >
              Reset to Default (Downtown Portland)
            </button>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold flex items-center gap-1.5 shadow-lg shadow-cyan-500/25 transition-all"
              >
                <Car className="w-3.5 h-3.5" />
                <span>Update Commutes</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
