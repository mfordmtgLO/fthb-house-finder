// Copyright (c) 2026 Mike Ford, NMLS #288455. All Rights Reserved.
import React from 'react';
import { X, Smartphone, Share, PlusSquare, Download, CheckCircle2 } from 'lucide-react';

interface PwaInstallGuideModalProps {
  onClose: () => void;
}

export const PwaInstallGuideModal: React.FC<PwaInstallGuideModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center">
              <Download className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Add to Home Screen (PWA)</h3>
              <p className="text-[11px] text-slate-400">Install FTHB House Finder without an app store</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 text-xs text-slate-300 space-y-4">
          <div className="bg-slate-950/80 rounded-xl p-3.5 border border-slate-800 space-y-2.5">
            <div className="font-bold text-cyan-300 flex items-center gap-1.5">
              <Smartphone className="w-4 h-4" />
              <span>iOS / iPhone Safari Installation:</span>
            </div>
            <ol className="space-y-2 list-decimal list-inside text-slate-300 text-[11px] leading-relaxed">
              <li>
                Tap the <strong>Share</strong> button <Share className="w-3.5 h-3.5 inline text-cyan-400 mx-0.5" /> at the bottom of your Safari screen.
              </li>
              <li>
                Scroll down and select <strong>"Add to Home Screen"</strong> <PlusSquare className="w-3.5 h-3.5 inline text-cyan-400 mx-0.5" />.
              </li>
              <li>
                Tap <strong>"Add"</strong> in the top right corner.
              </li>
            </ol>
          </div>

          <div className="bg-slate-950/80 rounded-xl p-3.5 border border-slate-800 space-y-2.5">
            <div className="font-bold text-emerald-300 flex items-center gap-1.5">
              <Smartphone className="w-4 h-4" />
              <span>Android / Chrome Installation:</span>
            </div>
            <ol className="space-y-2 list-decimal list-inside text-slate-300 text-[11px] leading-relaxed">
              <li>
                Tap the three dots <strong>(⋮)</strong> in Chrome's top right corner.
              </li>
              <li>
                Select <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.
              </li>
              <li>
                Confirm by tapping <strong>"Install"</strong>.
              </li>
            </ol>
          </div>

          <div className="p-3 bg-cyan-950/30 border border-cyan-800/40 rounded-xl flex items-center gap-2 text-cyan-200 text-[11px]">
            <CheckCircle2 className="w-4 h-4 text-cyan-400 flex-shrink-0" />
            <span>Instant launch icon, full-screen standalone view, and push price-drop alerts.</span>
          </div>

          <button
            onClick={onClose}
            className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition-all"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
