export const severities = { CRITICA: 'Crítica', RELEVANTE: 'Relevante', ORDINARIA: 'Ordinaria' };
export const statuses = { SIN_CERRAR: 'Sin cerrar', CERRADO: 'Cerrado' };

const dateTime = new Intl.DateTimeFormat('es-MX', {
  dateStyle: 'short', timeStyle: 'medium', timeZone: 'America/Mexico_City',
});
const calendarDate = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/Mexico_City',
});

export function incidentKey(incident) {
  return JSON.stringify([incident.account_id, incident.alert_id]);
}

export function formatDate(value) {
  return value ? dateTime.format(new Date(value)) : '—';
}

export function dateKey(value) {
  return calendarDate.format(new Date(value));
}
