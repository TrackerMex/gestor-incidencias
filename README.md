# Gestor Virtual de Incidencias

Panel de TRACKER MÉXICO GPS en Astro y React. Recibe alertas de Tive y guarda en PostgreSQL la incidencia, su recuperación y el seguimiento del operador. La interfaz usa Leaflet, Chart.js y SheetJS.

Los textos de marca y protocolos sugeridos se editan en [`src/settings.js`](src/settings.js). El archivo `gestor.html` es la versión anterior conectada a Wialon. En Astro, su ruta redirige al panel actual.

## Prueba local

Usa Node.js 24.16 o una versión posterior de la rama 24. Node.js 26.3 o posterior también es compatible. Con Docker en ejecución, estos pasos levantan un PostgreSQL local. Si ya tienes un PostgreSQL para desarrollo, configura su `DATABASE_URL` en `.env`.

```powershell
npm install
Copy-Item .env.example .env
docker compose up -d --wait postgres
npm run db:migrate
npm run dev -- --host 127.0.0.1
```

Abre [el panel local](http://127.0.0.1:4321/) y ejecuta en otra terminal:

```powershell
npm run tive:simulate -- --base http://127.0.0.1:4321 --id sim-temperature-demo
```

En unos segundos, Monitoreo debe mostrar **Temperatura fuera de rango**, **12.4 °C** y la etiqueta **Simulación**. Repetir el comando con el mismo ID actualiza la misma incidencia. Para simular la recuperación:

```powershell
npm run tive:simulate -- --base http://127.0.0.1:4321 --id sim-temperature-demo --recover
```

El estado en Tive cambia a **Recuperada**. El operador puede documentar la atención, cerrar la incidencia y consultarla en **Histórico**. El panel consulta las incidencias cada cinco segundos.

## Verificación antes de publicar

```powershell
npm ci
npm run lint
npm test
npm run build
```

ESLint revisa JavaScript, componentes de Astro y los hooks de React. Las pruebas del webhook pueden ejecutarse sin PostgreSQL. Los eventos enviados con **Ejemplo de datos de alerta** desde Tive se identifican como simulaciones en el panel.

## Conexión con la plataforma Tive

1. Publica Astro con el adaptador Node y una URL HTTPS alcanzable por Tive. Configura `DATABASE_URL` y `GESTOR_ADMIN_PASSWORD` en el servidor. Antes de iniciar la app compilada, ejecuta `npm run db:migrate`, `npm run build` y `npm start`. El acceso al panel usa el usuario `gestor` y la contraseña configurada.
2. En **Organización → Webhooks**, crea un webhook con la cuenta que quieras usar, preferentemente **Test** para un piloto. Selecciona el flujo de alertas, el método **POST**, el tipo **application/json** y el formato JSON predeterminado de Tive. La URL debe apuntar a `/api/webhooks/tive` en el dominio del gestor.
3. Configura `TIVE_WEBHOOK_SECRET` en el servidor con la clave de ese webhook de Tive. Puedes configurar `TIVE_ACCOUNT_ID` para aceptar únicamente el identificador de la cuenta del piloto. Reinicia Astro tras cambiar estas variables.
4. Abre **Prueba** en el menú del nuevo webhook y elige **Ejemplo de datos de alerta**. El receptor responde `204` tras guardar la alerta. Para probar el inicio y la recuperación de temperatura desde un rastreador, configura un perfil de alerta de temperatura en un envío de prueba.

El webhook valida `x-tive-signature` sobre el cuerpo original, guarda una incidencia por cuenta e ID de alerta y conserva el estado operativo aunque Tive repita o reordene las entregas. El listado y los filtros trabajan con las 2,000 incidencias visibles más recientes.

[Crear un webhook en Tive](https://developers.tive.com/docs/creating-webhooks) · [Probar un webhook](https://developers.tive.com/docs/debugging-webhooks) · [Adaptador Node de Astro](https://docs.astro.build/en/guides/integrations-guide/node/)
