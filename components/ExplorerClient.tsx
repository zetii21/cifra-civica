"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CircleAlert, Layers3, Search } from "lucide-react";
import { Notice, StatusBadge } from "./Ui";
import { AUTONOMOUS_COMMUNITIES } from "@/lib/domain";

// Public demo tiles are intentionally same-origin so no runtime endpoint or
// user context is exposed to a third-party host.
const TILE_BASE = "";

const metrics = [
  { id: "demo_mean_fiscal_change_eur", label: "Cambio fiscal medio", unit: "€ / año", kind: "Simulado DEMO" },
  { id: "demo_median_fiscal_change_eur", label: "Cambio fiscal mediano", unit: "€ / año", kind: "Simulado DEMO" },
  { id: "demo_share_gain_above_500", label: "Hogares por encima del umbral", unit: "%", kind: "Simulado DEMO" },
  { id: "demo_model_uncertainty_class", label: "Incertidumbre del modelo", unit: "clase", kind: "Modelo DEMO" },
];

const demoRows = AUTONOMOUS_COMMUNITIES.slice(0, 14).map((community, index) => ({
  code: community.code,
  name: community.name,
  mean: ((index * 173) % 980) - 260,
  median: ((index * 137) % 760) - 180,
  share: 34 + ((index * 7) % 43),
  uncertainty: index % 4 === 0 ? "Alta" : index % 3 === 0 ? "Media" : "Baja",
}));

function metricValue(row: (typeof demoRows)[number], metric: string): string {
  if (metric === "demo_median_fiscal_change_eur") return `${row.median >= 0 ? "+" : ""}${row.median} €`;
  if (metric === "demo_share_gain_above_500") return `${row.share} %`;
  if (metric === "demo_model_uncertainty_class") return row.uncertainty;
  return `${row.mean >= 0 ? "+" : ""}${row.mean} €`;
}

export function ExplorerClient() {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const [metric, setMetric] = useState(metrics[0].id);
  const [query, setQuery] = useState("");
  const [threshold, setThreshold] = useState(500);
  const [mapState, setMapState] = useState<"loading" | "ready" | "unavailable">("loading");
  const selectedMetric = metrics.find((candidate) => candidate.id === metric) ?? metrics[0];
  const filteredRows = useMemo(
    () => demoRows.filter((row) => row.name.toLocaleLowerCase("es").includes(query.toLocaleLowerCase("es"))),
    [query],
  );

  useEffect(() => {
    if (!mapContainer.current) return;
    let cancelled = false;
    let mapInstance: import("maplibre-gl").Map | undefined;
    void import("maplibre-gl")
      .then(({ default: maplibregl }) => {
        if (cancelled || !mapContainer.current) return;
        mapInstance = new maplibregl.Map({
          container: mapContainer.current,
          center: [-3.7, 40.15],
          zoom: 4.25,
          minZoom: 3.5,
          maxZoom: 10,
          attributionControl: false,
          style: {
            version: 8,
            sources: {
              "cifra-civica-demo": {
                type: "vector",
                tiles: [`${TILE_BASE}/tiles/demo-es-2027.1/{z}/{x}/{y}.mvt`],
                minzoom: 0,
                maxzoom: 10,
              },
            },
            layers: [
              { id: "background", type: "background", paint: { "background-color": "#e8ece5" } },
              {
                id: "autonomous-fill",
                type: "fill",
                source: "cifra-civica-demo",
                "source-layer": "autonomous_communities",
                paint: {
                  "fill-color": [
                    "match",
                    ["get", "territorial_support"],
                    "unsupported",
                    "#c6c8c2",
                    "partial",
                    "#d6aa62",
                    "#4c9686",
                  ],
                  "fill-opacity": 0.82,
                  "fill-outline-color": "#f8f6ef",
                },
              },
              {
                id: "municipality-lines",
                type: "line",
                source: "cifra-civica-demo",
                "source-layer": "municipalities",
                minzoom: 6,
                paint: { "line-color": "#173f3e", "line-width": 0.55, "line-opacity": 0.45 },
              },
            ],
          },
        });
        mapInstance.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
        mapInstance.on("load", () => !cancelled && setMapState("ready"));
        mapInstance.on("error", () => !cancelled && setMapState("unavailable"));
      })
      .catch(() => !cancelled && setMapState("unavailable"));
    return () => {
      cancelled = true;
      mapInstance?.remove();
    };
  }, []);

  return (
    <div className="explorer-layout">
      <aside className="explorer-controls">
        <div className="control-heading"><Layers3 aria-hidden="true" /><div><span>Capa visible</span><strong>{selectedMetric.label}</strong></div></div>
        <div className="field">
          <label htmlFor="map-metric">Métrica</label>
          <select id="map-metric" value={metric} onChange={(event) => setMetric(event.target.value)}>
            {metrics.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.label}</option>)}
          </select>
        </div>
        <div className="field search-field">
          <label htmlFor="place-search">Buscar lugar</label>
          <div><Search size={16} aria-hidden="true" /><input id="place-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Comunidad o municipio" /></div>
        </div>
        <div className="field range-field">
          <label htmlFor="threshold">Umbral de ganancia: {threshold} €</label>
          <input id="threshold" type="range" min="0" max="2000" step="100" value={threshold} onChange={(event) => setThreshold(Number(event.target.value))} />
        </div>
        <div className="map-legend" aria-label="Leyenda del mapa">
          <strong>Leyenda territorial</strong>
          <span><i className="legend-supported" /> Arquitectura soportada</span>
          <span><i className="legend-partial" /> Cobertura parcial</span>
          <span><i className="legend-unsupported" /> No compatible</span>
          <span><i className="legend-hatched" /> Incertidumbre / DEMO</span>
        </div>
        <Notice tone="warning" title="Capa sintética">
          Los valores listados son fixtures reproducibles, no estadísticas oficiales ni
          estimaciones publicables. El servicio de teselas solo contiene geometría de muestra.
        </Notice>
      </aside>

      <div className="explorer-main">
        <div className="map-shell">
          <div ref={mapContainer} className="map-container" role="img" aria-label="Mapa vectorial de España con cobertura territorial del modelo" />
          <div className="map-overlay-top">
            <StatusBadge tone="demo">DEMO · MVT</StatusBadge>
            <span>Geografía demo-es-2027.1</span>
          </div>
          {mapState !== "ready" ? (
            <div className="map-state" role="status">
              <CircleAlert aria-hidden="true" />
              <strong>{mapState === "loading" ? "Cargando teselas vectoriales…" : "Servicio local de teselas no disponible"}</strong>
              <span>{mapState === "unavailable" ? "La tabla accesible permanece disponible aunque las teselas no se hayan podido cargar." : ""}</span>
            </div>
          ) : null}
          <div className="demo-watermark" aria-hidden="true">DEMO · NO OFICIAL</div>
        </div>

        <section className="linked-chart">
          <div className="linked-chart-heading"><div><span>Distribución vinculada</span><h2>{selectedMetric.label}</h2></div><StatusBadge tone="demo">{selectedMetric.kind}</StatusBadge></div>
          <div className="bar-list" aria-hidden="true">
            {filteredRows.slice(0, 8).map((row) => {
              const raw = metric === "demo_share_gain_above_500" ? row.share : metric === "demo_median_fiscal_change_eur" ? row.median : row.mean;
              return <div key={row.code}><span>{row.name}</span><i style={{ width: `${Math.max(8, Math.min(100, Math.abs(raw) / 10))}%` }} className={raw < 0 ? "negative-bar" : ""} /><b>{metricValue(row, metric)}</b></div>;
            })}
          </div>
          <div className="table-scroll">
            <table className="map-data-table">
              <caption>Alternativa tabular de la capa {selectedMetric.label}</caption>
              <thead><tr><th>Territorio</th><th>Valor DEMO</th><th>Incertidumbre</th><th>Fuente</th></tr></thead>
              <tbody>{filteredRows.map((row) => <tr key={row.code}><th scope="row">{row.name}</th><td>{metricValue(row, metric)}</td><td>{row.uncertainty}</td><td>Fixture sintético 2027.1</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
