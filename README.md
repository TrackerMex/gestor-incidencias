# Gestor Virtual de Incidencias

Panel de TRACKER MÉXICO GPS en Astro y React. Recibe alertas de Tive y guarda en PostgreSQL la incidencia, su recuperación y el seguimiento del operador. La interfaz usa Leaflet, Chart.js y SheetJS.

Los textos de marca y protocolos sugeridos se editan en [`src/settings.js`](src/settings.js). `gestor.html` se conserva como referencia de la versión anterior. Astro redirige esa ruta al panel actual.

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

## Despliegue en el VPS

Clona este repositorio en el VPS desde una cuenta con acceso al repo y a Docker Compose. El archivo `compose.production.yaml` instala el gestor con Node.js 24 y una base PostgreSQL exclusiva del proyecto. PostgreSQL queda en la red de Compose y Astro escucha en `127.0.0.1:4325` desde el servidor. El volumen de PostgreSQL conserva las incidencias durante las actualizaciones.

Desde la raíz del repositorio en el VPS, crea la configuración de producción y conserva sus permisos restringidos:

```sh
test -f .env.production || install -m 600 .env.production.example .env.production
```

Completa `.env.production` en el VPS. Genera valores distintos para `POSTGRES_ADMIN_PASSWORD`, `GESTOR_DB_PASSWORD` y `GESTOR_ADMIN_PASSWORD` con `openssl rand -hex 32`. Usa el ID de la cuenta **Test** en `TIVE_ACCOUNT_ID` y la clave del webhook de esa cuenta en `TIVE_WEBHOOK_SECRET`. Ajusta `GESTOR_HOST_PORT` si el puerto local 4325 está ocupado. PostgreSQL usa las contraseñas de inicialización al crear el volumen por primera vez.

```sh
docker compose --env-file .env.production -f compose.production.yaml config --quiet
docker compose --env-file .env.production -f compose.production.yaml up -d --build --wait
docker compose --env-file .env.production -f compose.production.yaml ps
```

La imagen ejecuta lint, pruebas y compilación durante la construcción. Compose aplica el esquema de la base antes de iniciar Astro. Para actualizar una instalación, trae la nueva versión del repo y repite el comando `up`.

En el panel DNS de `trackersystem.tech`, agrega un registro **A** para `tive-test` con destino `72.60.228.221`. En el proxy que ya gestiona HTTPS en el VPS, añade un sitio para `tive-test.trackersystem.tech`, emite su certificado y dirige el tráfico a `http://127.0.0.1:4325`. Si cambiaste el puerto en Compose, usa el mismo en el proxy. Para NGINX en el host, esta es la configuración de la ubicación dentro del sitio HTTPS:

```nginx
location / {
    proxy_pass http://127.0.0.1:4325;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Comprueba que el panel pide autenticación y que el webhook devuelve `401` ante una solicitud sin firma. Ejecuta `curl --user gestor` con la URL del panel para verificar el acceso autenticado. `curl` te pedirá la contraseña en la terminal.

```sh
curl -i https://tive-test.trackersystem.tech/
curl -i -H 'Content-Type: application/json' -d '{}' https://tive-test.trackersystem.tech/api/webhooks/tive
```

## Conexión con la plataforma Tive

1. Publica Astro con el adaptador Node y una URL HTTPS alcanzable por Tive. Configura `DATABASE_URL` y `GESTOR_ADMIN_PASSWORD` en el servidor. Antes de iniciar la app compilada, ejecuta `npm run db:migrate`, `npm run build` y `npm start`. El acceso al panel usa el usuario `gestor` y la contraseña configurada.
2. En **Organización → Webhooks**, abre **Gestor de Incidencias - Prueba HTTPS** y configura `https://tive-test.trackersystem.tech/api/webhooks/tive` cuando el HTTPS esté verificado. Usa la cuenta **Test**, el flujo de alertas, **POST** y el formato JSON predeterminado de Tive.
3. Configura `TIVE_WEBHOOK_SECRET` en el servidor con la clave de ese webhook de Tive. Puedes configurar `TIVE_ACCOUNT_ID` para aceptar únicamente el identificador de la cuenta del piloto. Reinicia Astro tras cambiar estas variables.
4. El receptor responde `204` tras guardar una alerta firmada de la cuenta configurada. El ejemplo sintético de Tive puede devolver `403` si su cuenta difiere de `TIVE_ACCOUNT_ID`. Para probar el inicio y la recuperación de temperatura desde un rastreador, activa el webhook de **Test** y aplica un perfil de alerta de temperatura en un envío de prueba.

El webhook valida `x-tive-signature` sobre el cuerpo original, guarda una incidencia por cuenta e ID de alerta y conserva el estado operativo aunque Tive repita o reordene las entregas. El listado y los filtros trabajan con las 2,000 incidencias visibles más recientes.

[Crear un webhook en Tive](https://developers.tive.com/docs/creating-webhooks) · [Probar un webhook](https://developers.tive.com/docs/debugging-webhooks) · [Adaptador Node de Astro](https://docs.astro.build/en/guides/integrations-guide/node/)
