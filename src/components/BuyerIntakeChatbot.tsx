// Copyright (c) 2026 Mike Ford, NMLS #288455. All Rights Reserved.
import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { MessageSquare, X, Minus, ChevronRight, Check, ShieldCheck, Sparkles, Send, User, Phone, Mail, ArrowRight } from 'lucide-react';
import { submitIntakeLead } from '../api.ts';
import { MIKE_FORD_LO_PROFILE } from '../types.ts';

interface BuyerIntakeChatbotProps {
  leadId: string;
  pairing?: any | null;
  onIntakeCompleted?: () => void;
}

const OREGON_CITIES = [
  'Portland',
  'Beaverton',
  'Hillsboro',
  'Gresham',
  'Eugene',
  'Springfield',
  'Vancouver',
  'Salem',
  'Bend'
];

export default function BuyerIntakeChatbot({ leadId, pairing, onIntakeCompleted }: BuyerIntakeChatbotProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [showTeaser, setShowTeaser] = useState<boolean>(true);
  const [currentStep, setCurrentStep] = useState<number>(1); // 1 to 7 steps, then contact form (8), then success (9)

  // Intake answers state
  const [timeline, setTimeline] = useState<string>('');
  const [budget, setBudget] = useState<string>('');
  const [downPayment, setDownPayment] = useState<string>('');
  const [creditTier, setCreditTier] = useState<string>('');
  const [annualIncome, setAnnualIncome] = useState<number>(95000);
  const [location, setLocation] = useState<string>('Portland');
  const [sampleHomesWanted, setSampleHomesWanted] = useState<boolean>(true);

  // Contact form state
  const [fullName, setFullName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [smsConsent, setSmsConsent] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Proactive teaser auto-collapse after stillness
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowTeaser(false);
    }, 4500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentStep, isSubmitted]);

  // Prevent background scrolling when chatbot is open in mobile or desktop view
  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;

    const originalBodyOverflow = document.body.style.overflow;
    const originalBodyOverscroll = document.body.style.overscrollBehavior;
    const originalHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.body.style.overscrollBehavior = originalBodyOverscroll;
      document.documentElement.style.overflow = originalHtmlOverflow;
    };
  }, [isOpen]);

  const [loImgError, setLoImgError] = useState(false);
  const [agentImgError, setAgentImgError] = useState(false);

  const loName = pairing?.lo?.name || MIKE_FORD_LO_PROFILE.name;
  const loPhoto = pairing?.lo?.photoUrl || MIKE_FORD_LO_PROFILE.photoUrl;
  const loNmls = pairing?.lo?.nmlsId || MIKE_FORD_LO_PROFILE.nmlsId;
  const agentName = pairing?.agent?.name || '';
  const agentPhoto = pairing?.agent?.photoUrl;
  const agentBrokerage = pairing?.agent?.brokerage || '';
  const isCoBranded = Boolean(pairing && pairing.agent);

  const openingGreeting = isCoBranded
    ? `Hi there! I'm your 24/7 Homebuyer Intake & Prequalification Guide, working alongside ${loName} (NMLS #${loNmls}) and ${agentName} (${agentBrokerage}). No Credit Card or SSN Required — let's calculate your true monthly budget, check Down Payment Assistance (DPA) options, and build your custom Prequalification Blueprint in under 2 minutes.`
    : `Hi there! I'm your 24/7 Homebuyer Intake & Prequalification Guide with Mike Ford (NMLS #${loNmls}). No Credit Card or SSN Required — let's calculate your true monthly budget, check Down Payment Assistance (DPA) options, and build your custom Prequalification Blueprint in under 2 minutes.`;

  const handleStep1 = (val: string) => {
    setTimeline(val);
    setCurrentStep(2);
  };

  const handleStep2 = (val: string) => {
    setBudget(val);
    setCurrentStep(3);
  };

  const handleStep3 = (val: string) => {
    setDownPayment(val);
    setCurrentStep(4);
  };

  const handleStep4 = (val: string) => {
    setCreditTier(val);
    setCurrentStep(5);
  };

  const handleStep5 = () => {
    setCurrentStep(6);
  };

  const handleStep6 = (city: string) => {
    setLocation(city);
    setCurrentStep(7);
  };

  const handleStep7 = (wanted: boolean) => {
    setSampleHomesWanted(wanted);
    setCurrentStep(8); // Move to contact capture
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!fullName.trim()) {
      setValidationError('Please enter your full name.');
      return;
    }
    if (!email || !email.includes('@') || !email.includes('.')) {
      setValidationError('Please enter a valid email address.');
      return;
    }
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setValidationError('Please enter a valid 10-digit US phone number.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        leadId: leadId || `lead-${Date.now()}`,
        name: fullName.trim(),
        email: email.toLowerCase().trim(),
        phone: cleanPhone,
        intakeAnswers: {
          timeline,
          budget,
          downPayment,
          creditTier,
          annualIncome,
          location,
          sampleHomesWanted
        },
        smsConsentAuthorized: smsConsent,
        smsConsentTimestamp: smsConsent ? new Date().toISOString() : undefined,
        pairingId: pairing?.id,
        campaignTag: pairing?.campaignTag || ''
      };

      await submitIntakeLead(payload);

      setIsSubmitting(false);
      setIsSubmitted(true);
      setCurrentStep(9);

      // Trigger celebration confetti
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });

      if (onIntakeCompleted) {
        onIntakeCompleted();
      }
    } catch (err: any) {
      setIsSubmitting(false);
      setValidationError(err.message || 'Submission failed. Please try again.');
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="fixed bottom-6 left-6 z-50 font-sans">
      {/* Proactive Teaser Bubble */}
      {!isOpen && showTeaser && (
        <div className="absolute bottom-16 left-0 mb-2 w-80 bg-slate-900 border border-cyan-500/40 rounded-2xl p-4 shadow-2xl text-white animate-fade-in transition-all">
          <div className="flex items-start justify-between mb-1">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Prequalification Guide</span>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setShowTeaser(false); }}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-sm text-slate-200 mb-3">
            {isCoBranded
              ? `Build your custom prequalification blueprint with ${loName} & ${agentName} in under 2 minutes!`
              : `Build your custom prequalification blueprint with Mike Ford in under 2 minutes!`}
          </p>
          <button
            onClick={() => { setShowTeaser(false); setIsOpen(true); }}
            className="w-full py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center space-x-2 transition-all shadow-lg"
          >
            <span>Start Quick Intake</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Floating Launcher Button */}
      {!isOpen && (
        <button
          onClick={() => { setShowTeaser(false); setIsOpen(true); }}
          className="relative group bg-gradient-to-r from-blue-600 via-cyan-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white p-4 rounded-full shadow-2xl flex items-center justify-center transition-all transform hover:scale-105 border-2 border-white/20"
          aria-label="Open Homebuyer Intake Guide"
        >
          <MessageSquare className="w-6 h-6 text-white" />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-slate-900 rounded-full animate-ping" />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-slate-900 rounded-full" />
        </button>
      )}

      {/* Expanded Chat Window */}
      {isOpen && (
        <div className="w-[92vw] sm:w-[420px] h-[85vh] sm:h-[640px] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up text-white">
          {/* Header */}
          <div className="bg-slate-800/90 border-b border-slate-700/80 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center font-bold text-white shadow-inner">
                {pairing?.agent?.photoUrl ? (
                  <img src={pairing.agent.photoUrl} alt={agentName} className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <Sparkles className="w-5 h-5 text-cyan-200" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold text-white leading-tight">
                  {isCoBranded ? `${loName} & ${agentName}` : `${loName} (NMLS #${loNmls})`}
                </h3>
                <p className="text-xs text-cyan-400 font-medium">
                  {isCoBranded ? agentBrokerage : 'Pacific Lending Group • NMLS #288455'}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700/50 transition-colors"
                title="Minimize"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Chat Body */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-950/60">
            {/* Opening Welcome Message */}
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 rounded-full bg-cyan-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mt-1">
                M
              </div>
              <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-tl-sm p-3.5 text-sm text-slate-100 shadow-md leading-relaxed">
                {openingGreeting}
              </div>
            </div>

            {/* Step 1: Timeline */}
            {currentStep >= 1 && (
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 rounded-full bg-cyan-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mt-1">
                    M
                  </div>
                  <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-tl-sm p-3.5 text-sm text-slate-100 shadow-md">
                    <p className="font-semibold text-cyan-300 mb-1">Step 1 of 7: Timeline</p>
                    When are you hoping to move into your new home?
                  </div>
                </div>
                {currentStep === 1 ? (
                  <div className="grid grid-cols-1 gap-2 pl-11">
                    {[
                      'Ready Now (30-60 Days)',
                      '3 to 6 Months Out',
                      '6 to 12 Months',
                      'Found a Home Already!'
                    ].map((opt) => (
                      <button
                        key={opt}
                        onClick={() => handleStep1(opt)}
                        className="text-left px-4 py-2.5 bg-slate-800 hover:bg-cyan-600/30 border border-slate-700 hover:border-cyan-500 rounded-xl text-xs font-medium text-slate-200 transition-all flex items-center justify-between group"
                      >
                        <span>{opt}</span>
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="pl-11 flex justify-end">
                    <div className="bg-cyan-600/20 border border-cyan-500/40 text-cyan-200 px-3 py-1.5 rounded-xl text-xs font-medium flex items-center space-x-1.5">
                      <Check className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{timeline}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Budget */}
            {currentStep >= 2 && (
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 rounded-full bg-cyan-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mt-1">
                    M
                  </div>
                  <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-tl-sm p-3.5 text-sm text-slate-100 shadow-md">
                    <p className="font-semibold text-cyan-300 mb-1">Step 2 of 7: Budget</p>
                    What price range or comfortable monthly payment are you aiming for?
                  </div>
                </div>
                {currentStep === 2 ? (
                  <div className="grid grid-cols-1 gap-2 pl-11">
                    {[
                      '$300k - $450k (Est. $2,200 - $3,100/mo)',
                      '$450k - $600k (Est. $3,100 - $4,100/mo)',
                      '$600k - $800k (Est. $4,100 - $5,400/mo)',
                      'Keep Under $2,500/mo (Rent Match)'
                    ].map((opt) => (
                      <button
                        key={opt}
                        onClick={() => handleStep2(opt)}
                        className="text-left px-4 py-2.5 bg-slate-800 hover:bg-cyan-600/30 border border-slate-700 hover:border-cyan-500 rounded-xl text-xs font-medium text-slate-200 transition-all flex items-center justify-between group"
                      >
                        <span>{opt}</span>
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="pl-11 flex justify-end">
                    <div className="bg-cyan-600/20 border border-cyan-500/40 text-cyan-200 px-3 py-1.5 rounded-xl text-xs font-medium flex items-center space-x-1.5">
                      <Check className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{budget}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Down Payment */}
            {currentStep >= 3 && (
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 rounded-full bg-cyan-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mt-1">
                    M
                  </div>
                  <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-tl-sm p-3.5 text-sm text-slate-100 shadow-md">
                    <p className="font-semibold text-cyan-300 mb-1">Step 3 of 7: Down Payment</p>
                    How much do you estimate having available for down payment & closing costs?
                  </div>
                </div>
                {currentStep === 3 ? (
                  <div className="grid grid-cols-1 gap-2 pl-11">
                    {[
                      '3% to 5% Down ($12k - $25k) - Conventional / FHA',
                      '10% to 20% Down ($45k+) - Lower PMI',
                      'Seeking Down Payment Assistance (DPA)',
                      '$0 Down (VA / USDA Rural)'
                    ].map((opt) => (
                      <button
                        key={opt}
                        onClick={() => handleStep3(opt)}
                        className="text-left px-4 py-2.5 bg-slate-800 hover:bg-cyan-600/30 border border-slate-700 hover:border-cyan-500 rounded-xl text-xs font-medium text-slate-200 transition-all flex items-center justify-between group"
                      >
                        <span>{opt}</span>
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="pl-11 flex justify-end">
                    <div className="bg-cyan-600/20 border border-cyan-500/40 text-cyan-200 px-3 py-1.5 rounded-xl text-xs font-medium flex items-center space-x-1.5">
                      <Check className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{downPayment}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 4: Credit Tier */}
            {currentStep >= 4 && (
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 rounded-full bg-cyan-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mt-1">
                    M
                  </div>
                  <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-tl-sm p-3.5 text-sm text-slate-100 shadow-md">
                    <p className="font-semibold text-cyan-300 mb-1">Step 4 of 7: Credit Score Tier</p>
                    What is your approximate credit score tier? (No credit card or SSN required)
                  </div>
                </div>
                {currentStep === 4 ? (
                  <div className="grid grid-cols-1 gap-2 pl-11">
                    {[
                      'Excellent (740+) - Best interest rates',
                      'Good (680 - 739) - Strong conventional terms',
                      'Fair (620 - 679) - FHA & DPA eligible',
                      'Rebuilding / Need Advice'
                    ].map((opt) => (
                      <button
                        key={opt}
                        onClick={() => handleStep4(opt)}
                        className="text-left px-4 py-2.5 bg-slate-800 hover:bg-cyan-600/30 border border-slate-700 hover:border-cyan-500 rounded-xl text-xs font-medium text-slate-200 transition-all flex items-center justify-between group"
                      >
                        <span>{opt}</span>
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="pl-11 flex justify-end">
                    <div className="bg-cyan-600/20 border border-cyan-500/40 text-cyan-200 px-3 py-1.5 rounded-xl text-xs font-medium flex items-center space-x-1.5">
                      <Check className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{creditTier}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 5: Annual Income */}
            {currentStep >= 5 && (
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 rounded-full bg-cyan-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mt-1">
                    M
                  </div>
                  <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-tl-sm p-3.5 text-sm text-slate-100 shadow-md">
                    <p className="font-semibold text-cyan-300 mb-1">Step 5 of 7: Household Income</p>
                    What is your approximate gross annual household income before taxes? (Income bands only)
                  </div>
                </div>
                {currentStep === 5 ? (
                  <div className="pl-11 space-y-3 bg-slate-800/80 border border-slate-700 p-4 rounded-2xl">
                    <div className="flex justify-between items-center text-xs font-bold text-cyan-400">
                      <span>Selected Income Bracket:</span>
                      <span className="text-white text-sm bg-slate-900 px-3 py-1 rounded-lg border border-slate-700">{formatCurrency(annualIncome)}/yr</span>
                    </div>
                    <input
                      type="range"
                      min={40000}
                      max={300000}
                      step={5000}
                      value={annualIncome}
                      onChange={(e) => setAnnualIncome(Number(e.target.value))}
                      className="w-full accent-cyan-500 bg-slate-700 h-2 rounded-lg cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>$40k/yr</span>
                      <span>$150k/yr</span>
                      <span>$300k+/yr</span>
                    </div>
                    <button
                      onClick={handleStep5}
                      className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center space-x-2 shadow-md transition-all"
                    >
                      <span>Continue to Location</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="pl-11 flex justify-end">
                    <div className="bg-cyan-600/20 border border-cyan-500/40 text-cyan-200 px-3 py-1.5 rounded-xl text-xs font-medium flex items-center space-x-1.5">
                      <Check className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{formatCurrency(annualIncome)} / year</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 6: Location */}
            {currentStep >= 6 && (
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 rounded-full bg-cyan-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mt-1">
                    M
                  </div>
                  <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-tl-sm p-3.5 text-sm text-slate-100 shadow-md">
                    <p className="font-semibold text-cyan-300 mb-1">Step 6 of 7: Target Area</p>
                    Which cities are you most excited to explore?
                  </div>
                </div>
                {currentStep === 6 ? (
                  <div className="grid grid-cols-2 gap-2 pl-11">
                    {OREGON_CITIES.map((city) => (
                      <button
                        key={city}
                        onClick={() => handleStep6(city)}
                        className="px-3 py-2 bg-slate-800 hover:bg-cyan-600/30 border border-slate-700 hover:border-cyan-500 rounded-xl text-xs font-medium text-slate-200 transition-all text-center"
                      >
                        {city}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="pl-11 flex justify-end">
                    <div className="bg-cyan-600/20 border border-cyan-500/40 text-cyan-200 px-3 py-1.5 rounded-xl text-xs font-medium flex items-center space-x-1.5">
                      <Check className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{location}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 7: Sample Homes Curation Request */}
            {currentStep >= 7 && (
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 rounded-full bg-cyan-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mt-1">
                    M
                  </div>
                  <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-tl-sm p-3.5 text-sm text-slate-100 shadow-md">
                    <p className="font-semibold text-cyan-300 mb-1">Step 7 of 7: Curated Homes</p>
                    Would you like us to send you a few recently available homes for sale in <strong className="text-cyan-300">{location}</strong> or surrounding areas that have potential for low or no down payment financing options?
                  </div>
                </div>
                {currentStep === 7 ? (
                  <div className="flex space-x-2 pl-11">
                    <button
                      onClick={() => handleStep7(true)}
                      className="flex-1 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center space-x-1.5"
                    >
                      <Check className="w-4 h-4" />
                      <span>Yes — Curate Homes for Me</span>
                    </button>
                    <button
                      onClick={() => handleStep7(false)}
                      className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl text-xs font-medium transition-all"
                    >
                      No thanks
                    </button>
                  </div>
                ) : (
                  <div className="pl-11 flex justify-end">
                    <div className="bg-cyan-600/20 border border-cyan-500/40 text-cyan-200 px-3 py-1.5 rounded-xl text-xs font-medium flex items-center space-x-1.5">
                      <Check className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{sampleHomesWanted ? 'Curated homes requested' : 'Blueprint only'}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 8: Contact Capture Form */}
            {currentStep >= 8 && currentStep < 9 && (
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 rounded-full bg-cyan-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mt-1">
                    M
                  </div>
                  <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-tl-sm p-3.5 text-sm text-slate-100 shadow-md space-y-2">
                    <p className="font-semibold text-cyan-300">Final Step: Save Your Blueprint</p>
                    <p className="text-xs text-slate-300">
                      Enter your contact details so {loName} can generate your custom Prequalification Blueprint and sync your favorites.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleContactSubmit} className="pl-11 space-y-3 bg-slate-800/80 border border-slate-700 p-4 rounded-2xl">
                  {validationError && (
                    <div className="bg-rose-500/20 border border-rose-500/40 text-rose-200 p-2.5 rounded-xl text-xs">
                      {validationError}
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Alex Johnson"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                      <input
                        type="email"
                        placeholder="alex@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    {/* Mike's exact required microcopy */}
                    <p className="text-[10px] text-cyan-400 mt-1 leading-snug">
                      Save your curated low/no-down-payment homes — your email keeps your Top 3 favorites and curated list synced across devices.
                    </p>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Cell Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                      <input
                        type="tel"
                        placeholder="(503) 555-0199"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>

                  {/* TCPA SMS Consent Checkbox */}
                  <div className="bg-slate-900/90 border border-slate-700/80 p-3 rounded-xl space-y-2">
                    <label className="flex items-start space-x-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={smsConsent}
                        onChange={(e) => setSmsConsent(e.target.checked)}
                        className="mt-0.5 rounded accent-cyan-500 w-4 h-4 flex-shrink-0 cursor-pointer"
                      />
                      <span className="text-[10px] text-slate-300 leading-relaxed">
                        Yes — I agree to receive text messages about my home search, curated homes, and two-way messages with my loan officer and paired agent, including replies to my property notes. Message & data rates may apply. Reply STOP to opt out at any time. Consent is not a condition of purchase.
                      </span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white rounded-xl text-xs font-bold shadow-lg flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <span>Generating Blueprint...</span>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4 text-emerald-300" />
                        <span>Unlock Custom Prequalification Blueprint</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}

            {/* Step 9: Success Celebration State */}
            {currentStep >= 9 && (
              <div className="bg-slate-800 border border-emerald-500/40 rounded-2xl p-5 text-center space-y-3 animate-fade-in shadow-xl">
                <div className="w-12 h-12 bg-emerald-500/20 border border-emerald-500/50 rounded-full flex items-center justify-center mx-auto text-emerald-400">
                  <Check className="w-6 h-6" />
                </div>
                <h4 className="text-base font-bold text-white">Blueprint Generated Successfully!</h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Thanks {fullName}! {loName} {isCoBranded ? `and ${agentName}` : ''} have received your intake details.
                  {sampleHomesWanted && ` Mike is hand-picking qualifying low/no-down-payment homes in ${location} and will push them straight to your My Curated Homes carousel here in the plugin.`}
                </p>
                <div className="bg-slate-900 border border-slate-700 p-3 rounded-xl text-[11px] text-cyan-300 font-medium">
                  🔒 Encrypted & GLBA Compliant • Zero SSN or Credit Card Required
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-full py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-semibold transition-all"
                >
                  Close & View Curated Homes
                </button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Footer Info */}
          <div className="bg-slate-800/80 border-t border-slate-700/80 px-4 py-2.5 flex items-center justify-between text-[10px] text-slate-400">
            <span>NMLS #288455 • CFPB Reg Z Compliant</span>
            <span className="text-cyan-400 font-medium">No SSN / Credit Card Required</span>
          </div>
        </div>
      )}
    </div>
  );
}
