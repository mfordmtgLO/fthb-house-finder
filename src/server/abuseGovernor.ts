// Copyright (c) 2026 Mike Ford, NMLS #288455. All Rights Reserved.
/**
 * Abuse Governor & Per-Session Daily Caps Engine (Defense in Depth)
 * - Daily chat message cap (40 messages / 24 hr per lead session)
 * - Daily property note cap (15 notes / 24 hr per lead session)
 * - Provides friendly limit states when thresholds are reached
 * - Operates independently even if the dashboard control plane is unreachable
 */

interface DailyBucket {
  chatCount: number;
  noteCount: number;
  resetAt: number; // Unix timestamp in ms
}

const DAILY_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_DAILY_CHATS = 40;
const MAX_DAILY_NOTES = 15;

const leadBuckets = new Map<string, DailyBucket>();

function getOrCreateBucket(leadId: string): DailyBucket {
  const now = Date.now();
  let bucket = leadBuckets.get(leadId);

  if (!bucket || now >= bucket.resetAt) {
    bucket = {
      chatCount: 0,
      noteCount: 0,
      resetAt: now + DAILY_WINDOW_MS
    };
    leadBuckets.set(leadId, bucket);
  }

  return bucket;
}

// Memory cleanup every hour
setInterval(() => {
  const now = Date.now();
  for (const [leadId, b] of leadBuckets.entries()) {
    if (now >= b.resetAt) {
      leadBuckets.delete(leadId);
    }
  }
}, 60 * 60 * 1000);

export function checkAndIncrementDailyChat(leadId: string): {
  allowed: boolean;
  count: number;
  limit: number;
  remaining: number;
  resetInHours: number;
  friendlyMessage?: string;
} {
  const bucket = getOrCreateBucket(leadId);
  const now = Date.now();
  const resetInHours = Math.max(1, Math.ceil((bucket.resetAt - now) / (60 * 60 * 1000)));

  if (bucket.chatCount >= MAX_DAILY_CHATS) {
    return {
      allowed: false,
      count: bucket.chatCount,
      limit: MAX_DAILY_CHATS,
      remaining: 0,
      resetInHours,
      friendlyMessage: `You've asked a lot of great questions today! Muse rests after ${MAX_DAILY_CHATS} questions per day to maintain quality. Mike Ford (NMLS #288455) is available directly if you need answers immediately.`
    };
  }

  bucket.chatCount++;
  const remaining = Math.max(0, MAX_DAILY_CHATS - bucket.chatCount);

  return {
    allowed: true,
    count: bucket.chatCount,
    limit: MAX_DAILY_CHATS,
    remaining,
    resetInHours
  };
}

export function checkAndIncrementDailyNotes(leadId: string): {
  allowed: boolean;
  count: number;
  limit: number;
  remaining: number;
  resetInHours: number;
  friendlyMessage?: string;
} {
  const bucket = getOrCreateBucket(leadId);
  const now = Date.now();
  const resetInHours = Math.max(1, Math.ceil((bucket.resetAt - now) / (60 * 60 * 1000)));

  if (bucket.noteCount >= MAX_DAILY_NOTES) {
    return {
      allowed: false,
      count: bucket.noteCount,
      limit: MAX_DAILY_NOTES,
      remaining: 0,
      resetInHours,
      friendlyMessage: `You've posted ${MAX_DAILY_NOTES} property notes today! Contact Mike Ford (NMLS #288455) directly to review this home or schedule an in-person private tour.`
    };
  }

  bucket.noteCount++;
  const remaining = Math.max(0, MAX_DAILY_NOTES - bucket.noteCount);

  return {
    allowed: true,
    count: bucket.noteCount,
    limit: MAX_DAILY_NOTES,
    remaining,
    resetInHours
  };
}

export function getDailyAbuseStatus(leadId: string): {
  chatCount: number;
  chatLimit: number;
  chatRemaining: number;
  noteCount: number;
  noteLimit: number;
  noteRemaining: number;
  resetInHours: number;
} {
  const bucket = getOrCreateBucket(leadId);
  const now = Date.now();
  const resetInHours = Math.max(1, Math.ceil((bucket.resetAt - now) / (60 * 60 * 1000)));

  return {
    chatCount: bucket.chatCount,
    chatLimit: MAX_DAILY_CHATS,
    chatRemaining: Math.max(0, MAX_DAILY_CHATS - bucket.chatCount),
    noteCount: bucket.noteCount,
    noteLimit: MAX_DAILY_NOTES,
    noteRemaining: Math.max(0, MAX_DAILY_NOTES - bucket.noteCount),
    resetInHours
  };
}

// Test helper to reset or simulate limits
export function resetDailyCapsForTest(leadId?: string): void {
  if (leadId) {
    leadBuckets.delete(leadId);
  } else {
    leadBuckets.clear();
  }
}

export function setDailyChatCountForTest(leadId: string, count: number): void {
  const bucket = getOrCreateBucket(leadId);
  bucket.chatCount = count;
}

export function setDailyNoteCountForTest(leadId: string, count: number): void {
  const bucket = getOrCreateBucket(leadId);
  bucket.noteCount = count;
}
