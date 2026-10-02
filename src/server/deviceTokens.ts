// Copyright (c) 2026 Mike Ford, NMLS #288455. All Rights Reserved.
/**
 * Push Notification Registration Service
 * STATUS: Honestly marked as not-yet-wired pending production VAPID / APNs keys.
 * No fake tokens generated, no fabricated storage logs.
 */

export interface RegisteredDevice {
  token: string;
  platform: 'ios' | 'android' | 'web';
  registeredAt: string;
}

export async function getMikeDeviceTokens(): Promise<RegisteredDevice[]> {
  // Not-yet-wired: returns empty array honestly until live VAPID configuration
  return [];
}
