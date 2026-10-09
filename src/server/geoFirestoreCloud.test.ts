// Copyright (c) 2026 Mike Ford, NMLS #288455. All Rights Reserved.
/**
 * LIVE CLOUD STAGING ONLY. Run manually with impersonated ADC, never in CI.
 * Appends two synthetic audit events and a revoked synthetic consent marker
 * to fthb-geo-staging. Do not delete the audit chain or its referenced events.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getAdminFirestore } from './firebaseAdmin.ts';
import { recordIntakeTcpaConsent, revokeTcpaConsent, canTextLead, sendSmsToLead } from './tcpaConsent.ts';

test('real Geo TCPA lifecycle on isolated cloud staging', { timeout: 90000 }, async () => {
  assert.equal(process.env.GEO_FIRESTORE_TARGET, 'staging');
  assert.equal(process.env.GEO_FIRESTORE_PROJECT_ID, 'astral-web-439103-g7');
  assert.equal(process.env.GEO_FIRESTORE_DATABASE_ID, 'fthb-geo-staging');
  assert.equal(process.env.GOOGLE_CLOUD_PROJECT, 'astral-web-439103-g7');
  assert.equal(process.env.GEO_STAGING_USE_ADC, 'true');
  assert.equal(process.env.GEO_STAGING_VALIDATOR_EMAIL,
    'geo-staging-validator@astral-web-439103-g7.iam.gserviceaccount.com');
  assert.equal(process.env.FIREBASE_SERVICE_ACCOUNT_JSON, undefined);
  assert.equal(process.env.FIRESTORE_EMULATOR_HOST, undefined);

  // Refuse to run with personal-user ADC or a long-lived private key.
  // The impersonated ADC file contains a source credential but no service
  // account private key; never print or commit this file.
  const adcPath = process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    path.join(os.homedir(), '.config/gcloud/application_default_credentials.json');
  const adc = JSON.parse(fs.readFileSync(adcPath, 'utf8'));
  assert.equal(adc.type, 'impersonated_service_account',
    'ADC must impersonate Geo Staging Validator, not use personal credentials');
  assert.ok(String(adc.service_account_impersonation_url || '').includes(
    '/serviceAccounts/geo-staging-validator@astral-web-439103-g7.iam.gserviceaccount.com:generateAccessToken'),
    'ADC impersonation target must be Geo Staging Validator');

  const db = getAdminFirestore();
  assert.ok(db, 'Staging Firestore must initialize; never fall back to production');
  assert.equal(db.databaseId, 'fthb-geo-staging');

  const leadId = 'geo-cloud-validation-' + crypto.randomUUID().replace(/-/g, '');
  const consentRef = db.collection('tcpa_consents').doc(leadId);
  assert.equal((await consentRef.get()).exists, false);
  assert.equal(await canTextLead(leadId), false);

  await assert.rejects(
    recordIntakeTcpaConsent({
      leadId, rawPhone: '503-555-0147', explicitlyChecked: false
    }), /TCPA_EXPLICIT_OPT_IN_REQUIRED/
  );
  assert.equal((await consentRef.get()).exists, false);

  const granted = await recordIntakeTcpaConsent({
    leadId, rawPhone: '503-555-0147', explicitlyChecked: true
  });
  assert.equal(granted.status, 'GRANTED');
  assert.equal((await consentRef.get()).data()?.status, 'GRANTED');
  assert.equal(await canTextLead(leadId), true);

  const revoked = await revokeTcpaConsent({ leadId, reason: 'STOP' });
  assert.deepEqual(revoked, { revoked: true });
  assert.equal((await consentRef.get()).data()?.status, 'REVOKED');
  assert.equal(await canTextLead(leadId), false);

  const audit = await db.collection('tcpa_consent_events')
    .where('leadId', '==', leadId).get();
  assert.equal(audit.size, 2);
  const types = audit.docs.map(doc => doc.data().eventType).sort();
  assert.deepEqual(types, ['TCPA_CONSENT_GRANTED', 'TCPA_CONSENT_REVOKED']);
  for (const doc of audit.docs) {
    assert.match(doc.data().entryHash, /^[a-f0-9]{64}$/);
    assert.ok(doc.data().previousHash);
  }
  const head = await db.collection('tcpa_audit_chain').doc('head').get();
  assert.ok(head.data()?.lastHash);

  assert.deepEqual(await sendSmsToLead(leadId, 'synthetic test'), {
    sent: false, reason: 'SMS_TRANSPORT_NOT_CONFIGURED'
  });
  console.log('GEO_CLOUD_STAGING_CONSENT_PASSED; synthetic lead:', leadId);
  console.log('Synthetic revoked consent and two audit events intentionally retained in staging.');
});
