// Copyright (c) 2026 Mike Ford, NMLS #288455. All Rights Reserved.
/**
 * Plugin Control Plane & Heartbeat Engine
 * - Generates & persists a unique instanceId (.plugin-instance-id)
 * - Heartbeats the dashboard control plane every 5 minutes and on session init
 * - Caches status ('active' | 'suspended' | 'killed', killAll) with 10-minute TTL
 * - Retains last known status if dashboard is UNREACHABLE (outage survival)
 * - Enforces kill/suspend across buyer endpoints (zero AI calls, zero Firestore writes)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../');
const INSTANCE_ID_FILE = path.join(ROOT_DIR, '.plugin-instance-id');

export type PluginStatus = 'active' | 'suspended' | 'killed';

export interface PluginControlState {
  instanceId: string;
  appVersion: string;
  status: PluginStatus;
  killAll: boolean;
  suspendedReason?: string;
  lastHeartbeatAt?: string;
  lastSuccessfulHeartbeatAt?: string;
  lastCheckedAt: number;
}

export interface MockDashboardConfig {
  unreachable?: boolean;
  timeout?: boolean;
  status?: PluginStatus;
  killAll?: boolean;
  suspendedReason?: string;
}

const APP_VERSION = '1.0.0';
const HEARTBEAT_TTL_MS = 10 * 60 * 1000; // 10 minutes

// 1. Resolve or generate persistent instanceId
function getOrGenerateInstanceId(): string {
  if (process.env.PLUGIN_INSTANCE_ID && process.env.PLUGIN_INSTANCE_ID.trim()) {
    return process.env.PLUGIN_INSTANCE_ID.trim();
  }

  try {
    if (fs.existsSync(INSTANCE_ID_FILE)) {
      const stored = fs.readFileSync(INSTANCE_ID_FILE, 'utf-8').trim();
      if (stored) return stored;
    }
  } catch (err: any) {
    console.warn('[Plugin Heartbeat] Could not read .plugin-instance-id file:', err.message);
  }

  const newId = `fthb-inst-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
  try {
    fs.writeFileSync(INSTANCE_ID_FILE, newId, 'utf-8');
  } catch (err: any) {
    console.warn('[Plugin Heartbeat] Could not write .plugin-instance-id file:', err.message);
  }
  return newId;
}

// In-memory cache
const state: PluginControlState = {
  instanceId: getOrGenerateInstanceId(),
  appVersion: APP_VERSION,
  status: 'active',
  killAll: false,
  suspendedReason: undefined,
  lastHeartbeatAt: undefined,
  lastSuccessfulHeartbeatAt: undefined,
  lastCheckedAt: Date.now()
};

// Mock configuration for testing & simulation
let mockConfig: MockDashboardConfig | null = null;

export function setMockDashboardConfig(config: MockDashboardConfig | null): void {
  mockConfig = config;
  if (config === null) {
    state.status = 'active';
    state.killAll = false;
    state.suspendedReason = undefined;
    state.lastCheckedAt = Date.now();
  }
}

export function resetPluginOperationalStateForTest(): void {
  mockConfig = null;
  state.status = 'active';
  state.killAll = false;
  state.suspendedReason = undefined;
  state.lastCheckedAt = Date.now();
}

export function getMockDashboardConfig(): MockDashboardConfig | null {
  return mockConfig;
}

/**
 * Returns whether the plugin is operational to serve buyer traffic.
 * - If status === 'killed': permanent disable
 * - If status === 'suspended' or killAll === true: temporary suspend
 * - If status === 'active' and !killAll: operational
 */
export function getPluginOperationalState(): {
  operational: boolean;
  status: PluginStatus;
  killAll: boolean;
  reason?: string;
  instanceId: string;
  appVersion: string;
} {
  const isKilled = state.status === 'killed';
  const isSuspended = state.status === 'suspended' || state.killAll;

  if (isKilled) {
    return {
      operational: false,
      status: 'killed',
      killAll: state.killAll,
      reason: state.suspendedReason || 'Plugin permanently disabled by administrator',
      instanceId: state.instanceId,
      appVersion: state.appVersion
    };
  }

  if (isSuspended) {
    return {
      operational: false,
      status: 'suspended',
      killAll: state.killAll,
      reason: state.suspendedReason || (state.killAll ? 'Global kill-all active' : 'Plugin instance suspended'),
      instanceId: state.instanceId,
      appVersion: state.appVersion
    };
  }

  return {
    operational: true,
    status: 'active',
    killAll: false,
    instanceId: state.instanceId,
    appVersion: state.appVersion
  };
}

/**
 * Send heartbeat to dashboard control plane.
 * - Survives outages: if dashboard is UNREACHABLE (network error, timeout, 5xx),
 *   retains last known status and continues serving (logs warning).
 * - Enforces explicit kill/suspend immediately when seen.
 */
export async function sendHeartbeat(isSessionInit = false): Promise<PluginControlState> {
  const now = Date.now();
  state.lastHeartbeatAt = new Date().toISOString();

  // Test mock handling
  if (mockConfig) {
    if (mockConfig.unreachable || mockConfig.timeout) {
      console.warn(
        `[Plugin Heartbeat Warning] Dashboard control plane UNREACHABLE (${mockConfig.timeout ? 'TIMEOUT' : 'NETWORK_ERROR'}). Retaining last known status: "${state.status}" (killAll: ${state.killAll}). No mass disable.`
      );
      state.lastCheckedAt = now;
      return { ...state };
    }

    // Explicit status returned by mock dashboard
    if (mockConfig.status) {
      state.status = mockConfig.status;
    }
    if (mockConfig.killAll !== undefined) {
      state.killAll = mockConfig.killAll;
    }
    state.suspendedReason = mockConfig.suspendedReason;
    state.lastSuccessfulHeartbeatAt = new Date().toISOString();
    state.lastCheckedAt = now;
    return { ...state };
  }

  // Real dashboard URL
  const dashboardUrl = (process.env.DASHBOARD_URL || process.env.CONTROL_PLANE_URL || '').replace(/\/$/, '');

  if (!dashboardUrl) {
    // If not configured, retain active status and log info
    state.lastCheckedAt = now;
    return { ...state };
  }

  const endpoint = `${dashboardUrl}/api/internal/plugin/heartbeat`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5-second timeout

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MUSE_API_KEY || 'plugin_internal_service'}`
      },
      body: JSON.stringify({
        instanceId: state.instanceId,
        appVersion: state.appVersion,
        isSessionInit,
        timestamp: new Date().toISOString()
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.status === 'active' || data.status === 'suspended' || data.status === 'killed') {
        state.status = data.status;
      }
      if (typeof data.killAll === 'boolean') {
        state.killAll = data.killAll;
      }
      state.suspendedReason = data.suspendedReason || data.reason;
      state.lastSuccessfulHeartbeatAt = new Date().toISOString();
      state.lastCheckedAt = now;
      return { ...state };
    } else {
      console.warn(
        `[Plugin Heartbeat Warning] Dashboard responded with HTTP ${res.status}. Retaining last known status: "${state.status}".`
      );
    }
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.warn(
      `[Plugin Heartbeat Warning] Dashboard control plane UNREACHABLE (${err.message}). Retaining last known status: "${state.status}". Outage survival active.`
    );
  }

  state.lastCheckedAt = now;
  return { ...state };
}

// 5-minute background heartbeat timer
let timer: NodeJS.Timeout | null = null;

export function startHeartbeatScheduler(): void {
  if (timer) return;
  // Immediate initial heartbeat on startup
  sendHeartbeat(false).catch(err => {
    console.warn('[Plugin Heartbeat] Initial boot heartbeat failed:', err.message);
  });

  timer = setInterval(() => {
    sendHeartbeat(false).catch(err => {
      console.warn('[Plugin Heartbeat] Background heartbeat error:', err.message);
    });
  }, 5 * 60 * 1000); // 5 minutes
}

export function stopHeartbeatScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
