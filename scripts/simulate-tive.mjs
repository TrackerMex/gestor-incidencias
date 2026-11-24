import { randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';
import { signTivePayload } from '../src/server/tive.mjs';

const { values } = parseArgs({ options: {
  base: { type: 'string', default: 'http://localhost:4321' },
  id: { type: 'string', default: `sim-temperature-${randomUUID()}` },
  account: { type: 'string', default: process.env.TIVE_ACCOUNT_ID || 'demo' },
  recover: { type: 'boolean', default: false },
  at: { type: 'string' },
} });

const secret = process.env.TIVE_WEBHOOK_SECRET;
if (!secret) throw new Error('Define TIVE_WEBHOOK_SECRET para firmar la simulación.');
if (!values.id.startsWith('sim-temperature-')) throw new Error('Usa un ID que empiece con sim-temperature-.');

const eventDate = new Date(values.at ?? Date.now()).toISOString();
const timestamp = new Date().toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, 'Z');
const location = {
  Latitude: 19.4326,
  Longitude: -99.1332,
  FormattedAddress: 'Ciudad de México (ubicación simulada)',
};
const temperature = values.recover ? 5.1 : 12.4;
const shipment = 'ENVIO-DEMO-001';
const body = JSON.stringify({
  Simulation: true,
  AlertDate: eventDate,
  AlertName: 'Temperatura fuera de rango',
  AlertDisplayValue: `${temperature} °C`,
  RecoveredAlertDate: values.recover ? eventDate : null,
  AlertType: 'Temperature',
  Temperature: { Celsius: temperature },
  Location: location,
  Alert: {
    AccountId: values.account,
    AlertId: values.id,
    AlertType: 'Temperature',
    DeviceName: 'Rastreador demo Tive',
    ShipmentId: shipment,
    IsClosed: values.recover,
    Details: [{ DateTime: eventDate, Reasons: [values.recover ? 'Closed' : 'Created'], Location: location }],
  },
});

const response = await fetch(new URL('/api/webhooks/tive', values.base), {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-tive-signature': `t=${timestamp},v1=${signTivePayload(secret, timestamp, body)}`,
  },
  body,
});

if (!response.ok) throw new Error(`Webhook respondió ${response.status}: ${await response.text()}`);
console.log(`Webhook confirmado (${response.status}). ${values.recover ? 'Recuperación' : 'Alerta'}: ${temperature} °C · ${values.id}`);
