export const dashboard = {
  title: 'Gestor Virtual de Incidencias',
  organization: 'TRACKER MÉXICO GPS',
  tagline: 'Monitoreo y atención de alertas de Tive',
  logoUrl: 'https://i.postimg.cc/zJ26Ff39/A-VERDE.png',
  refreshMs: 5000,
};

export const protocols = {
  Temperatura: 'Verificar la lectura del sensor y el rango autorizado. Contactar al responsable del envío y registrar las acciones tomadas.',
  Geocerca: 'Verificar la ubicación del envío y confirmar el movimiento con el responsable.',
  Seguridad: 'Revisar el evento y contactar al responsable del envío para confirmar la situación.',
  Batería: 'Verificar la batería del rastreador y coordinar su reemplazo o recarga.',
  Operativa: 'Verificar el evento con el responsable del envío y registrar el seguimiento.',
};
