// Copyright (c) 2026 Mike Ford, NMLS #288455. All Rights Reserved.

/**
 * Canonical Source Registry for FTHB House Finder Plugin.
 * Must match the Dashboard Source Registry EXACTLY.
 */
export const PLUGIN_SOURCE_REGISTRY = {
  'plugin-chatbot': {
    source: 'plugin-chatbot',
    sourceLabel: 'FTHB House Finder plugin: Chatbot'
  },
  'plugin-chat': {
    source: 'plugin-chat',
    sourceLabel: 'FTHB House Finder plugin: Chatbot'
  },
  'plugin-email-link': {
    source: 'plugin-email-link',
    sourceLabel: 'FTHB House Finder plugin: Email Identify'
  }
} as const;

export type PluginSourceKey = keyof typeof PLUGIN_SOURCE_REGISTRY;
