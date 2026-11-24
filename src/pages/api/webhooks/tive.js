import { saveTiveAlert } from "../../../server/db.js";
import {
  normalizeTiveAlert,
  verifyTiveSignature,
} from "../../../server/tive.mjs";

const maximumBytes = 512 * 1024;

async function readBody(request) {
  if (
    !request.body ||
    Number(request.headers.get("content-length")) > maximumBytes
  )
    return null;
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return Buffer.concat(chunks, size);
      size += value.byteLength;
      if (size > maximumBytes) {
        await reader.cancel().catch(() => {});
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
}

export async function POST({ request }) {
  const secret = process.env.TIVE_WEBHOOK_SECRET;
  if (!secret)
    return Response.json({ error: "Webhook sin configurar" }, { status: 503 });

  if (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  ) {
    return Response.json(
      { error: "Se requiere application/json" },
      { status: 415 },
    );
  }

  const signature = request.headers.get("x-tive-signature");
  if (!signature)
    return Response.json({ error: "Firma inválida" }, { status: 401 });

  let body;
  try {
    body = await readBody(request);
  } catch {
    return Response.json(
      { error: "No se pudo leer el cuerpo de la solicitud" },
      { status: 400 },
    );
  }
  if (!body)
    return Response.json(
      { error: "El cuerpo supera el tamaño permitido o está ausente" },
      { status: 413 },
    );
  if (!verifyTiveSignature(secret, signature, body)) {
    return Response.json({ error: "Firma inválida" }, { status: 401 });
  }

  let payload;
  try {
    payload = JSON.parse(body.toString("utf8"));
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }

  const incident = normalizeTiveAlert(payload);
  if (!incident)
    return Response.json(
      { error: "El mensaje no contiene una alerta válida de Tive" },
      { status: 422 },
    );
  const account = process.env.TIVE_ACCOUNT_ID;
  if (account && incident.accountId !== account)
    return Response.json({ error: "Cuenta no autorizada" }, { status: 403 });

  try {
    await saveTiveAlert(incident);
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("No se pudo guardar la alerta de Tive:", error.code);
    return Response.json(
      { error: "Almacenamiento no disponible" },
      { status: 503 },
    );
  }
}
