CREATE TABLE IF NOT EXISTS tive_incidents (
  account_id text NOT NULL,
  alert_id text NOT NULL,
  device_name text NOT NULL,
  shipment_id text,
  event_name text NOT NULL,
  category text NOT NULL,
  severity text NOT NULL,
  measured_value text,
  opened_at timestamptz,
  recovered_at timestamptz,
  occurred_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  latitude double precision,
  longitude double precision,
  address text,
  simulated boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'SIN_CERRAR' CHECK (status IN ('SIN_CERRAR', 'CERRADO')),
  notes text NOT NULL DEFAULT '',
  notes_updated_at timestamptz,
  hidden_at timestamptz,
  PRIMARY KEY (account_id, alert_id)
);

CREATE INDEX IF NOT EXISTS tive_incidents_visible_date
  ON tive_incidents ((COALESCE(opened_at, occurred_at)) DESC)
  WHERE hidden_at IS NULL;

-- The Tive Platform test uses the nil UUID for its example alert.
UPDATE tive_incidents SET simulated = true
WHERE alert_id = '00000000-0000-0000-0000-000000000000' AND NOT simulated;
