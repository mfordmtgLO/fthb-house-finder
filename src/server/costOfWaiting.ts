// Copyright (c) 2026 Mike Ford, NMLS #288455. All Rights Reserved.
/**
 * Cost of Waiting Deterministic Calculator Engine
 * Ported directly from the official MortgageLab formula.
 * 
 * Formula invariants:
 * - Intervals: [0.5, 1, 2, 3] years
 * - futurePrice = targetPrice * (1 + appreciationRate)^years
 * - priceIncrease = futurePrice - targetPrice
 * - cumulativeRentPaid = monthlyRent * 12 * years
 * - missedPrincipalEquity = (monthlyPI * 12) * 0.32 * years
 * - Standard amortization: P&I = (P * r) / (1 - (1+r)^(-n))
 * - Rate shifts: down (-0.75, floor 3.5), up (+0.75)
 * - totalCostOfWaiting = priceIncrease + cumulativeRentPaid + missedPrincipalEquity
 */

export interface CostOfWaitingInputs {
  targetPrice: number;
  currentRate?: number; // e.g. 6.75 (percentage)
  appreciationRate?: number; // e.g. 0.035 (decimal, default 3.5%)
  downPaymentPercent?: number; // e.g. 0.035 (decimal, default 3.5% FHA/FTHB)
  monthlyRent?: number; // e.g. 2200
  loanTermYears?: number; // default 30
}

export interface CostOfWaitingInterval {
  years: number;
  futurePrice: number;
  priceIncrease: number;
  cumulativeRentPaid: number;
  missedPrincipalEquity: number;
  totalCostOfWaiting: number;
  futureMonthlyPI: {
    sameRate: number;
    downRate: number;
    upRate: number;
    downRatePercent: number;
    upRatePercent: number;
  };
}

export interface CostOfWaitingReport {
  targetPrice: number;
  currentRate: number;
  appreciationRate: number;
  downPaymentPercent: number;
  monthlyRent: number;
  basePrincipal: number;
  baseMonthlyPI: number;
  intervals: CostOfWaitingInterval[];
  assumptions: {
    appreciationAnnualPercent: number;
    rateShiftPercent: number;
    minRateFloorPercent: number;
    principalEquityShare: number;
  };
}

/**
 * Standard Amortization Calculation (Monthly Principal & Interest)
 */
export function calculateMonthlyPI(principal: number, annualRatePercent: number, loanTermYears = 30): number {
  if (principal <= 0) return 0;
  const monthlyRate = (annualRatePercent / 100) / 12;
  const numPayments = loanTermYears * 12;
  if (monthlyRate === 0) return principal / numPayments;
  const factor = Math.pow(1 + monthlyRate, numPayments);
  const payment = (principal * monthlyRate * factor) / (factor - 1);
  return Math.round(payment * 100) / 100;
}

/**
 * Executes the exact Cost of Waiting deterministic equation set.
 */
export function calculateCostOfWaiting(inputs: CostOfWaitingInputs): CostOfWaitingReport {
  const targetPrice = Math.max(50000, Number(inputs.targetPrice) || 450000);
  const currentRate = inputs.currentRate ?? 6.75;
  const appreciationRate = inputs.appreciationRate ?? 0.035; // 3.5% annual default
  const downPaymentPercent = inputs.downPaymentPercent ?? 0.035; // 3.5% default down
  const loanTermYears = inputs.loanTermYears ?? 30;
  
  // Default rent estimation if unprovided: ~0.5% of price or $2,200 floor
  const monthlyRent = inputs.monthlyRent ?? Math.max(1800, Math.round((targetPrice * 0.005) / 50) * 50);

  const basePrincipal = Math.round(targetPrice * (1 - downPaymentPercent) * 100) / 100;
  const baseMonthlyPI = calculateMonthlyPI(basePrincipal, currentRate, loanTermYears);

  const INTERVALS = [0.5, 1, 2, 3];
  const rateShiftPercent = 0.75;
  const minRateFloorPercent = 3.5;
  const principalEquityShare = 0.32; // 32% of early-year P&I goes to principal equity

  const downRatePercent = Math.max(minRateFloorPercent, Math.round((currentRate - rateShiftPercent) * 100) / 100);
  const upRatePercent = Math.round((currentRate + rateShiftPercent) * 100) / 100;

  const intervals: CostOfWaitingInterval[] = INTERVALS.map(years => {
    const futurePrice = Math.round(targetPrice * Math.pow(1 + appreciationRate, years) * 100) / 100;
    const priceIncrease = Math.round((futurePrice - targetPrice) * 100) / 100;
    const cumulativeRentPaid = Math.round(monthlyRent * 12 * years * 100) / 100;
    const missedPrincipalEquity = Math.round(baseMonthlyPI * 12 * principalEquityShare * years * 100) / 100;
    const totalCostOfWaiting = Math.round((priceIncrease + cumulativeRentPaid + missedPrincipalEquity) * 100) / 100;

    const futurePrincipal = Math.round(futurePrice * (1 - downPaymentPercent) * 100) / 100;
    const futurePI_same = calculateMonthlyPI(futurePrincipal, currentRate, loanTermYears);
    const futurePI_down = calculateMonthlyPI(futurePrincipal, downRatePercent, loanTermYears);
    const futurePI_up = calculateMonthlyPI(futurePrincipal, upRatePercent, loanTermYears);

    return {
      years,
      futurePrice,
      priceIncrease,
      cumulativeRentPaid,
      missedPrincipalEquity,
      totalCostOfWaiting,
      futureMonthlyPI: {
        sameRate: futurePI_same,
        downRate: futurePI_down,
        upRate: futurePI_up,
        downRatePercent,
        upRatePercent
      }
    };
  });

  return {
    targetPrice,
    currentRate,
    appreciationRate,
    downPaymentPercent,
    monthlyRent,
    basePrincipal,
    baseMonthlyPI,
    intervals,
    assumptions: {
      appreciationAnnualPercent: Math.round(appreciationRate * 1000) / 10,
      rateShiftPercent,
      minRateFloorPercent,
      principalEquityShare
    }
  };
}

/**
 * Formats deterministic calculator output into structured conversational grounding for Muse.
 * Guarantees zero freehanded math.
 */
export function formatCostOfWaitingForMuse(report: CostOfWaitingReport, highlightYears = 1): string {
  const oneYear = report.intervals.find(i => i.years === highlightYears) || report.intervals[1];
  const halfYear = report.intervals.find(i => i.years === 0.5) || report.intervals[0];
  const twoYear = report.intervals.find(i => i.years === 2) || report.intervals[2];

  return `
[DETERMINISTIC COST-OF-WAITING AUDIT GROUNDING]
Home Price: $${report.targetPrice.toLocaleString()} (Assumed Base Rate: ${report.currentRate}%, Down Payment: ${(report.downPaymentPercent * 100).toFixed(1)}%, Base Monthly P&I: $${report.baseMonthlyPI.toLocaleString()}/mo, Current Rent: $${report.monthlyRent.toLocaleString()}/mo)
Assumed Annual Appreciation: ${report.assumptions.appreciationAnnualPercent}% per year (labeled strictly as an economic assumption)

Interval Breakdown (Exact Calculated Figures):
1. 6 Months (0.5 Year):
   - Projected Home Price: $${halfYear.futurePrice.toLocaleString()} (+$${halfYear.priceIncrease.toLocaleString()})
   - Cumulative Rent Paid: $${halfYear.cumulativeRentPaid.toLocaleString()}
   - Missed Principal Equity Paydown: $${halfYear.missedPrincipalEquity.toLocaleString()}
   - Total Cost of Waiting (0.5 yr): $${halfYear.totalCostOfWaiting.toLocaleString()}

2. 1 Year (12 Months):
   - Projected Home Price: $${oneYear.futurePrice.toLocaleString()} (+$${oneYear.priceIncrease.toLocaleString()})
   - Cumulative Rent Paid: $${oneYear.cumulativeRentPaid.toLocaleString()}
   - Missed Principal Equity Paydown: $${oneYear.missedPrincipalEquity.toLocaleString()}
   - Total Cost of Waiting (1 yr): $${oneYear.totalCostOfWaiting.toLocaleString()}
   - Future Monthly P&I at Same Rate (${report.currentRate}%): $${oneYear.futureMonthlyPI.sameRate.toLocaleString()}/mo
   - Future Monthly P&I if Rates Drop to ${oneYear.futureMonthlyPI.downRatePercent}%: $${oneYear.futureMonthlyPI.downRate.toLocaleString()}/mo
   - Future Monthly P&I if Rates Rise to ${oneYear.futureMonthlyPI.upRatePercent}%: $${oneYear.futureMonthlyPI.upRate.toLocaleString()}/mo

3. 2 Years (24 Months):
   - Projected Home Price: $${twoYear.futurePrice.toLocaleString()} (+$${twoYear.priceIncrease.toLocaleString()})
   - Cumulative Rent Paid: $${twoYear.cumulativeRentPaid.toLocaleString()}
   - Missed Principal Equity Paydown: $${twoYear.missedPrincipalEquity.toLocaleString()}
   - Total Cost of Waiting (2 yr): $${twoYear.totalCostOfWaiting.toLocaleString()}
`.trim();
}
