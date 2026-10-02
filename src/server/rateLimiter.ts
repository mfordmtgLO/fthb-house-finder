// Copyright (c) 2026 Mike Ford, NMLS #288455. All Rights Reserved.
/**
 * 4-Tier Rate Limiting Engine
 * Mirroring hardened homebuyer architecture:
 * 1. Global API: 120 req / 15 min
 * 2. Leads Intake: 20 leads / 15 min
 * 3. Webhooks: 60 / min
 * 4. Sensitive Ops (Notes, Chat, Auth): 60 / 15 min
 */

interface RateBucket {
  count: number;
  resetAt: number;
}

const globalBuckets = new Map<string, RateBucket>();
const leadsBuckets = new Map<string, RateBucket>();
const webhookBuckets = new Map<string, RateBucket>();
const sensitiveBuckets = new Map<string, RateBucket>();

function checkBucket(
  buckets: Map<string, RateBucket>,
  ip: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetInSec: number } {
  const now = Date.now();
  let bucket = buckets.get(ip);

  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 1, resetAt: now + windowMs };
    buckets.set(ip, bucket);
    return { allowed: true, remaining: limit - 1, resetInSec: Math.ceil(windowMs / 1000) };
  }

  bucket.count++;
  const remaining = Math.max(0, limit - bucket.count);
  const resetInSec = Math.max(0, Math.ceil((bucket.resetAt - now) / 1000));

  if (bucket.count > limit) {
    return { allowed: false, remaining: 0, resetInSec };
  }

  return { allowed: true, remaining, resetInSec };
}

// Clean up stale entries periodically to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, b] of globalBuckets.entries()) {
    if (now >= b.resetAt) globalBuckets.delete(key);
  }
  for (const [key, b] of leadsBuckets.entries()) {
    if (now >= b.resetAt) leadsBuckets.delete(key);
  }
  for (const [key, b] of webhookBuckets.entries()) {
    if (now >= b.resetAt) webhookBuckets.delete(key);
  }
  for (const [key, b] of sensitiveBuckets.entries()) {
    if (now >= b.resetAt) sensitiveBuckets.delete(key);
  }
}, 60000);

export function rateLimitGlobal(ip: string) {
  // 120 req / 15 min (900,000 ms)
  return checkBucket(globalBuckets, ip, 120, 15 * 60 * 1000);
}

export function rateLimitLeads(ip: string) {
  // 20 leads / 15 min
  return checkBucket(leadsBuckets, ip, 20, 15 * 60 * 1000);
}

export function rateLimitWebhooks(ip: string) {
  // 60 webhooks / min (60,000 ms)
  return checkBucket(webhookBuckets, ip, 60, 60 * 1000);
}

export function rateLimitSensitive(ip: string) {
  // 60 sensitive ops / 15 min
  return checkBucket(sensitiveBuckets, ip, 60, 15 * 60 * 1000);
}
