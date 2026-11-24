import { useEffect, useRef, useState } from "react";
import { dateKey, severities } from "./incident-format.js";

const palette = [
  "#17d8ff",
  "#5f86ff",
  "#a78bfa",
  "#45d58b",
  "#ffc857",
  "#ff647f",
];
const hour = new Intl.DateTimeFormat("en-GB", {
  timeZone: "America/Mexico_City",
  hour: "2-digit",
  hourCycle: "h23",
});

function countBy(rows, key) {
  const counts = new Map();
  for (const row of rows) {
    const label = key(row);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1]);
}

function Chart({ type, data, label }) {
  const canvas = useRef(null);
  useEffect(() => {
    let active = true;
    let chart;
    void import("chart.js/auto")
      .then(({ default: ChartJS }) => {
        if (!active) return;
        chart = new ChartJS(canvas.current, {
          type,
          data: {
            labels: data.map(([name]) => name),
            datasets: [
              {
                label,
                data: data.map(([, count]) => count),
                backgroundColor: type === "line" ? palette[0] : palette,
                borderColor: type === "line" ? palette[0] : "#0c152b",
                borderWidth: 2,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            color: "#eef6ff",
            plugins: {
              legend: {
                display: type === "doughnut",
                labels: { color: "#eef6ff" },
              },
            },
            ...(type === "doughnut"
              ? {}
              : {
                  scales: {
                    x: {
                      ticks: { color: "#9db1d7" },
                      grid: { color: "#ffffff0c" },
                    },
                    y: {
                      beginAtZero: true,
                      ticks: { color: "#9db1d7", precision: 0 },
                      grid: { color: "#ffffff0c" },
                    },
                  },
                }),
          },
        });
      })
      .catch(console.error);
    return () => {
      active = false;
      chart?.destroy();
    };
  }, [type, data, label]);
  return (
    <div className="analytics-card">
      <h3>{label}</h3>
      <div className="chart-wrap">
        {data.some(([, count]) => count > 0) ? (
          <canvas ref={canvas} aria-label={label} role="img" />
        ) : (
          <p>Sin datos para el periodo.</p>
        )}
      </div>
    </div>
  );
}

function Ranking({ title, rows }) {
  return (
    <div className="analytics-card">
      <h3>{title}</h3>
      <div className="ranking-list">
        {rows.length ? (
          rows.map(([label, count], index) => (
            <div className="ranking-row" key={label}>
              <span className="rank">{index + 1}</span>
              <span>{label}</span>
              <span className="value">{count}</span>
            </div>
          ))
        ) : (
          <p>Sin datos para el periodo.</p>
        )}
      </div>
    </div>
  );
}

export default function Analytics({ incidents, now }) {
  const [period, setPeriod] = useState("today");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const today = dateKey(now);
  const weekStart = dateKey(now - 6 * 86_400_000);
  const rows = incidents.filter((row) => {
    const day = dateKey(row.event_at);
    if (period === "today") return day === today;
    if (period === "24h") return Date.parse(row.event_at) >= now - 86_400_000;
    if (period === "7d") return day >= weekStart;
    return (!from || day >= from) && (!to || day <= to);
  });
  const byType = countBy(rows, (row) => row.category);
  const units = countBy(rows, (row) => row.device_name);
  const repeated = countBy(
    rows,
    (row) => `${row.device_name} · ${row.category}`,
  ).filter(([, count]) => count > 1);
  const closed = rows.filter((row) => row.status === "CERRADO").length;
  const severityCounts = new Map(countBy(rows, (row) => row.severity));
  const bySeverity = Object.entries(severities).map(([key, name]) => [
    name,
    severityCounts.get(key) ?? 0,
  ]);
  const hourlyCounts = new Map(
    countBy(rows, (row) => hour.format(new Date(row.event_at))),
  );
  const byHour = Array.from({ length: 24 }, (_, h) => {
    const key = String(h).padStart(2, "0");
    return [`${key}:00`, hourlyCounts.get(key) ?? 0];
  });
  const metrics = [
    ["Total", rows.length],
    ["Cerradas", closed],
    [
      "Atención",
      `${rows.length ? ((100 * closed) / rows.length).toFixed(1) : "0"}%`,
    ],
    ["Rastreadores con alertas", units.length],
  ];

  return (
    <section className="panel" aria-labelledby="analyticsTitle">
      <div className="panel-header">
        <h2 id="analyticsTitle" className="panel-title">
          Analítica de incidencias
        </h2>
      </div>
      <div className="analytics-filters">
        <label className="field">
          <span>Periodo</span>
          <select
            className="control"
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
          >
            <option value="today">Hoy</option>
            <option value="24h">Últimas 24 horas</option>
            <option value="7d">Últimos 7 días</option>
            <option value="custom">Personalizado</option>
          </select>
        </label>
        {period === "custom" && (
          <>
            <label className="field">
              <span>Desde</span>
              <input
                type="date"
                className="control"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
            </label>
            <label className="field">
              <span>Hasta</span>
              <input
                type="date"
                className="control"
                value={to}
                onChange={(event) => setTo(event.target.value)}
              />
            </label>
          </>
        )}
      </div>
      <div className="analytics-kpis">
        {metrics.map(([label, value]) => (
          <article key={label} className="analytics-kpi">
            <small>{label}</small>
            <strong>{value}</strong>
          </article>
        ))}
      </div>
      <div className="analytics-grid">
        <Chart type="bar" data={byType} label="Incidencias por tipo" />
        <Chart type="line" data={byHour} label="Evolución por hora" />
        <Chart
          type="doughnut"
          data={bySeverity}
          label="Distribución por severidad"
        />
        <Ranking title="Top 10 rastreadores" rows={units.slice(0, 10)} />
        <Ranking
          title="Rastreadores reincidentes"
          rows={repeated.slice(0, 10)}
        />
      </div>
    </section>
  );
}
