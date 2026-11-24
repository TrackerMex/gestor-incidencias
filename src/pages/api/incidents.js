import {
  hideIncidents,
  listIncidents,
  updateIncident,
} from "../../server/db.js";

const unavailable = () =>
  Response.json(
    { error: "El almacenamiento de incidencias no está disponible." },
    { status: 503 },
  );

export async function GET() {
  try {
    return Response.json(await listIncidents(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("No se pudo consultar las incidencias:", error.code);
    return unavailable();
  }
}

function validId(id) {
  return (
    typeof id?.account_id === "string" &&
    id.account_id.length > 0 &&
    id.account_id.length <= 80 &&
    typeof id?.alert_id === "string" &&
    id.alert_id.length > 0 &&
    id.alert_id.length <= 150
  );
}

export async function PATCH({ request }) {
  if (
    request.headers.get("content-type")?.split(";")[0].trim() !==
    "application/json"
  ) {
    return Response.json(
      { error: "Se requiere application/json" },
      { status: 415 },
    );
  }
  const body = await request.json().catch(() => null);
  const { field, value } = body ?? {};
  try {
    if (
      field === "hide" &&
      Array.isArray(value) &&
      value.length <= 2000 &&
      value.every(validId)
    ) {
      await hideIncidents(value);
      return new Response(null, { status: 204 });
    }
    const validValue =
      (field === "status" && ["CERRADO", "SIN_CERRAR"].includes(value)) ||
      (field === "notes" && typeof value === "string" && value.length <= 4000);
    if (!validId(body) || !validValue)
      return Response.json({ error: "Cambio inválido" }, { status: 400 });

    const incident = await updateIncident(
      body.account_id,
      body.alert_id,
      field,
      value.trim(),
    );
    if (!incident)
      return Response.json(
        { error: "Incidencia no encontrada" },
        { status: 404 },
      );
    return Response.json(incident);
  } catch (error) {
    console.error("No se pudo guardar el seguimiento:", error.code);
    return unavailable();
  }
}
