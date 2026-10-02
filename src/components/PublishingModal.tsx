// Copyright (c) 2026 Mike Ford, NMLS #288455. All Rights Reserved.
import React, { useState, useEffect } from 'react';
import {
  X,
  Share2,
  Copy,
  Check,
  Smartphone,
  Facebook,
  Mail,
  Users,
  Megaphone,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { CuratedListing, PublishingKit } from '../types';
import { fetchPublishingKit } from '../api';

interface PublishingModalProps {
  listing: CuratedListing | null;
  onClose: () => void;
}

export const PublishingModal: React.FC<PublishingModalProps> = ({
  listing,
  onClose
}) => {
  const [kit, setKit] = useState<PublishingKit | null>(null);
  const [activeTab, setActiveTab] = useState<'audience' | 'facebook' | 'email'>('audience');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchPublishingKit(listing?.id)
      .then(res => setKit(res))
      .catch(err => console.error('Failed to load publishing kit:', err))
      .finally(() => setLoading(false));
  }, [listing]);

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2500);
    } catch {
      // fallback
    }
  };

  const handleNativeShare = async () => {
    if (!kit) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: listing ? `${listing.address} — FTHB House Finder` : 'FTHB House Finder',
          text: kit.audienceVariants.fenceSitterBuyerVersion.headline,
          url: kit.shareUrl
        });
      } catch {
        // ignore share cancellation
      }
    } else {
      copyToClipboard(kit.shareUrl, 'native_url');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-slate-950 via-cyan-950/40 to-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-600/20 border border-cyan-500/40 flex items-center justify-center">
              <Megaphone className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <span>Mike's Publishing &amp; Distribution Toolkit</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono">
                  Reach App / Social / Ads
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                {listing ? `For: ${listing.address} (${listing.city})` : 'General Plugin Distribution'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleNativeShare}
              className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Native Share</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950 px-4">
          <button
            onClick={() => setActiveTab('audience')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'audience'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>iPhone Reach SMS (3 Audiences)</span>
          </button>
          <button
            onClick={() => setActiveTab('facebook')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'facebook'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Facebook className="w-3.5 h-3.5" />
            <span>Facebook Organic &amp; Ads</span>
          </button>
          <button
            onClick={() => setActiveTab('email')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'email'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Mass Email Templates</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {loading || !kit ? (
            <div className="text-center py-12 text-slate-400 text-xs">Generating distribution kit...</div>
          ) : activeTab === 'audience' ? (
            /* 1. iPhone Reach SMS & Multi-Audience Variants */
            <div className="space-y-4">
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 text-xs text-slate-400 flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span>
                  <strong>Mike's iPhone Reach App Law:</strong> Pre-formatted messages for copy-pasting directly into Reach or group text. No automated third-party SMS vendors or Twilio.
                </span>
              </div>

              {/* Variant A: Agent Version */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    <span>Variant (a): Real Estate Agent Partner Version</span>
                  </span>
                  <button
                    onClick={() => copyToClipboard(kit.audienceVariants.agentVersion.reachSmsFormat, 'agent_sms')}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-all"
                  >
                    {copiedKey === 'agent_sms' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-cyan-400" />}
                    <span>{copiedKey === 'agent_sms' ? 'Copied!' : 'Copy for Reach'}</span>
                  </button>
                </div>
                <div className="p-3 bg-slate-900 rounded-lg text-xs text-slate-300 font-mono leading-relaxed whitespace-pre-wrap">
                  {kit.audienceVariants.agentVersion.reachSmsFormat}
                </div>
              </div>

              {/* Variant B: Fence-Sitter Buyer Version */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Variant (b): Fence-Sitter Renter / Buyer Version</span>
                  </span>
                  <button
                    onClick={() => copyToClipboard(kit.audienceVariants.fenceSitterBuyerVersion.reachSmsFormat, 'buyer_sms')}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-all"
                  >
                    {copiedKey === 'buyer_sms' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-cyan-400" />}
                    <span>{copiedKey === 'buyer_sms' ? 'Copied!' : 'Copy for Reach'}</span>
                  </button>
                </div>
                <div className="p-3 bg-slate-900 rounded-lg text-xs text-slate-300 font-mono leading-relaxed whitespace-pre-wrap">
                  {kit.audienceVariants.fenceSitterBuyerVersion.reachSmsFormat}
                </div>
              </div>

              {/* Variant C: Past Client Referral Version */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    <span>Variant (c): Past-Client Referral Version</span>
                  </span>
                  <button
                    onClick={() => copyToClipboard(kit.audienceVariants.pastClientReferralVersion.reachSmsFormat, 'past_client_sms')}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-all"
                  >
                    {copiedKey === 'past_client_sms' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-cyan-400" />}
                    <span>{copiedKey === 'past_client_sms' ? 'Copied!' : 'Copy for Reach'}</span>
                  </button>
                </div>
                <div className="p-3 bg-slate-900 rounded-lg text-xs text-slate-300 font-mono leading-relaxed whitespace-pre-wrap">
                  {kit.audienceVariants.pastClientReferralVersion.reachSmsFormat}
                </div>
              </div>
            </div>
          ) : activeTab === 'facebook' ? (
            /* 2. Facebook Formats & Ad Components */
            <div className="space-y-4">
              {/* Organic Post Copy */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                    <Facebook className="w-3.5 h-3.5" />
                    <span>Organic Facebook Group &amp; Page Post</span>
                  </span>
                  <button
                    onClick={() => copyToClipboard(kit.facebookFormats.organicPost, 'fb_organic')}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-all"
                  >
                    {copiedKey === 'fb_organic' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-cyan-400" />}
                    <span>{copiedKey === 'fb_organic' ? 'Copied!' : 'Copy Post'}</span>
                  </button>
                </div>
                <div className="p-3 bg-slate-900 rounded-lg text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {kit.facebookFormats.organicPost}
                </div>
              </div>

              {/* Facebook Ad Components */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                <span className="text-xs font-bold text-cyan-300 block">
                  Facebook / Instagram Ad Campaign Components
                </span>

                <div>
                  <span className="text-[11px] text-slate-400 font-semibold block">Headline:</span>
                  <div className="p-2 bg-slate-900 rounded text-xs text-slate-200 mt-1 flex justify-between items-center">
                    <span>{kit.facebookFormats.adHeadline}</span>
                    <button
                      onClick={() => copyToClipboard(kit.facebookFormats.adHeadline, 'ad_headline')}
                      className="text-xs text-cyan-400 hover:underline"
                    >
                      Copy
                    </button>
                  </div>
                </div>

                <div>
                  <span className="text-[11px] text-slate-400 font-semibold block">Primary Text:</span>
                  <div className="p-2 bg-slate-900 rounded text-xs text-slate-200 mt-1 flex justify-between items-center">
                    <span>{kit.facebookFormats.adPrimaryText}</span>
                    <button
                      onClick={() => copyToClipboard(kit.facebookFormats.adPrimaryText, 'ad_primary')}
                      className="text-xs text-cyan-400 hover:underline"
                    >
                      Copy
                    </button>
                  </div>
                </div>

                <div>
                  <span className="text-[11px] text-slate-400 font-semibold block">Description:</span>
                  <div className="p-2 bg-slate-900 rounded text-xs text-slate-200 mt-1 flex justify-between items-center">
                    <span>{kit.facebookFormats.adDescription}</span>
                    <button
                      onClick={() => copyToClipboard(kit.facebookFormats.adDescription, 'ad_desc')}
                      className="text-xs text-cyan-400 hover:underline"
                    >
                      Copy
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-cyan-950/40 border border-cyan-800/40 rounded-lg text-xs text-cyan-200">
                  <span className="font-bold block mb-1">Creative Specs for Meta Ads Manager:</span>
                  <p className="text-[11px] text-slate-300">• Feed: {kit.facebookFormats.imageSpecs.square}</p>
                  <p className="text-[11px] text-slate-300">• Reels &amp; Stories: {kit.facebookFormats.imageSpecs.vertical}</p>
                </div>
              </div>
            </div>
          ) : (
            /* 3. Mass Email Templates */
            <div className="space-y-4">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-amber-300">
                    High-Open Subject Lines (A/B Test)
                  </span>
                </div>
                <div className="space-y-1.5">
                  {kit.massEmail.subjectLines.map((subj, idx) => (
                    <div key={idx} className="p-2 bg-slate-900 rounded text-xs text-slate-300 flex justify-between items-center">
                      <span>{subj}</span>
                      <button
                        onClick={() => copyToClipboard(subj, `subj_${idx}`)}
                        className="text-xs text-cyan-400 hover:underline"
                      >
                        Copy
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-cyan-300">Buyer Broadcast Email Body</span>
                  <button
                    onClick={() => copyToClipboard(kit.massEmail.buyerEmailBody, 'email_buyer')}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-all"
                  >
                    {copiedKey === 'email_buyer' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-cyan-400" />}
                    <span>{copiedKey === 'email_buyer' ? 'Copied!' : 'Copy Email'}</span>
                  </button>
                </div>
                <div className="p-3 bg-slate-900 rounded-lg text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {kit.massEmail.buyerEmailBody}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
