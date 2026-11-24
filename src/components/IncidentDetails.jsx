import { useState } from 'react';
import { protocols } from '../settings.js';
import IncidentMap from './IncidentMap.jsx';
import { formatDate, incidentKey, severities, statuses } from './incident-format.js';

export function Badge({ value, children }) {
  return <span className={`badge ${value}`}>{children}</span>;
}

function Info({ label, children, full = false }) {
  return <div className={full ? 'info-card full' : 'info-card'}><small>{label}</small><strong>{children || '—'}</strong></div>;
}

function Notes({ incident, busy, onChange }) {
  const [draft, setDraft] = useState(null);
  const savedNotes = incident?.notes ?? '';
  const notes = draft ?? savedNotes;

  async function save(text) {
    if (await onChange(incident, 'notes', text)) setDraft(null);
  }

  return <div className="notes-box info-card full">
    <label htmlFor="monitorNotes">Observaciones del operador</label>
    <textarea id="monitorNotes" maxLength={4000} value={notes} disabled={!incident || busy} onChange={event => setDraft(event.target.value)} />
    <div className="notes-meta">
      <span>{incident?.notes_updated_at ? `Actualizado ${formatDate(incident.notes_updated_at)}` : 'Sin observaciones guardadas'}</span>
      <div className="button-group">
        <button className="btn secondary" disabled={!incident || busy || (!notes && !savedNotes)} onClick={() => {
          if (savedNotes) void save('');
          else setDraft(null);
        }}>Limpiar</button>
        <button className="btn" disabled={!incident || busy || savedNotes === notes.trim()} onClick={() => void save(notes)}>Guardar observaciones</button>
      </div>
    </div>
  </div>;
}

export default function IncidentDetails({ incident, busy, onChange, voiceLog }) {
  const pending = incident?.status === 'SIN_CERRAR';
  const remoteStatus = incident?.recovered_at ? `Recuperada · ${formatDate(incident.recovered_at)}` : 'Alerta recibida';
  return <section className="panel" aria-labelledby="activeTitle">
    <div className="panel-header">
      <h2 className="panel-title" id="activeTitle">Incidencia activa</h2>
      {incident && <button className={`btn ${pending ? 'success' : 'secondary'}`} disabled={busy}
        onClick={() => void onChange(incident, 'status', pending ? 'CERRADO' : 'SIN_CERRAR')}>
        {pending ? 'Marcar como cerrada' : 'Reabrir incidencia'}
      </button>}
    </div>
    <div className="incident-layout">
      <div className="info-grid">
        <Info label="Rastreador">{incident?.device_name}</Info>
        <Info label="Severidad">{incident && <Badge value={incident.severity}>{severities[incident.severity]}</Badge>}</Info>
        <Info label="Evento">{incident && <>{incident.event_name}{incident.simulated && <span className="simulation-tag">Simulación</span>}</>}</Info>
        <Info label="Tipo">{incident?.category}</Info>
        <Info label="Fecha y hora">{incident && formatDate(incident.event_at)}</Info>
        <Info label="Lectura de la alerta">{incident?.measured_value}</Info>
        <Info label="Envío">{incident?.shipment_id}</Info>
        <Info label="ID de alerta"><span className="break-id">{incident?.alert_id ?? '—'}</span></Info>
        <Info label="Estado del operador">{incident && <Badge value={incident.status}>{statuses[incident.status]}</Badge>}</Info>
        <Info label="Estado en Tive">{incident && remoteStatus}</Info>
        <Info label="Ubicación" full>{incident?.address}</Info>
        <Info label="Protocolo sugerido" full>{incident && (protocols[incident.category] ?? protocols.Operativa)}</Info>
        <Notes key={incident ? incidentKey(incident) : 'none'} incident={incident} busy={busy} onChange={onChange} />
      </div>
      <div className="map-stack">
        <IncidentMap incident={incident} />
        <div>
          <h3>Bitácora de voz</h3>
          <div className="voice-log" aria-live="polite">
            {voiceLog.length ? voiceLog.map(entry => <div className="voice-item" key={entry.id}><small>{formatDate(entry.at)}</small>{entry.text}</div>) : <p className="panel-subtitle">Sin anuncios recientes.</p>}
          </div>
        </div>
      </div>
    </div>
  </section>;
}
