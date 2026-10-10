import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { getAdminFirestore, resolveFirestoreTarget } from './firebaseAdmin.ts';
import { recordIntakeTcpaConsent, revokeTcpaConsent, canTextLead } from './tcpaConsent.ts';

const project = 'demo-geo-staging';
const database = 'fthb-geo-staging';

test('emulator target requires exact safe local configuration', () => {
  const env = { GEO_FIRESTORE_TARGET: 'emulator', GOOGLE_CLOUD_PROJECT: project, FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' };
  assert.equal(resolveFirestoreTarget(env).target, 'emulator');
  assert.equal(resolveFirestoreTarget(env).databaseId, database);
  assert.throws(() => resolveFirestoreTarget({ ...env, FIRESTORE_EMULATOR_HOST: 'localhost:8080' }), /GEO_EMULATOR_CONFIGURATION_REJECTED/);
  assert.throws(() => resolveFirestoreTarget({ ...env, NODE_ENV: 'production' }), /GEO_EMULATOR_CONFIGURATION_REJECTED/);
  assert.throws(() => resolveFirestoreTarget({ ...env, FIREBASE_SERVICE_ACCOUNT_JSON: '{}' }), /GEO_EMULATOR_CONFIGURATION_REJECTED/);
});

test('emulator consent lifecycle commits, audits, revokes and denies sends', async () => {
  assert.equal(process.env.GEO_FIRESTORE_TARGET, 'emulator');
  assert.equal(process.env.GOOGLE_CLOUD_PROJECT, project);
  assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8080');
  const db = getAdminFirestore();
  assert.ok(db);
  assert.equal(db.databaseId, database);
  const leadId = 'synthetic-geo-buyer-1001';
  assert.equal(await canTextLead(leadId), false);
  const consent = await recordIntakeTcpaConsent({
    leadId, rawPhone: '503-555-0147', explicitlyChecked: true
  });
  assert.equal(consent.status, 'GRANTED');
  assert.equal((await db.collection('tcpa_consents').doc(leadId).get()).data()?.status, 'GRANTED');
  assert.equal(await canTextLead(leadId), true);
  const firstAudit = await db.collection('tcpa_consent_events').where('leadId', '==', leadId).get();
  assert.equal(firstAudit.size, 1);
  assert.equal(firstAudit.docs[0].data().eventType, 'TCPA_CONSENT_GRANTED');
  await revokeTcpaConsent({ leadId, reason: 'STOP' });
  assert.equal(await canTextLead(leadId), false);
  assert.equal((await db.collection('tcpa_consents').doc(leadId).get()).data()?.status, 'REVOKED');
  const audits = await db.collection('tcpa_consent_events').where('leadId', '==', leadId).get();
  assert.equal(audits.size, 2);
  const head = await db.collection('tcpa_audit_chain').doc('head').get();
  assert.ok(head.data()?.lastHash);
});
