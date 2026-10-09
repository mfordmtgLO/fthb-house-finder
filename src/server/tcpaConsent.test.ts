// Copyright (c) 2026 Mike Ford, NMLS #288455. All Rights Reserved.
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { validateAndFormatE164, canTextLead, sendSmsToLead, recordIntakeTcpaConsent } from './tcpaConsent.ts';

test('US phone validation accepts valid NANP and rejects malformed numbers', () => {
  assert.equal(validateAndFormatE164('(503) 555-0147'), '+15035550147');
  assert.equal(validateAndFormatE164('+1 503-555-0147'), '+15035550147');
  assert.equal(validateAndFormatE164('123-555-0147'), null);
  assert.equal(validateAndFormatE164('503-155-0147'), null);
  assert.equal(validateAndFormatE164('+44 20 7946 0958'), null);
});

test('TCPA consent cannot be granted without an explicit checked opt-in', async () => {
  await assert.rejects(
    recordIntakeTcpaConsent({ leadId: 'buyer-12345', rawPhone: '503-555-0147', explicitlyChecked: false }),
    /TCPA_EXPLICIT_OPT_IN_REQUIRED/
  );
});

test('SMS stays dormant even when called directly', async () => {
  assert.deepEqual(await sendSmsToLead('buyer-12345', 'Hello'), {
    sent: false, reason: 'SMS_TRANSPORT_NOT_CONFIGURED'
  });
});

test('Unknown lead is never textable', async () => {
  assert.equal(await canTextLead(''), false);
});
