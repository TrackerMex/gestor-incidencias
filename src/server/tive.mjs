import { createHmac, timingSafeEqual } from 'node:crypto';

const exampleAlertId = '00000000-0000-0000-0000-000000000000';

export function signTivePayload(secret, timestamp, body) {
  return createHmac('sha256', secret).update(`${timestamp}.`).update(body).digest('base64');
}

export function verifyTiveSignature(secret, signature, body, now = Date.now()) {
  const parts = /^t=(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}Z),v1=([A-Za-z0-9+/]{43}=)$/.exec(signature ?? '');
  if (!parts) return false;

  const [, timestamp, hash] = parts;
  const sentAt = Date.parse(timestamp.replace(' ', 'T'));
  if (!Number.isFinite(sentAt) || Math.abs(now - sentAt) > 5 * 60 * 1000) return false;

  return timingSafeEqual(Buffer.from(hash), Buffer.from(signTivePayload(secret, timestamp, body)));
}

function valueText(value, max = 250) {
  return ['string', 'number'].includes(typeof value) ? String(value).trim().slice(0, max) : '';
}

function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value) || value.startsWith('0001-')) return null;
  const time = Date.parse(/[zZ]$|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value}Z`);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function coordinate(value, bounds) {
  if (typeof value !== 'number' && !valueText(value)) return null;
  const n = Number(value);
  return Number.isFinite(n) && Math.abs(n) <= bounds ? n : null;
}

function classify(type) {
  if (/temp(erature|eratura)|thermal/i.test(type)) return ['Temperatura', 'RELEVANTE'];
  if (/geofence|geocerca|arrival|departure|llegada|salida/i.test(type)) return ['Geocerca', 'RELEVANTE'];
  if (/shock|impacto|golpe|light|luz|tamper/i.test(type)) return ['Seguridad', 'RELEVANTE'];
  if (/battery|bater[ií]a/i.test(type)) return ['Batería', 'ORDINARIA'];
  return ['Operativa', 'ORDINARIA'];
}

export function normalizeTiveAlert(payload) {
  const alert = payload?.Alert;
  const accountId = valueText(alert?.AccountId ?? payload?.AccountId, 80);
  const alertId = valueText(alert?.AlertId, 150);
  const type = valueText(alert?.AlertType || payload?.AlertType || payload?.AlertName);
  const details = Array.isArray(alert?.Details) ? alert.Details.filter(detail => detail && Array.isArray(detail.Reasons)) : [];
  const created = details.find(detail => detail.Reasons.includes('Created'));
  const closed = details.find(detail => detail.Reasons.includes('Closed'));
  const eventAt = date(payload?.AlertDate) || date(payload?.RealDate) || date(created?.DateTime) || date(closed?.DateTime);
  if (!accountId || !alertId || !type || !eventAt || typeof alert.IsClosed !== 'boolean') return null;

  const [category, severity] = classify(type);
  const recoveredDate = date(payload.RecoveredAlertDate);
  const pointInTime = Boolean(closed && closed === created && !recoveredDate);
  const location = created?.Location ?? (!alert.IsClosed ? payload.Location : closed?.Location ?? payload.Location);
  const celsius = created?.Value?.Celsius ?? created?.Value?.Temperature?.Celsius ?? payload.Temperature?.Celsius;
  const measuredValue = valueText(payload.AlertDisplayValue) || (category === 'Temperatura' && typeof celsius === 'number' ? `${celsius} °C` : valueText(payload.AlertValue));

  return {
    accountId,
    alertId,
    deviceName: valueText(alert.DeviceName || payload.DeviceName || alert.EntityName || alert.DeviceId) || 'Rastreador sin nombre',
    shipmentId: valueText(alert.ShipmentId || payload.ShipmentId) || null,
    eventName: valueText(payload.AlertName || payload.TriggerName || type),
    category,
    severity,
    measuredValue: measuredValue || null,
    openedAt: date(created?.DateTime) || (!alert.IsClosed ? eventAt : null),
    recoveredAt: alert.IsClosed && !pointInTime ? recoveredDate || date(closed?.DateTime) || eventAt : null,
    eventAt,
    latitude: coordinate(location?.Latitude, 90),
    longitude: coordinate(location?.Longitude, 180),
    address: valueText(location?.FormattedAddress || location?.Name, 500) || null,
    simulated: alertId === exampleAlertId || (payload.Simulation === true && alertId.startsWith('sim-temperature-')),
  };
}
