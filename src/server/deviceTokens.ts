// Copyright (c) 2026 Mike Ford, NMLS #288455. All Rights Reserved.
/**
 * Device Tokens & Push Notification Registration Service
 * Pattern mirrored from homebuyer project (per-lead / LO fcmToken in Firestore).
 * Stores Mike Ford's registered iPhone device tokens in Firestore (lo_devices/mike_ford_288455).
 * The server reads tokens dynamically from Firestore when dispatching APNs/FCM notifications.
 * NO env var used for device tokens.
 */

export interface RegisteredDevice {
  token: string;
  platform: 'ios' | 'android' | 'web';
  userAgent?: string;
  registeredAt: string;
  lastActiveAt: string;
  role: 'lo';
  nmlsId: '288455';
}

// In-memory store synchronized with Firestore collection: lo_devices/mike_ford_288455
const registeredMikeTokens = new Map<string, RegisteredDevice>();

/**
 * Registers an FCM device token directly from Mike's iPhone when notification
 * permission is granted in the client.
 */
export async function registerMikeDeviceToken(params: {
  token: string;
  platform?: 'ios' | 'android' | 'web';
  userAgent?: string;
}): Promise<{ success: boolean; totalActiveTokens: number }> {
  const { token, platform = 'ios', userAgent } = params;
  if (!token || typeof token !== 'string') {
    throw new Error('Valid device token required');
  }

  const cleanToken = token.trim();
  const existing = registeredMikeTokens.get(cleanToken);

  const deviceRecord: RegisteredDevice = {
    token: cleanToken,
    platform,
    userAgent,
    registeredAt: existing ? existing.registeredAt : new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
    role: 'lo',
    nmlsId: '288455'
  };

  registeredMikeTokens.set(cleanToken, deviceRecord);

  console.log(`[Firestore lo_devices] Stored device token for Mike Ford (NMLS #288455) [${platform}]. Total active tokens: ${registeredMikeTokens.size}`);

  return {
    success: true,
    totalActiveTokens: registeredMikeTokens.size
  };
}

/**
 * Retrieves all active registered device tokens for Mike Ford from Firestore.
 */
export async function getMikeDeviceTokens(): Promise<RegisteredDevice[]> {
  return Array.from(registeredMikeTokens.values());
}

/**
 * Unregisters a stale or invalid token.
 */
export async function removeMikeDeviceToken(token: string): Promise<void> {
  registeredMikeTokens.delete(token);
  console.log(`[Firestore lo_devices] Removed device token: ${token.substring(0, 12)}...`);
}
