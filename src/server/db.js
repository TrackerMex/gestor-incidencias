import pg from 'pg';

let pool;

function database() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL no configurada');
    pool = new pg.Pool({ connectionString, connectionTimeoutMillis: 3000 });
    pool.on('error', error => console.error('Conexión de PostgreSQL interrumpida:', error.code));
  }
  return pool;
}

export async function saveTiveAlert(alert) {
  await database().query(`
    INSERT INTO tive_incidents (
      account_id, alert_id, device_name, shipment_id, event_name, category, severity, measured_value,
      opened_at, recovered_at, occurred_at, latitude, longitude, address, simulated
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    ON CONFLICT (account_id, alert_id) DO UPDATE SET
      opened_at = LEAST(tive_incidents.opened_at, EXCLUDED.opened_at),
      recovered_at = GREATEST(tive_incidents.recovered_at, EXCLUDED.recovered_at),
      occurred_at = LEAST(tive_incidents.occurred_at, EXCLUDED.occurred_at),
      shipment_id = COALESCE(tive_incidents.shipment_id, EXCLUDED.shipment_id),
      (measured_value, latitude, longitude, address) = (SELECT
        CASE WHEN preferred THEN COALESCE(EXCLUDED.measured_value, tive_incidents.measured_value) ELSE COALESCE(tive_incidents.measured_value, EXCLUDED.measured_value) END,
        CASE WHEN preferred THEN COALESCE(EXCLUDED.latitude, tive_incidents.latitude) ELSE COALESCE(tive_incidents.latitude, EXCLUDED.latitude) END,
        CASE WHEN preferred THEN COALESCE(EXCLUDED.longitude, tive_incidents.longitude) ELSE COALESCE(tive_incidents.longitude, EXCLUDED.longitude) END,
        CASE WHEN preferred THEN COALESCE(EXCLUDED.address, tive_incidents.address) ELSE COALESCE(tive_incidents.address, EXCLUDED.address) END
        FROM (SELECT EXCLUDED.opened_at IS NOT NULL AND
          (tive_incidents.opened_at IS NULL OR EXCLUDED.opened_at < tive_incidents.opened_at
            OR (EXCLUDED.opened_at = tive_incidents.opened_at AND EXCLUDED.recovered_at IS NULL)) AS preferred) ordering)
  `, [
    alert.accountId, alert.alertId, alert.deviceName, alert.shipmentId, alert.eventName, alert.category,
    alert.severity, alert.measuredValue, alert.openedAt, alert.recoveredAt, alert.eventAt,
    alert.latitude, alert.longitude, alert.address, alert.simulated,
  ]);
}

const visibleRow = `account_id, alert_id, device_name, shipment_id, event_name, category, severity,
  measured_value, COALESCE(opened_at, occurred_at) AS event_at, recovered_at,
  latitude, longitude, address, simulated, status, notes, notes_updated_at`;

export async function listIncidents() {
  const { rows } = await database().query(`
    SELECT ${visibleRow} FROM tive_incidents WHERE hidden_at IS NULL
    ORDER BY COALESCE(opened_at, occurred_at) DESC, received_at DESC, account_id, alert_id
    LIMIT 2001
  `);
  return { incidents: rows.slice(0, 2000), truncated: rows.length > 2000 };
}

export async function updateIncident(account, alert, field, value) {
  const assignments = {
    status: 'status = $3',
    notes: 'notes = $3, notes_updated_at = now()',
  };
  const { rows } = await database().query(`
    UPDATE tive_incidents SET ${assignments[field]} WHERE account_id = $1 AND alert_id = $2 AND hidden_at IS NULL
    RETURNING ${visibleRow}
  `, [account, alert, value]);
  return rows[0];
}

export async function hideIncidents(ids) {
  await database().query(`
    UPDATE tive_incidents AS incident SET hidden_at = now()
    FROM jsonb_to_recordset($1::jsonb) AS selected(account_id text, alert_id text)
    WHERE incident.account_id = selected.account_id AND incident.alert_id = selected.alert_id AND hidden_at IS NULL
  `, [JSON.stringify(ids)]);
}
