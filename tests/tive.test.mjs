import assert from 'node:assert/strict';
import { test } from 'node:test';
import { POST } from '../src/pages/api/webhooks/tive.js';
import { normalizeTiveAlert, verifyTiveSignature } from '../src/server/tive.mjs';

test('acepta una firma vigente solo para el cuerpo exacto', () => {
  const now = Date.parse('2026-11-24T16:00:00Z');
  const signature = 't=2026-11-24 16:00:00Z,v1=P5ARa7sVI5MeVwGVXYq/r1+0LKMz4MJHr7p0pMuEXp8=';
  const body = Buffer.from('{"Alert":1}');

  assert.equal(verifyTiveSignature('test-key', signature, body, now), true);
  assert.equal(verifyTiveSignature('test-key', signature, '{"Alert": 1}', now), false);
  assert.equal(verifyTiveSignature('other-key', signature, body, now), false);
  assert.equal(verifyTiveSignature('test-key', signature, body, now + 301_000), false);
});

test('distingue el ejemplo de Tive, la simulación local y una alerta real', () => {
  const payload = {
    AlertDate: '2026-11-24T16:00:00Z',
    AlertType: 'TemperatureMax',
    Temperature: { Celsius: 12.4 },
    Alert: { AccountId: 123, AlertId: 'b4a6bde7-fbf9-4702-a284-0c15ec820bb1', IsClosed: false },
  };

  const real = normalizeTiveAlert(payload);
  assert.equal(real.simulated, false);
  assert.equal(real.category, 'Temperatura');
  assert.equal(real.measuredValue, '12.4 °C');

  const platformExample = { ...payload, Alert: { ...payload.Alert, AlertId: '00000000-0000-0000-0000-000000000000' } };
  const localExample = { ...payload, Simulation: true, Alert: { ...payload.Alert, AlertId: 'sim-temperature-test' } };
  assert.equal(normalizeTiveAlert(platformExample).simulated, true);
  assert.equal(normalizeTiveAlert(localExample).simulated, true);
});

test('el webhook rechaza solicitudes sin firma antes de leer el cuerpo', async context => {
  const originalSecret = process.env.TIVE_WEBHOOK_SECRET;
  process.env.TIVE_WEBHOOK_SECRET = 'test-key';
  context.after(() => {
    if (originalSecret === undefined) delete process.env.TIVE_WEBHOOK_SECRET;
    else process.env.TIVE_WEBHOOK_SECRET = originalSecret;
  });

  let bodyRead = false;
  const request = {
    headers: new Headers({ 'content-type': 'application/json' }),
    get body() {
      bodyRead = true;
      return null;
    },
  };

  assert.equal((await POST({ request })).status, 401);
  assert.equal(bodyRead, false);
});
