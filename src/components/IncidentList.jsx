import { useState } from 'react';
import { Badge } from './IncidentDetails.jsx';
import { dateKey, formatDate, incidentKey, severities, statuses } from './incident-format.js';

const emptyFilters = { search: '', severity: '', device: '', category: '', from: '', to: '' };

function SelectFilter({ id, label, value, onChange, options }) {
  return <label className="field" htmlFor={id}><span>{label}</span>
    <select className="control" id={id} value={value} onChange={onChange}>
      <option value="">Todos</option>
      {options.map(([key, name]) => <option key={key} value={key}>{name}</option>)}
    </select>
  </label>;
}

async function downloadExcel(rows) {
  const { utils, writeFileXLSX } = await import('xlsx');
  const sheet = utils.json_to_sheet(rows.map(row => ({
    ID: row.alert_id, Fecha: formatDate(row.event_at), Rastreador: row.device_name, Envío: row.shipment_id,
    Evento: row.event_name, Tipo: row.category, Severidad: severities[row.severity], Estado: statuses[row.status],
    Lectura: row.measured_value, Ubicación: row.address, Recuperación: formatDate(row.recovered_at),
    Observaciones: row.notes, Simulación: row.simulated ? 'Sí' : 'No',
  })));
  const book = utils.book_new();
  utils.book_append_sheet(book, sheet, 'Incidencias');
  writeFileXLSX(book, `incidencias-tive-${dateKey(Date.now())}.xlsx`);
}

export default function IncidentList({ rows, selected, busy, onSelect, onChange, onHide, onError, truncated }) {
  const [filters, setFilters] = useState(emptyFilters);
  const change = field => event => setFilters(current => ({ ...current, [field]: event.target.value }));
  const entries = field => [...new Set(rows.map(row => row[field]))].sort((a, b) => a.localeCompare(b, 'es')).map(value => [value, value]);
  const search = filters.search.trim().toLocaleLowerCase('es-MX');
  const visible = rows.filter(row => {
    if (filters.severity && row.severity !== filters.severity) return false;
    if (filters.device && row.device_name !== filters.device) return false;
    if (filters.category && row.category !== filters.category) return false;
    const day = dateKey(row.event_at);
    if ((filters.from && day < filters.from) || (filters.to && day > filters.to)) return false;
    return !search || [row.alert_id, row.event_name, row.device_name, row.shipment_id, row.address].join(' ').toLocaleLowerCase('es-MX').includes(search);
  });

  return <section className="panel" aria-labelledby="listTitle">
    <div className="panel-header">
      <div><h2 id="listTitle" className="panel-title">Listado de incidencias</h2><p className="panel-subtitle">{visible.length} {visible.length === 1 ? 'registro' : 'registros'}{truncated ? ' · Consulta limitada a las 2,000 más recientes' : ''}</p></div>
      <div className="button-group">
        <button className="btn secondary" onClick={() => setFilters(emptyFilters)}>Limpiar filtros</button>
        <button className="btn" disabled={!visible.length} onClick={() => void downloadExcel(visible).catch(() => onError('No se pudo exportar el archivo de Excel.'))}>Exportar Excel</button>
        <button className="btn danger" disabled={busy || !visible.length} onClick={() => {
          if (window.confirm(`¿Ocultar ${visible.length} ${visible.length === 1 ? 'incidencia del listado?' : 'incidencias del listado?'}`)) void onHide(visible);
        }}>Ocultar visibles</button>
      </div>
    </div>
    <div className="filter-grid">
      <label className="field" htmlFor="searchInput"><span>Buscar</span><input id="searchInput" className="control" type="search" value={filters.search} onChange={change('search')} /></label>
      <SelectFilter id="severityFilter" label="Severidad" value={filters.severity} onChange={change('severity')} options={Object.entries(severities)} />
      <SelectFilter id="deviceFilter" label="Rastreador" value={filters.device} onChange={change('device')} options={entries('device_name')} />
      <SelectFilter id="categoryFilter" label="Tipo" value={filters.category} onChange={change('category')} options={entries('category')} />
      <label className="field" htmlFor="fromFilter"><span>Desde</span><input id="fromFilter" className="control" type="date" value={filters.from} onChange={change('from')} /></label>
      <label className="field" htmlFor="toFilter"><span>Hasta</span><input id="toFilter" className="control" type="date" value={filters.to} onChange={change('to')} /></label>
    </div>
    <div className="table-wrap">
      <table>
        <thead><tr>{['Fecha y hora', 'Rastreador', 'Evento', 'Tipo', 'Severidad', 'Estado', 'Ubicación', 'Acción'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
        <tbody>{visible.length ? visible.map(row => {
          const key = incidentKey(row);
          return <tr key={key} className={key === selected ? 'active-row' : undefined} onClick={() => onSelect(key)}>
            <td>{formatDate(row.event_at)}</td><td>{row.device_name}</td>
            <td><button type="button" className="event-link" onClick={event => { event.stopPropagation(); onSelect(key); }}>{row.event_name}</button>{row.simulated && <span className="simulation-tag">Simulación</span>}</td>
            <td>{row.category}</td><td><Badge value={row.severity}>{severities[row.severity]}</Badge></td>
            <td><Badge value={row.status}>{statuses[row.status]}</Badge></td><td>{row.address ?? '—'}</td>
            <td>{row.status === 'SIN_CERRAR' && <button className="row-close-btn" type="button" disabled={busy} aria-label={`Cerrar incidencia ${row.alert_id}`} onClick={event => {
              event.stopPropagation(); void onChange(row, 'status', 'CERRADO');
            }}>✓</button>}</td>
          </tr>;
        }) : <tr><td colSpan={8}>{rows.length ? 'Sin coincidencias para estos filtros.' : 'Sin incidencias en esta vista.'}</td></tr>}</tbody>
      </table>
    </div>
  </section>;
}
