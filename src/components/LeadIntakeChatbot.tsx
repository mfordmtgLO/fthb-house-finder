// Copyright (c) 2026 Mike Ford, NMLS #288455. All Rights Reserved.
import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  Bot,
  Sparkles,
  X,
  Minus,
  Maximize2,
  Minimize2,
  ChevronRight,
  Check,
  ShieldCheck,
  Send,
  User,
  Phone,
  Mail,
  Clock,
  MapPin,
  Calendar,
  Download,
  Search,
  AlertTriangle,
  Building,
  CheckCircle2,
  ExternalLink,
  Printer
} from 'lucide-react';
import { submitIntakeLead } from '../api.ts';
import { MIKE_FORD_LO_PROFILE } from '../types.ts';

interface LeadIntakeChatbotProps {
  leadId: string;
  pairing?: any | null;
  isSidebarOpen?: boolean;
  onSaveLead?: (leadData: any) => void;
  onExploreListings?: () => void;
}

const METRO_CITIES = [
  'Portland',
  'Beaverton',
  'Hillsboro',
  'Gresham',
  'Eugene',
  'Springfield',
  'Vancouver',
  'Salem',
  'Bend',
  'Lake Oswego',
  'Tigard',
  'Tualatin',
  'West Linn',
  'Oregon City'
];

const INCOME_PRESETS = [
  { label: '$65k', value: 65000 },
  { label: '$90k', value: 90000 },
  { label: '$125k', value: 125000 },
  { label: '$160k', value: 160000 },
  { label: '$200k+', value: 200000 }
];

export const LeadIntakeChatbot: React.FC<LeadIntakeChatbotProps> = ({
  leadId,
  pairing,
  isSidebarOpen,
  onSaveLead,
  onExploreListings
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [showAttentionBadge, setShowAttentionBadge] = useState(true);
  const [currentStep, setCurrentStep] = useState(1); // 1 to 8, then 9 (blueprint)

  // Intake Answers State
  const [timeline, setTimeline] = useState('');
  const [budget, setBudget] = useState('');
  const [downPayment, setDownPayment] = useState('');
  const [creditTier, setCreditTier] = useState('');
  const [annualIncome, setAnnualIncome] = useState<number>(95000);
  const [incomeInputText, setIncomeInputText] = useState('$95,000/yr');
  const [selectedCities, setSelectedCities] = useState<string[]>(['Portland']);
  const [citySearchTerm, setCitySearchTerm] = useState('');
  const [customCityInput, setCustomCityInput] = useState('');
  const [sampleHomesWanted, setSampleHomesWanted] = useState<boolean | null>(null);

  // Contact Form State
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [preferredContactTime, setPreferredContactTime] = useState('Anytime');
  const [smsConsent, setSmsConsent] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [ssnWarning, setSsnWarning] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [blueprintData, setBlueprintData] = useState<any | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  // Auto scroll within messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentStep, ssnWarning, blueprintData]);

  // Sync formatted income
  const handleIncomeSliderChange = (val: number) => {
    setAnnualIncome(val);
    setIncomeInputText(`$${val.toLocaleString()}/yr`);
  };

  const handleIncomeTextChange = (text: string) => {
    setIncomeInputText(text);
    const numeric = parseInt(text.replace(/\D/g, ''), 10);
    if (!isNaN(numeric) && numeric >= 10000 && numeric <= 1000000) {
      setAnnualIncome(numeric);
    }
  };

  // SSN Detection & Safety Check
  const checkForSsnPattern = (value: string): boolean => {
    // Check for SSN format (3-2-4 digits) or 9 digits in a row
    const ssnRegex = /\b\d{3}[- ]?\d{2}[- ]?\d{4}\b/;
    const nineDigitsRegex = /\b\d{9}\b/;
    if (ssnRegex.test(value) || nineDigitsRegex.test(value)) {
      setSsnWarning(
        'Security Notice: For your safety, we never ask for or accept Social Security Numbers or credit card numbers. Your prequalification blueprint is generated safely without an SSN or hard credit pull.'
      );
      return true;
    }
    setSsnWarning(null);
    return false;
  };

  // Loan Officer & Partner Details
  const loName = pairing?.lo?.name || MIKE_FORD_LO_PROFILE.name;
  const loTitle = pairing?.lo?.title || MIKE_FORD_LO_PROFILE.title;
  const loNmls = pairing?.lo?.nmlsId || MIKE_FORD_LO_PROFILE.nmlsId;
  const loCompany = pairing?.lo?.company || MIKE_FORD_LO_PROFILE.company;
  const loPhoto = pairing?.lo?.photoUrl || MIKE_FORD_LO_PROFILE.photoUrl;
  const agentName = pairing?.agent?.name || '';
  const agentBrokerage = pairing?.agent?.brokerage || '';
  const agentPhoto = pairing?.agent?.photoUrl || '';
  const isCoBranded = Boolean(pairing && pairing.agent);

  const toggleCity = (city: string) => {
    if (selectedCities.includes(city)) {
      if (selectedCities.length > 1) {
        setSelectedCities(selectedCities.filter(c => c !== city));
      }
    } else {
      setSelectedCities([...selectedCities, city]);
    }
  };

  const addCustomCity = () => {
    if (customCityInput.trim() && !selectedCities.includes(customCityInput.trim())) {
      setSelectedCities([...selectedCities, customCityInput.trim()]);
      setCustomCityInput('');
    }
  };

  // Calculate dynamic Prequalification Blueprint
  const generateBlueprint = () => {
    // Estimations based on income & budget
    const monthlyIncome = annualIncome / 12;
    // Conventional max DTI ~45%, FHA ~50%
    const maxMonthlyAffordable = Math.round(monthlyIncome * 0.43);
    const estimatedPurchasingPower = Math.round((maxMonthlyAffordable / 6.5) * 1000);
    const maxApprovedPrice = Math.min(Math.max(estimatedPurchasingPower, 320000), 850000);

    const programs: string[] = [];
    if (downPayment.includes('3% to 5%') || creditTier.includes('Good') || creditTier.includes('Excellent')) {
      programs.push('Conventional 97 (3% Down)');
    }
    if (creditTier.includes('Fair') || downPayment.includes('FHA') || downPayment.includes('3% to 5%')) {
      programs.push('FHA 3.5% Home Loan');
    }
    if (downPayment.includes('$0 Down') || selectedCities.some(c => ['Eugene', 'Springfield', 'Bend', 'Salem'].includes(c))) {
      programs.push('USDA Rural Zero-Down');
    }
    if (downPayment.includes('Assistance') || annualIncome <= 135000) {
      programs.push('Oregon Residential DPA $10,000 Grant');
    }
    if (programs.length === 0) {
      programs.push('FHA 3.5% First-Time Buyer Program', 'Conventional 3% Down');
    }

    const estimatedPI = `$${Math.round(maxApprovedPrice * 0.0058).toLocaleString()} - $${Math.round(maxApprovedPrice * 0.0068).toLocaleString()}/mo`;

    return {
      maxApprovedPrice: `$${maxApprovedPrice.toLocaleString()}`,
      matchedPrograms: programs,
      monthlyPIRange: estimatedPI,
      generatedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    };
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (checkForSsnPattern(fullName) || checkForSsnPattern(email) || checkForSsnPattern(phone)) {
      return;
    }

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
    if (!smsConsent) {
      setValidationError('Please check the TCPA SMS consent box to receive your pre-qualification blueprint.');
      return;
    }

    setIsSubmitting(true);
    try {
      const blueprint = generateBlueprint();
      setBlueprintData(blueprint);

      const leadPayload = {
        leadId: leadId || `lead-${Date.now()}`,
        name: fullName.trim(),
        email: email.toLowerCase().trim(),
        phone: cleanPhone,
        preferredContactTime,
        intakeAnswers: {
          timeline,
          budget,
          downPayment,
          creditTier,
          annualIncome,
          targetCities: selectedCities,
          location: selectedCities[0] || 'Portland',
          sampleHomesWanted: Boolean(sampleHomesWanted)
        },
        smsConsentAuthorized: smsConsent,
        smsConsentTimestamp: new Date().toISOString(),
        pairingId: pairing?.id || null,
        campaignTag: pairing?.campaignTag || '',
        blueprintGenerated: blueprint,
        source: 'ai-lead-intake-prequal'
      };

      await submitIntakeLead(leadPayload);

      if (onSaveLead) {
        onSaveLead(leadPayload);
      }

      setIsSubmitting(false);
      setCurrentStep(9); // Blueprint view

      // Trigger celebration confetti
      confetti({
        particleCount: 130,
        spread: 85,
        origin: { y: 0.6 }
      });
    } catch (err: any) {
      setIsSubmitting(false);
      setValidationError(err.message || 'Error saving blueprint. Please try again.');
    }
  };

  return (
    <>
      {/* 1. Floating Trigger Button: Positioned cleanly with zero overlap over Muse prompt or send button */}
      {!isOpen && (
        <div
          className={`fixed z-40 flex items-center space-x-2.5 font-sans transition-all duration-200 ${
            isSidebarOpen
              ? 'hidden md:flex md:bottom-6 md:right-6'
              : 'bottom-36 md:bottom-22 right-4 sm:right-6'
          }`}
        >
          {showAttentionBadge && (
            <div className="hidden sm:flex items-center space-x-2 bg-slate-900/95 border border-emerald-500/40 text-emerald-300 px-3.5 py-2 rounded-full shadow-2xl backdrop-blur-md animate-fade-in text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>24/7 AI Assistant • Instant Pre-Qual</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAttentionBadge(false);
                }}
                className="text-slate-400 hover:text-white ml-1 p-0.5"
                title="Dismiss"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          <button
            onClick={() => {
              setIsOpen(true);
              setShowAttentionBadge(false);
            }}
            className="group relative bg-gradient-to-r from-[#4A5D4E] to-[#36453A] hover:from-[#586e5d] hover:to-[#435447] text-white p-3.5 sm:p-4 rounded-full shadow-2xl flex items-center justify-center transition-all transform hover:scale-105 border-2 border-emerald-400/30"
            aria-label="Open 24/7 AI Lead Intake & Homebuyer Prequalification Chatbot"
          >
            <div className="relative">
              <Bot className="w-6 h-6 text-white group-hover:rotate-6 transition-transform" />
              <Sparkles className="w-3 h-3 text-emerald-300 absolute -top-1 -right-1 animate-pulse" />
            </div>
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 border-2 border-slate-900 rounded-full animate-ping" />
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 border-2 border-slate-900 rounded-full" />
          </button>
        </div>
      )}

      {/* 2. Responsive Modal / Chat Window with Backdrop & Mobile Touch Shields */}
      {isOpen && (
        <>
          {/* Backdrop shield on mobile & desktop to prevent background touch & scroll pass-through */}
          <div
            className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 transition-opacity animate-fade-in"
            onClick={() => setIsOpen(false)}
            onTouchMove={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            aria-hidden="true"
          />

          <div
            className={`fixed z-50 font-sans transition-all duration-300 ${
              isMaximized
                ? 'inset-2 sm:inset-6'
                : 'inset-x-0 bottom-0 sm:inset-auto sm:bottom-5 sm:right-5 w-full sm:w-[440px] h-[94dvh] sm:h-[680px] max-h-[100dvh]'
            } bg-slate-900 border-t sm:border border-slate-700/80 rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden text-white overscroll-contain`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Sheet Pull Indicator & Touch Shield */}
            <div
              className="sm:hidden flex justify-center items-center pt-2.5 pb-1 bg-gradient-to-r from-slate-900 via-[#27352b] to-slate-900 shrink-0 touch-none select-none cursor-pointer"
              onClick={() => setIsOpen(false)}
              onTouchMove={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              <div className="w-10 h-1 bg-slate-600 rounded-full" />
            </div>

            {/* 2a. Co-Branded Header Bar */}
            <div
              className="bg-gradient-to-r from-slate-900 via-[#27352b] to-slate-900 border-b border-emerald-600/30 px-4 py-3 flex items-center justify-between shrink-0 touch-none select-none"
              onTouchMove={(e) => e.stopPropagation()}
            >
              <div className="flex items-center space-x-3 min-w-0">
                {/* Headshots */}
                <div className="flex -space-x-2 shrink-0">
                  <div className="w-10 h-10 rounded-full border-2 border-emerald-400 bg-slate-800 overflow-hidden flex items-center justify-center shadow-md">
                    {loPhoto ? (
                      <img src={loPhoto} alt={loName} className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-5 h-5 text-emerald-300" />
                    )}
                  </div>
                  {isCoBranded && (
                    <div className="w-10 h-10 rounded-full border-2 border-cyan-400 bg-slate-800 overflow-hidden flex items-center justify-center shadow-md">
                      {agentPhoto ? (
                        <img src={agentPhoto} alt={agentName} className="w-full h-full object-cover" />
                      ) : (
                        <Building className="w-5 h-5 text-cyan-300" />
                      )}
                    </div>
                  )}
                </div>

                {/* Title & Info */}
                <div className="min-w-0">
                  <div className="flex items-center space-x-1.5">
                    <h3 className="text-sm font-bold text-white truncate">
                      {isCoBranded ? `${loName} & ${agentName}` : loName}
                    </h3>
                    <span className="shrink-0 px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded text-[9px] font-semibold">
                      VERIFIED
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 truncate">
                    {isCoBranded
                      ? `${agentBrokerage} • ${loCompany} (NMLS #${loNmls})`
                      : `${loTitle} • ${loCompany} (NMLS #${loNmls})`}
                  </p>
                </div>
              </div>

              {/* Window Controls */}
              <div className="flex items-center space-x-1 text-slate-400">
                <button
                  onClick={() => setIsMaximized(!isMaximized)}
                  className="hidden sm:inline-flex p-1.5 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                  title={isMaximized ? 'Restore' : 'Maximize'}
                >
                  {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 2b. Bank-Grade Security Sub-Badge */}
            <div
              className="bg-[#1c2820] border-b border-emerald-500/20 px-4 py-1.5 flex items-center justify-between text-[11px] text-emerald-300 shrink-0 touch-none select-none"
              onTouchMove={(e) => e.stopPropagation()}
            >
              <span className="flex items-center space-x-1.5 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>🔒 Bank-Grade 256-bit Security • No SSN or Credit Pull Required</span>
              </span>
            </div>

            {/* 3. Conversational Message Flow */}
            <div
              className="flex-1 min-h-0 p-4 overflow-y-auto space-y-4 bg-slate-950/70 text-sm overscroll-contain scroll-smooth"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
            {/* Opening Welcome Bubble */}
            <div className="flex items-start space-x-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#4A5D4E] to-[#36453A] flex items-center justify-center shrink-0 border border-emerald-400/40 text-emerald-200">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-tl-sm p-3.5 text-slate-100 shadow-md leading-relaxed">
                <p className="font-semibold text-emerald-300 mb-1">
                  Welcome! Let's build your 2026 Homebuyer Blueprint.
                </p>
                <p className="text-xs text-slate-300 leading-relaxed">
                  I'm your 24/7 AI Assistant working alongside {loName} (NMLS #{loNmls})
                  {isCoBranded && ` and ${agentName} (${agentBrokerage})`}. Answer a few quick
                  questions to check Down Payment Assistance (DPA) grant options and calculate your
                  purchasing power.
                </p>
              </div>
            </div>

            {/* SSN Interception Warning Banner */}
            {ssnWarning && (
              <div className="p-3 bg-amber-950/80 border border-amber-500/60 rounded-xl text-amber-200 text-xs flex items-start space-x-2 animate-fade-in shadow-lg">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="leading-snug">{ssnWarning}</p>
              </div>
            )}

            {/* STEP 1: TIMELINE */}
            {currentStep >= 1 && (
              <div className="space-y-2.5">
                <div className="flex items-start space-x-2.5">
                  <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center shrink-0 text-emerald-400 text-xs font-bold border border-slate-700">
                    1
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-tl-sm p-3 text-slate-100 shadow-sm text-xs">
                    <span className="font-bold text-emerald-400 block mb-0.5">Timeline</span>
                    When are you hoping to move into your new home?
                  </div>
                </div>

                {currentStep === 1 ? (
                  <div className="grid grid-cols-1 gap-2 pl-10">
                    {[
                      { title: 'Ready Now (30-60 Days)', desc: 'Actively searching' },
                      { title: '3 to 6 Months Out', desc: 'Planning & saving' },
                      { title: '6 to 12 Months', desc: 'Exploring options' },
                      { title: 'Found a Home Already!', desc: 'In escrow / immediate pre-approval needed' }
                    ].map((opt) => (
                      <button
                        key={opt.title}
                        onClick={() => {
                          setTimeline(opt.title);
                          setCurrentStep(2);
                        }}
                        className="text-left px-3.5 py-2.5 bg-slate-900 hover:bg-[#36453A]/50 border border-slate-800 hover:border-emerald-500/60 rounded-xl text-xs transition-all flex items-center justify-between group shadow-sm"
                      >
                        <div>
                          <div className="font-semibold text-slate-100 group-hover:text-emerald-300">
                            {opt.title}
                          </div>
                          <div className="text-[11px] text-slate-400">{opt.desc}</div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition-transform group-hover:translate-x-0.5" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="pl-10 flex justify-end">
                    <div className="bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 px-3 py-1.5 rounded-xl text-xs font-medium flex items-center space-x-1.5 shadow-sm">
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{timeline}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STEP 2: TARGET PRICE & MONTHLY PAYMENT */}
            {currentStep >= 2 && (
              <div className="space-y-2.5">
                <div className="flex items-start space-x-2.5">
                  <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center shrink-0 text-emerald-400 text-xs font-bold border border-slate-700">
                    2
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-tl-sm p-3 text-slate-100 shadow-sm text-xs">
                    <span className="font-bold text-emerald-400 block mb-0.5">Price & Budget</span>
                    What price range or comfortable monthly payment are you aiming for?
                  </div>
                </div>

                {currentStep === 2 ? (
                  <div className="grid grid-cols-1 gap-2 pl-10">
                    {[
                      { title: '$300k - $450k', desc: 'Est. $2,200 - $3,100/mo' },
                      { title: '$450k - $600k', desc: 'Est. $3,100 - $4,100/mo' },
                      { title: '$600k - $800k', desc: 'Est. $4,100 - $5,400/mo' },
                      { title: 'Keep Monthly Payment Under $2,500/mo', desc: 'Based on current rent comfort' }
                    ].map((opt) => (
                      <button
                        key={opt.title}
                        onClick={() => {
                          setBudget(opt.title);
                          setCurrentStep(3);
                        }}
                        className="text-left px-3.5 py-2.5 bg-slate-900 hover:bg-[#36453A]/50 border border-slate-800 hover:border-emerald-500/60 rounded-xl text-xs transition-all flex items-center justify-between group shadow-sm"
                      >
                        <div>
                          <div className="font-semibold text-slate-100 group-hover:text-emerald-300">
                            {opt.title}
                          </div>
                          <div className="text-[11px] text-slate-400">{opt.desc}</div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition-transform group-hover:translate-x-0.5" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="pl-10 flex justify-end">
                    <div className="bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 px-3 py-1.5 rounded-xl text-xs font-medium flex items-center space-x-1.5 shadow-sm">
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{budget}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STEP 3: DOWN PAYMENT & GRANT PREFERENCE */}
            {currentStep >= 3 && (
              <div className="space-y-2.5">
                <div className="flex items-start space-x-2.5">
                  <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center shrink-0 text-emerald-400 text-xs font-bold border border-slate-700">
                    3
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-tl-sm p-3 text-slate-100 shadow-sm text-xs">
                    <span className="font-bold text-emerald-400 block mb-0.5">Down Payment</span>
                    How much do you estimate having available for down payment & closing costs?
                  </div>
                </div>

                {currentStep === 3 ? (
                  <div className="grid grid-cols-1 gap-2 pl-10">
                    {[
                      { title: '3% to 5% Down ($12k - $25k)', desc: 'Conventional 97 / FHA' },
                      { title: '10% to 20%+ Down ($45k+)', desc: 'Lower monthly PMI' },
                      { title: 'Seeking Down Payment Assistance', desc: 'State & local DPA grant programs' },
                      { title: '$0 Down (VA / USDA Rural)', desc: 'Zero down financing options' }
                    ].map((opt) => (
                      <button
                        key={opt.title}
                        onClick={() => {
                          setDownPayment(opt.title);
                          setCurrentStep(4);
                        }}
                        className="text-left px-3.5 py-2.5 bg-slate-900 hover:bg-[#36453A]/50 border border-slate-800 hover:border-emerald-500/60 rounded-xl text-xs transition-all flex items-center justify-between group shadow-sm"
                      >
                        <div>
                          <div className="font-semibold text-slate-100 group-hover:text-emerald-300">
                            {opt.title}
                          </div>
                          <div className="text-[11px] text-slate-400">{opt.desc}</div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition-transform group-hover:translate-x-0.5" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="pl-10 flex justify-end">
                    <div className="bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 px-3 py-1.5 rounded-xl text-xs font-medium flex items-center space-x-1.5 shadow-sm">
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{downPayment}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STEP 4: CREDIT SCORE TIER */}
            {currentStep >= 4 && (
              <div className="space-y-2.5">
                <div className="flex items-start space-x-2.5">
                  <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center shrink-0 text-emerald-400 text-xs font-bold border border-slate-700">
                    4
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-tl-sm p-3 text-slate-100 shadow-sm text-xs">
                    <span className="font-bold text-emerald-400 block mb-0.5">Credit Score Tier</span>
                    What is your approximate credit score tier? (Score bands only — no credit pull)
                  </div>
                </div>

                {currentStep === 4 ? (
                  <div className="grid grid-cols-1 gap-2 pl-10">
                    {[
                      { title: 'Excellent (740+)', desc: 'Best interest rates' },
                      { title: 'Good (680 - 739)', desc: 'Strong conventional terms' },
                      { title: 'Fair (620 - 679)', desc: 'FHA & DPA eligible' },
                      { title: 'Rebuilding / Need Advice', desc: 'Custom improvement plan' }
                    ].map((opt) => (
                      <button
                        key={opt.title}
                        onClick={() => {
                          setCreditTier(opt.title);
                          setCurrentStep(5);
                        }}
                        className="text-left px-3.5 py-2.5 bg-slate-900 hover:bg-[#36453A]/50 border border-slate-800 hover:border-emerald-500/60 rounded-xl text-xs transition-all flex items-center justify-between group shadow-sm"
                      >
                        <div>
                          <div className="font-semibold text-slate-100 group-hover:text-emerald-300">
                            {opt.title}
                          </div>
                          <div className="text-[11px] text-slate-400">{opt.desc}</div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition-transform group-hover:translate-x-0.5" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="pl-10 flex justify-end">
                    <div className="bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 px-3 py-1.5 rounded-xl text-xs font-medium flex items-center space-x-1.5 shadow-sm">
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{creditTier}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STEP 5: GROSS ANNUAL HOUSEHOLD INCOME */}
            {currentStep >= 5 && (
              <div className="space-y-2.5">
                <div className="flex items-start space-x-2.5">
                  <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center shrink-0 text-emerald-400 text-xs font-bold border border-slate-700">
                    5
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-tl-sm p-3 text-slate-100 shadow-sm text-xs">
                    <span className="font-bold text-emerald-400 block mb-0.5">Household Income</span>
                    What is your approximate gross annual household income before taxes?
                  </div>
                </div>

                {currentStep === 5 ? (
                  <div className="pl-10 space-y-3 bg-slate-900/90 border border-slate-800 p-3.5 rounded-2xl">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-300 font-medium">Income Slider:</span>
                      <input
                        type="text"
                        value={incomeInputText}
                        onChange={(e) => handleIncomeTextChange(e.target.value)}
                        className="w-32 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-emerald-300 font-mono text-right focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <input
                      type="range"
                      min={30000}
                      max={500000}
                      step={5000}
                      value={annualIncome}
                      onChange={(e) => handleIncomeSliderChange(Number(e.target.value))}
                      className="w-full accent-emerald-500 bg-slate-800 h-2 rounded-lg cursor-pointer touch-pan-x"
                    />

                    {/* Quick presets */}
                    <div className="flex flex-wrap gap-1.5">
                      {INCOME_PRESETS.map((p) => (
                        <button
                          key={p.label}
                          type="button"
                          onClick={() => handleIncomeSliderChange(p.value)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                            annualIncome === p.value
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => setCurrentStep(6)}
                      className="w-full py-2.5 bg-gradient-to-r from-[#4A5D4E] to-[#36453A] hover:from-[#586e5d] hover:to-[#435447] text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center space-x-1.5"
                    >
                      <span>Continue to Target Cities</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="pl-10 flex justify-end">
                    <div className="bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 px-3 py-1.5 rounded-xl text-xs font-medium flex items-center space-x-1.5 shadow-sm">
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>${annualIncome.toLocaleString()}/yr</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STEP 6: TARGET CITIES & NEIGHBORHOODS */}
            {currentStep >= 6 && (
              <div className="space-y-2.5">
                <div className="flex items-start space-x-2.5">
                  <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center shrink-0 text-emerald-400 text-xs font-bold border border-slate-700">
                    6
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-tl-sm p-3 text-slate-100 shadow-sm text-xs">
                    <span className="font-bold text-emerald-400 block mb-0.5">Target Cities</span>
                    Which cities or neighborhoods are you most excited to explore?
                  </div>
                </div>

                {currentStep === 6 ? (
                  <div className="pl-10 space-y-3 bg-slate-900/90 border border-slate-800 p-3.5 rounded-2xl">
                    {/* Search & Custom input */}
                    <div className="flex gap-1.5">
                      <div className="relative flex-1">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
                        <input
                          type="text"
                          placeholder="Search or add custom city..."
                          value={customCityInput}
                          onChange={(e) => setCustomCityInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addCustomCity();
                            }
                          }}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={addCustomCity}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs rounded-xl font-medium text-slate-200"
                      >
                        Add
                      </button>
                    </div>

                    {/* Regional City Pills with Isolated Touch Scrolling */}
                    <div
                      className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1 overscroll-contain"
                      style={{ WebkitOverflowScrolling: 'touch' }}
                    >
                      {METRO_CITIES.map((city) => {
                        const isSelected = selectedCities.includes(city);
                        return (
                          <button
                            key={city}
                            type="button"
                            onClick={() => toggleCity(city)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center space-x-1 ${
                              isSelected
                                ? 'bg-emerald-600/90 text-white border border-emerald-400/50'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                            }`}
                          >
                            <span>{city}</span>
                            {isSelected && <Check className="w-3 h-3 text-emerald-200" />}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={() => setCurrentStep(7)}
                      className="w-full py-2.5 bg-gradient-to-r from-[#4A5D4E] to-[#36453A] hover:from-[#586e5d] hover:to-[#435447] text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center space-x-1.5"
                    >
                      <span>Continue with {selectedCities.length} Selected Cities</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="pl-10 flex justify-end">
                    <div className="bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 px-3 py-1.5 rounded-xl text-xs font-medium flex items-center space-x-1.5 shadow-sm">
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{selectedCities.join(', ')}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STEP 7: CURATED LOW/NO-DOWN HOMES MATCH QUESTION */}
            {currentStep >= 7 && (
              <div className="space-y-2.5">
                <div className="flex items-start space-x-2.5">
                  <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center shrink-0 text-emerald-400 text-xs font-bold border border-slate-700">
                    7
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-tl-sm p-3 text-slate-100 shadow-sm text-xs leading-relaxed">
                    <span className="font-bold text-emerald-400 block mb-0.5">
                      Curated Homes Match
                    </span>
                    Would you like us to send you a curated list of available homes for sale in your
                    target area ({selectedCities.slice(0, 3).join(', ')}) that qualify for low or $0
                    down payment financing?
                  </div>
                </div>

                {currentStep === 7 ? (
                  <div className="grid grid-cols-1 gap-2 pl-10">
                    <button
                      type="button"
                      onClick={() => {
                        setSampleHomesWanted(true);
                        setCurrentStep(8);
                      }}
                      className="text-left p-3 bg-gradient-to-r from-[#4A5D4E]/80 to-[#36453A]/80 hover:from-[#586e5d] hover:to-[#435447] border border-emerald-500/60 rounded-xl text-xs transition-all shadow-md group"
                    >
                      <div className="font-bold text-emerald-300 flex items-center space-x-1.5 mb-0.5">
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span>YES — Please send available homes with low/no down options</span>
                      </div>
                      <div className="text-[11px] text-slate-300">
                        {loName} will curate qualifying listings and push them to your carousel.
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSampleHomesWanted(false);
                        setCurrentStep(8);
                      }}
                      className="text-left p-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-xl text-xs transition-all"
                    >
                      <div className="font-semibold text-slate-200">
                        NO — Just send my Prequalification Blueprint for now
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Calculate budget and financing options without listing alerts.
                      </div>
                    </button>
                  </div>
                ) : (
                  <div className="pl-10 flex justify-end">
                    <div className="bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 px-3 py-1.5 rounded-xl text-xs font-medium flex items-center space-x-1.5 shadow-sm">
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{sampleHomesWanted ? 'Curated homes requested' : 'Blueprint only'}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STEP 8: CONTACT INFORMATION & TCPA SMS CONSENT */}
            {currentStep >= 8 && currentStep < 9 && (
              <div className="space-y-3 pl-10">
                <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl space-y-3">
                  <div className="border-b border-slate-800 pb-2">
                    <h4 className="text-xs font-bold text-emerald-300 flex items-center space-x-1.5">
                      <Sparkles className="w-4 h-4 text-emerald-400" />
                      <span>Final Step: Unlock Your Custom Prequal Blueprint</span>
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Your numbers are calculated! Where should we deliver your prequalification
                      results?
                    </p>
                  </div>

                  {validationError && (
                    <div className="p-2.5 bg-rose-950/80 border border-rose-500/60 rounded-xl text-rose-200 text-xs">
                      {validationError}
                    </div>
                  )}

                  <form onSubmit={handleContactSubmit} className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Full Name
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                        <input
                          type="text"
                          placeholder="Jordan Smith"
                          value={fullName}
                          onChange={(e) => {
                            setFullName(e.target.value);
                            checkForSsnPattern(e.target.value);
                          }}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Email Address
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                        <input
                          type="email"
                          placeholder="jordan@example.com"
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            checkForSsnPattern(e.target.value);
                          }}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <p className="text-[10px] text-emerald-400/90 mt-1 leading-snug">
                        Save your curated low/no-down-payment homes — your email keeps your Top 3
                        favorites and curated list synced across devices.
                      </p>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Cell Phone Number
                      </label>
                      <div className="relative">
                        <Phone className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                        <input
                          type="tel"
                          placeholder="(503) 555-0199"
                          value={phone}
                          onChange={(e) => {
                            setPhone(e.target.value);
                            checkForSsnPattern(e.target.value);
                          }}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Preferred Contact Time
                      </label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {['Morning', 'Afternoon', 'Evening', 'Anytime'].map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setPreferredContactTime(t)}
                            className={`py-1.5 rounded-lg text-[11px] font-medium text-center border transition-all ${
                              preferredContactTime === t
                                ? 'bg-emerald-600/90 text-white border-emerald-400'
                                : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
                            }`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* TCPA Mandatory SMS Consent Checkbox */}
                    <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-xl">
                      <label className="flex items-start space-x-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={smsConsent}
                          onChange={(e) => setSmsConsent(e.target.checked)}
                          className="mt-0.5 rounded accent-emerald-500 w-4 h-4 shrink-0 cursor-pointer"
                        />
                        <span className="text-[10px] text-slate-300 leading-relaxed">
                          I agree to receive automated SMS updates, home listing alerts, and
                          pre-approval status notifications from the Loan Officer &amp; Realtor team
                          at the number provided. Msg &amp; data rates may apply. Reply STOP to
                          cancel.
                        </span>
                      </label>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-3 bg-gradient-to-r from-[#4A5D4E] to-[#36453A] hover:from-[#586e5d] hover:to-[#435447] text-white rounded-xl text-xs font-bold shadow-lg flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <span>Analyzing Underwriting Guidelines...</span>
                      ) : (
                        <>
                          <ShieldCheck className="w-4 h-4 text-emerald-300" />
                          <span>Generate Prequalification Blueprint</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* STEP 9: PREQUALIFICATION BLUEPRINT CARD */}
            {currentStep >= 9 && blueprintData && (
              <div className="space-y-3 animate-fade-in pl-2 pr-1">
                {/* Blueprint Card */}
                <div className="bg-gradient-to-br from-slate-900 via-[#1c2820] to-slate-900 border-2 border-emerald-500/60 rounded-2xl p-4 shadow-2xl space-y-3.5">
                  <div className="flex items-center justify-between border-b border-emerald-500/30 pb-2.5">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white leading-tight">
                          Prequalification Blueprint
                        </h4>
                        <p className="text-[10px] text-emerald-300 font-mono">
                          Prepared for {fullName} • {blueprintData.generatedAt}
                        </p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full text-[10px] font-bold">
                      LIKELY QUALIFIES
                    </span>
                  </div>

                  {/* Summary Metric Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-950/70 border border-slate-800 p-2.5 rounded-xl">
                      <span className="text-[10px] text-slate-400 block mb-0.5">
                        Purchasing Power
                      </span>
                      <span className="text-base font-black text-emerald-400 tracking-tight">
                        {blueprintData.maxApprovedPrice}
                      </span>
                    </div>

                    <div className="bg-slate-950/70 border border-slate-800 p-2.5 rounded-xl">
                      <span className="text-[10px] text-slate-400 block mb-0.5">
                        Est. Monthly P&amp;I
                      </span>
                      <span className="text-sm font-bold text-white font-mono">
                        {blueprintData.monthlyPIRange}
                      </span>
                    </div>
                  </div>

                  {/* Matched Loan Programs */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-300 block">
                      Matched Programs &amp; Grants:
                    </span>
                    <div className="space-y-1">
                      {blueprintData.matchedPrograms.map((prog: string) => (
                        <div
                          key={prog}
                          className="flex items-center space-x-2 text-[11px] bg-slate-900/80 px-2.5 py-1.5 rounded-lg border border-slate-800"
                        >
                          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="text-slate-200">{prog}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Curated listings note */}
                  {sampleHomesWanted && (
                    <div className="p-2.5 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-[11px] text-emerald-200">
                      🎯 Mike Ford will curate matching homes in {selectedCities.join(', ')} and
                      push them directly to your **My Curated Homes** carousel!
                    </div>
                  )}

                  {/* Disclaimer */}
                  <p className="text-[9px] text-slate-500 leading-normal border-t border-slate-800/80 pt-2">
                    *Estimates based on stated income and target price; subject to underwriting
                    verification. Pre-approval must be confirmed by {loName} (NMLS #{loNmls}). Equal
                    Housing Opportunity.
                  </p>
                </div>

                {/* 3 Action Buttons */}
                <div className="space-y-2 pt-1">
                  <a
                    href={`mailto:${pairing?.lo?.email || 'fordmj@gmail.com'}?subject=1-on-1 Strategy Call Request - ${encodeURIComponent(fullName)}&body=Hi Mike, I generated my prequalification blueprint for ${encodeURIComponent(selectedCities.join(', '))}. My phone is ${encodeURIComponent(phone)}.`}
                    className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-lg flex items-center justify-center space-x-2 transition-all"
                  >
                    <Calendar className="w-4 h-4" />
                    <span>Schedule 1-on-1 Strategy Call</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 flex items-center justify-center space-x-2 transition-all"
                  >
                    <Printer className="w-4 h-4 text-slate-400" />
                    <span>Download / Print Blueprint</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      if (onExploreListings) {
                        onExploreListings();
                      }
                    }}
                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-emerald-400 rounded-xl text-xs font-semibold border border-emerald-500/40 flex items-center justify-center space-x-2 transition-all"
                  >
                    <span>Explore Matched Listings</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Footer Bar with Safe-Area Padding & Touch Shield */}
          <div
            className="bg-slate-900 border-t border-slate-800 px-4 py-2.5 flex items-center justify-between text-[10px] text-slate-400 shrink-0 touch-none select-none pb-[calc(0.625rem+env(safe-area-inset-bottom,0px))]"
            onTouchMove={(e) => e.stopPropagation()}
          >
            <span>NMLS #{loNmls} • Equal Housing Lender</span>
            <span className="text-emerald-400 font-medium">Bank-Grade Confidential</span>
          </div>
        </div>
      </>
      )}
    </>
  );
};

export default LeadIntakeChatbot;
