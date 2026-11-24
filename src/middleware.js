import { createHash, timingSafeEqual } from 'node:crypto';
import { defineMiddleware } from 'astro:middleware';

function digest(value) {
  return createHash('sha256').update(value).digest();
}

export const onRequest = defineMiddleware(async ({ request, url }, next) => {
  if (url.pathname === '/api/webhooks/tive' || url.pathname === '/api/webhooks/tive/') return next();

  const password = process.env.GESTOR_ADMIN_PASSWORD;
  if (!password) {
    if (import.meta.env.DEV) return next();
    return new Response('Configura el acceso al gestor.', { status: 503 });
  }

  const expected = `Basic ${Buffer.from(`gestor:${password}`).toString('base64')}`;
  const provided = request.headers.get('authorization') ?? '';
  if (!timingSafeEqual(digest(provided), digest(expected))) {
    return new Response('Autenticación requerida.', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Gestor de incidencias", charset="UTF-8"' },
    });
  }
  return next();
});
