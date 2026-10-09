// Copyright (c) 2026 Mike Ford, NMLS #288455. All Rights Reserved.
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { matchGeoCommand, type GeoCommandContext } from './geoScriptedCommands.ts';

const context: GeoCommandContext = {
  instanceId: 'test-instance',
  leadId: 'test-buyer',
  assignedLoanOfficer: { id: 'lo-1', firstName: 'Jordan' },
  assignedAgent: { id: 'agent-1', firstName: 'Taylor' },
  visibleListings: [
    { id: 'home-1', address: '1244 XYZ Street' },
    { id: 'home-2', address: '55 Pine Lane' },
  ],
  favoriteListingIds: ['home-1', 'home-2', 'not-authorized'],
  selectedListingId: 'home-1',
};

test('Top 3 returns only buyer-visible favorites', () => {
  const out = matchGeoCommand('Hey Geo, take me to my top 3 listings', context);
  assert.equal(out.intent, 'OPEN_TOP_THREE');
  assert.deepEqual(out.action, { type: 'OPEN_FAVORITES', listingIds: ['home-1', 'home-2'] });
  assert.equal(out.requiresConfirmation, false);
});

test('Map command resolves known property and does not invent listing', () => {
  const out = matchGeoCommand('Geo show 1244 XYZ Street listing on the map', context);
  assert.deepEqual(out.action, { type: 'FOCUS_LISTING', listingId: 'home-1' });
  assert.deepEqual(matchGeoCommand('show 900 Unknown Avenue on the map', context).action, { type: 'NONE' });
});

test('Property note only opens confirmation flow and never sends', () => {
  const out = matchGeoCommand('Geo send a note on this property asking about a 2-1 buydown', context);
  assert.equal(out.intent, 'DRAFT_PROPERTY_NOTE');
  assert.equal(out.requiresConfirmation, true);
  assert.deepEqual(out.action, { type: 'PREPARE_NOTE', listingId: 'home-1', recipientRole: 'lo', draft: '' });
  assert.match(out.spokenText, /Jordan/);
});

test('Mortgage questions hand off without generating financing advice', () => {
  const out = matchGeoCommand('Can I qualify for FHA with a 2-1 buydown?', context);
  assert.equal(out.intent, 'MORTGAGE_HANDOFF');
  assert.equal(out.requiresConfirmation, true);
  assert.doesNotMatch(out.spokenText, /3\.5%|guarantee|approved/i);
});

test('Unassigned LO is never replaced with Mike Ford by default', () => {
  const out = matchGeoCommand('What is my interest rate?', { ...context, assignedLoanOfficer: undefined });
  assert.match(out.spokenText, /your licensed loan officer/i);
  assert.doesNotMatch(out.spokenText, /Mike Ford/);
  assert.deepEqual(out.action, { type: 'NONE' });
});

test('Bare yes cannot authorize a previously proposed action', () => {
  const out = matchGeoCommand('yes', context);
  assert.equal(out.responseId, 'GEO_CONFIRM_CONTEXT_REQUIRED');
  assert.deepEqual(out.action, { type: 'NONE' });
});

test('Unknown question gets fixed approved fallback', () => {
  const out = matchGeoCommand('Tell me a joke about dragons', context);
  assert.equal(out.responseId, 'GEO_SAFE_FALLBACK');
  assert.match(out.spokenText, /Jordan/);
  assert.deepEqual(out.action, { type: 'NONE' });
});
