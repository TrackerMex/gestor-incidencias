import { useEffect, useRef } from "react";

export default function IncidentMap({ incident }) {
  const mapNode = useRef(null);
  const hasLocation =
    Number.isFinite(incident?.latitude) && Number.isFinite(incident?.longitude);
  const {
    latitude,
    longitude,
    device_name: deviceName,
    address,
  } = incident ?? {};

  useEffect(() => {
    if (!hasLocation) return;
    let map;
    let active = true;
    void import("leaflet")
      .then(({ default: L }) => {
        if (!active || !mapNode.current) return;
        const position = [latitude, longitude];
        map = L.map(mapNode.current, { scrollWheelZoom: false }).setView(
          position,
          15,
        );
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(map);
        const marker = L.circleMarker(position, {
          radius: 9,
          color: "#fff",
          weight: 3,
          fillColor: "#1665dc",
          fillOpacity: 1,
        });
        const popup = document.createElement("div");
        popup.textContent = [deviceName, address].filter(Boolean).join(" · ");
        marker.addTo(map).bindPopup(popup);
      })
      .catch(console.error);
    return () => {
      active = false;
      map?.remove();
    };
  }, [hasLocation, latitude, longitude, deviceName, address]);

  return (
    <div className="map-card">
      <div className="map-wrap">
        <div id="eventMap" ref={mapNode} aria-label="Mapa de la incidencia" />
        {!hasLocation && (
          <div className="map-empty">
            {incident
              ? "Tive no reportó coordenadas para esta alerta."
              : "Selecciona una incidencia para ver su ubicación."}
          </div>
        )}
      </div>
      {hasLocation && (
        <div className="map-caption">
          <strong>Coordenadas</strong>
          <span>
            {latitude.toFixed(5)}, {longitude.toFixed(5)}
          </span>
        </div>
      )}
    </div>
  );
}
