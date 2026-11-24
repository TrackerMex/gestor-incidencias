import { memo, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { dashboard } from '../settings.js';
import { formatDate, incidentKey } from './incident-format.js';
import Analytics from './Analytics.jsx';
import IncidentDetails from './IncidentDetails.jsx';
import IncidentList from './IncidentList.jsx';

const MemoAnalytics = memo(Analytics);
const tabs = [['monitor', 'Monitoreo'], ['history', 'Histórico'], ['analytics', 'Analítica']];
const requestTimeoutMs = 10_000;

async function requestIncidents(signal) {
  const response = await fetch('/api/incidents', { signal, cache: 'no-store' });
  if (!response.ok) throw new Error('Almacenamiento no disponible');
  return response.text();
}

function useIncidents() {
  const [data, setData] = useState({ incidents: [], truncated: false });
  const [connection, setConnection] = useState('checking');
  const [checkedAt, setCheckedAt] = useState(null);
  const currentRequest = useRef(null);
  const lastResponse = useRef(null);

  const refresh = useCallback((replace = false) => {
    if (currentRequest.current && !replace) return currentRequest.current.done;
    currentRequest.current?.controller.abort();

    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(requestTimeoutMs)]);
    const request = { controller };
    request.done = requestIncidents(signal).then(text => {
      if (controller.signal.aborted) return false;
      if (lastResponse.current !== text) {
        setData(JSON.parse(text));
        lastResponse.current = text;
      }
      setConnection('ready');
      setCheckedAt(Date.now());
      return true;
    }).catch(() => {
      if (!controller.signal.aborted) setConnection('error');
      return false;
    }).finally(() => {
      if (currentRequest.current === request) currentRequest.current = null;
    });
    currentRequest.current = request;
    return request.done;
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), dashboard.refreshMs);
    return () => {
      window.clearInterval(timer);
      currentRequest.current?.controller.abort();
      currentRequest.current = null;
    };
  }, [refresh]);

  return { ...data, connection, checkedAt, refresh };
}

const noSpeech = { supported: false, voices: [] };
let speechSnapshot = noSpeech;

function getSpeechSnapshot() {
  const speech = window.speechSynthesis;
  if (!speech) return noSpeech;
  const voices = speech.getVoices().filter(voice => /^es/i.test(voice.lang));
  const previousVoices = speechSnapshot.voices;
  if (!speechSnapshot.supported || previousVoices.length !== voices.length ||
    voices.some((voice, index) => voice.voiceURI !== previousVoices[index].voiceURI)) {
    speechSnapshot = { supported: true, voices };
  }
  return speechSnapshot;
}

function subscribeToVoices(onChange) {
  const speech = window.speechSynthesis;
  speech?.addEventListener('voiceschanged', onChange);
  return () => speech?.removeEventListener('voiceschanged', onChange);
}

function useVoice(incidents, loaded) {
  const [enabled, setEnabled] = useState(false);
  const [severity, setSeverity] = useState('all');
  const [selectedVoice, setSelectedVoice] = useState('');
  const [log, setLog] = useState([]);
  const previous = useRef(null);
  const { supported, voices } = useSyncExternalStore(subscribeToVoices, getSpeechSnapshot, () => noSpeech);

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  const speak = useCallback(text => {
    if (!supported) return;
    const speech = new SpeechSynthesisUtterance(text);
    speech.voice = voices.find(voice => voice.voiceURI === selectedVoice) ?? voices.find(voice => voice.lang.toLowerCase() === 'es-mx') ?? voices[0] ?? null;
    speech.lang = speech.voice?.lang ?? 'es-MX';
    window.speechSynthesis.speak(speech);
  }, [supported, voices, selectedVoice]);

  useEffect(() => {
    if (!loaded) return;
    const seen = previous.current;
    previous.current = new Set(incidents.map(incidentKey));
    if (!seen || !enabled) return;

    const fresh = incidents.filter(incident => !seen.has(incidentKey(incident)) && incident.status === 'SIN_CERRAR'
      && (severity === 'all' || incident.severity === 'CRITICA' || (severity === 'relevant' && incident.severity === 'RELEVANTE')));
    if (!fresh.length) return;
    const entries = fresh.slice(0, 3).map(incident => ({
      id: incidentKey(incident), at: Date.now(),
      text: `${incident.simulated ? 'Simulación. ' : ''}${incident.event_name}. ${incident.device_name}.${incident.measured_value ? ` ${incident.measured_value}.` : ''}`,
    }));
    for (const entry of entries.toReversed()) speak(entry.text);
    setLog(current => [...entries, ...current].slice(0, 15));
  }, [enabled, incidents, loaded, severity, speak]);

  function toggle() {
    if (enabled) window.speechSynthesis.cancel();
    else speak('Avisos de voz activados.');
    setEnabled(!enabled);
  }
  return { enabled, supported, severity, setSeverity, voices, selectedVoice, setSelectedVoice, log, speak, toggle };
}

function Header({ connection, checkedAt, refresh, voice }) {
  const connectionText = { ready: 'Almacenamiento disponible', checking: 'Conectando al almacenamiento', error: 'Almacenamiento sin conexión' };
  const connectionClass = { ready: ' ok', checking: '', error: ' critical' };
  return <header className="hero">
    <div className="hero-center">
      <img className="dashboard-logo" src={dashboard.logoUrl} alt={dashboard.organization} width="86" height="86" />
      <div><h1>{dashboard.title}</h1><p>{dashboard.tagline}</p></div>
      <div className="status-strip">
        <span className={`pill${connectionClass[connection]}`} aria-live="polite"><span className="dot" />{connectionText[connection]}</span>
        <span className={`pill${voice.enabled ? ' ok' : ''}`}><span className="dot" />{voice.enabled ? 'Voz activa' : voice.supported ? 'Voz desactivada' : 'Voz sin activar'}</span>
        {checkedAt && <span className="pill"><time dateTime={new Date(checkedAt).toISOString()}>Actualizado {formatDate(checkedAt)}</time></span>}
      </div>
    </div>
    <div className="hero-toolbar">
      <div className="mini-panel"><small>Fuente de datos</small><strong>Webhook de Tive</strong></div>
      <label className="mini-panel"><small>Voz seleccionada</small><select className="control" value={voice.selectedVoice} disabled={!voice.supported} onChange={event => voice.setSelectedVoice(event.target.value)}>
        <option value="">Español predeterminado</option>{voice.voices.map(item => <option value={item.voiceURI} key={item.voiceURI}>{item.name}</option>)}
      </select></label>
      <label className="mini-panel"><small>Anunciar</small><select className="control" value={voice.severity} onChange={event => voice.setSeverity(event.target.value)}>
        <option value="all">Todas las severidades</option><option value="critical">Solo críticas</option><option value="relevant">Críticas y relevantes</option>
      </select></label>
      <div className="mini-actions">
        <button className="btn secondary" disabled={!voice.supported} onClick={voice.toggle}>{voice.enabled ? 'Silenciar voz' : 'Activar voz'}</button>
        <button className="btn secondary" disabled={!voice.supported} onClick={() => voice.speak('Prueba de voz del gestor de incidencias.')}>Probar voz</button>
        <button className="btn" onClick={() => void refresh()}>Actualizar</button>
      </div>
    </div>
  </header>;
}

function Metrics({ incidents }) {
  const totals = { SIN_CERRAR: 0, CERRADO: 0, CRITICA: 0, RELEVANTE: 0, ORDINARIA: 0 };
  for (const incident of incidents) {
    totals[incident.status]++;
    totals[incident.severity]++;
  }
  const boxes = [
    ['Pendientes', totals.SIN_CERRAR, 'normal'], ['Críticas', totals.CRITICA, 'critical'], ['Relevantes', totals.RELEVANTE, 'relevant'],
    ['Ordinarias', totals.ORDINARIA, 'normal'], ['Cerradas', totals.CERRADO, 'closed'],
  ];
  return <section className="kpis" aria-label="Resumen de incidencias">
    {boxes.map(([label, value, style]) => <article className={`kpi ${style}`} key={label}><span>{label}</span><strong className="value">{value}</strong></article>)}
  </section>;
}

export default function Dashboard() {
  const { incidents, truncated, connection, checkedAt, refresh } = useIncidents();
  const voice = useVoice(incidents, checkedAt !== null);
  const [view, setView] = useState('monitor');
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const rows = incidents.filter(incident => view === 'history' ? incident.status === 'CERRADO' : incident.status === 'SIN_CERRAR');
  const active = rows.find(incident => incidentKey(incident) === selected) ?? rows[0];

  async function save(change) {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/incidents', {
        method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(change),
        signal: AbortSignal.timeout(requestTimeoutMs),
      });
      if (!response.ok) throw new Error('No se pudo guardar el cambio.');
      return await refresh(true);
    } catch {
      setError('No se pudo confirmar el cambio. Actualiza el listado y verifica si se guardó.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  function onChange(incident, field, value) {
    return save({ account_id: incident.account_id, alert_id: incident.alert_id, field, value });
  }

  function onHide(visible) {
    return save({ field: 'hide', value: visible.map(({ account_id, alert_id }) => ({ account_id, alert_id })) });
  }

  return <main className="shell">
    <Header connection={connection} checkedAt={checkedAt} refresh={refresh} voice={voice} />
    <nav className="app-nav" aria-label="Vistas del gestor">
      {tabs.map(([key, label]) => <button className={`app-nav-btn${view === key ? ' active' : ''}`} type="button" aria-pressed={view === key} key={key} onClick={() => { setView(key); setSelected(null); }}>{label}</button>)}
    </nav>
    {error && <p className="alarm-strip" role="alert">{error}</p>}
    {view === 'analytics' ? <MemoAnalytics incidents={incidents} now={Math.floor((checkedAt ?? 0) / 60_000) * 60_000} /> : <>
      {view === 'monitor' && <Metrics incidents={incidents} />}
      <IncidentDetails incident={active} busy={busy} onChange={onChange} voiceLog={voice.log} />
      <IncidentList key={view} rows={rows} selected={active && incidentKey(active)} busy={busy} onSelect={setSelected} onChange={onChange} onHide={onHide} onError={setError} truncated={truncated} />
    </>}
  </main>;
}
