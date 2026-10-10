// Copyright (c) 2026 Mike Ford, NMLS #288455. All Rights Reserved.
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { resolveFirestoreTarget } from './firebaseAdmin.ts';

test('explicit staging target resolves only the approved named database', () => {
  assert.deepEqual(resolveFirestoreTarget({
    GEO_FIRESTORE_TARGET: 'staging',
    GEO_FIRESTORE_PROJECT_ID: 'astral-web-439103-g7',
    GEO_FIRESTORE_DATABASE_ID: 'fthb-geo-staging',
    NODE_ENV: 'development'
  }), {
    projectId: 'astral-web-439103-g7',
    databaseId: 'fthb-geo-staging',
    target: 'staging'
  });
});

test('rejects wrong staging database and project IDs', () => {
  for (const [projectId, databaseId] of [
    ['wrong-project', 'fthb-geo-staging'],
    ['astral-web-439103-g7', '(default)'],
    ['astral-web-439103-g7', 'ai-studio-vantageaiworkspa-320759cc-ded2-4188-b4e0-ed887f4ad5bd']
  ]) {
    assert.throws(() => resolveFirestoreTarget({
      GEO_FIRESTORE_TARGET: 'staging',
      GEO_FIRESTORE_PROJECT_ID: projectId,
      GEO_FIRESTORE_DATABASE_ID: databaseId
    }), /STAGING_FIRESTORE_TARGET_MISMATCH/);
  }
});

test('staging cannot accidentally run under production NODE_ENV', () => {
  assert.throws(() => resolveFirestoreTarget({
    GEO_FIRESTORE_TARGET: 'staging',
    GEO_FIRESTORE_PROJECT_ID: 'astral-web-439103-g7',
    GEO_FIRESTORE_DATABASE_ID: 'fthb-geo-staging',
    NODE_ENV: 'production'
  }), /STAGING_TARGET_BLOCKED_IN_PRODUCTION_RUNTIME/);
});

test('production retains existing named database', () => {
  assert.equal(resolveFirestoreTarget({ GEO_FIRESTORE_TARGET: 'production' }).databaseId,
    'ai-studio-vantageaiworkspa-320759cc-ded2-4188-b4e0-ed887f4ad5bd');
});

test('fail-closed: wrong staging target never initializes Firestore', async () => {
  const { getAdminFirestore } = await import('./firebaseAdmin.ts');
  const keys = ['GEO_FIRESTORE_TARGET', 'GEO_FIRESTORE_PROJECT_ID', 'GEO_FIRESTORE_DATABASE_ID', 'GEO_STAGING_USE_ADC'];
  const old = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  try {
    process.env.GEO_FIRESTORE_TARGET = 'staging';
    process.env.GEO_FIRESTORE_PROJECT_ID = 'astral-web-439103-g7';
    process.env.GEO_FIRESTORE_DATABASE_ID = '(default)';
    process.env.GEO_STAGING_USE_ADC = 'true';
    assert.equal(getAdminFirestore(), null);
    const { canTextLead, recordIntakeTcpaConsent, revokeTcpaConsent } = await import('./tcpaConsent.ts');
    assert.equal(await canTextLead('synthetic-failclosed-01'), false);
    await assert.rejects(recordIntakeTcpaConsent({
      leadId: 'synthetic-failclosed-01', rawPhone: '503-555-0147', explicitlyChecked: true
    }), /TCPA_STORAGE_UNAVAILABLE/);
    await assert.rejects(revokeTcpaConsent({
      leadId: 'synthetic-failclosed-01', reason: 'STOP'
    }), /TCPA_STORAGE_UNAVAILABLE/);
  } finally {
    for (const k of keys) {
      if (old[k] === undefined) delete process.env[k];
      else process.env[k] = old[k];
    }
  }
});
