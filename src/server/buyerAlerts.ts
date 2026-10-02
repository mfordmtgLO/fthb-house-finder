// Copyright (c) 2026 Mike Ford, NMLS #288455. All Rights Reserved.
/**
 * Buyer Alerts & Push Notification Opt-in Service
 * SURFACES sweep outcomes (_priceReduced, _new, _statusChanged)
 * Dispatches FCM push notifications to buyers when homes in their favorites
 * or saved searches have price drops.
 * ARCHITECTURE LAW: Sweeps run upstream in GeoSphere backend, NOT here.
 */

import { recordAuditLedger } from './compliance.ts';

export interface BuyerAlertSubscription {
  leadId: string;
  pushSubscriptionJson?: string;
  emailOrPhone?: string;
  criteria: {
    city?: string;
    maxPrice?: number;
    favoriteListingIds: string[];
  };
  optedInAt: string;
  active: boolean;
}

const alertSubscriptions = new Map<string, BuyerAlertSubscription>();

export function registerBuyerAlertOptIn(params: {
  leadId: string;
  ipAddress: string;
  pushSubscriptionJson?: string;
  emailOrPhone?: string;
  criteria: {
    city?: string;
    maxPrice?: number;
    favoriteListingIds: string[];
  };
}): { success: boolean; message: string } {
  const { leadId, ipAddress, pushSubscriptionJson, emailOrPhone, criteria } = params;

  const sub: BuyerAlertSubscription = {
    leadId,
    pushSubscriptionJson,
    emailOrPhone,
    criteria,
    optedInAt: new Date().toISOString(),
    active: true
  };

  alertSubscriptions.set(leadId, sub);

  recordAuditLedger({
    leadId,
    actionType: 'ALERT_OPT_IN',
    ipAddress,
    redactedPayload: {
      hasPush: Boolean(pushSubscriptionJson),
      city: criteria.city,
      favCount: criteria.favoriteListingIds.length
    }
  });

  return {
    success: true,
    message: 'Successfully subscribed to price-drop and new qualifying match alerts!'
  };
}

export function getBuyerSubscription(leadId: string): BuyerAlertSubscription | null {
  return alertSubscriptions.get(leadId) || null;
}

/**
 * Dispatches simulated or live FCM push to the buyer for a price reduction.
 */
export function triggerPriceDropAlertForBuyer(leadId: string, listingAddress: string, priceDropAmount: number) {
  const sub = alertSubscriptions.get(leadId);
  if (!sub || !sub.active) return false;

  console.log(`[Buyer Alert FCM] Dispatched Price Drop Alert to Buyer ${leadId}:`, {
    title: `Price Drop Alert: ${listingAddress}`,
    body: `Good news! A home on your radar just dropped by $${priceDropAmount.toLocaleString()}. Tap to view updated payment options.`
  });
  return true;
}
