"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Layers3, Search } from "lucide-react";
import { Notice, StatusBadge } from "./Ui";
import { SpainMap, SPAIN_MAP_VERSION } from "./SpainMap";
import { AUTONOMOUS_COMMUNITIES } from "@/lib/domain";

const metrics = [
  { id: "demo_mean_fiscal_change_eur", label: "Cambio fiscal medio", unit: "€ / año", kind: "Simulado DEMO" },
  { id: "demo_median_fiscal_change_eur", label: "Cambio fiscal mediano", unit: "€ / año", kind: "Simulado DEMO" },
  { id: "demo_share_gain_above_500", label: "Hogares por encima del umbral", unit: "%", kind: "Simulado DEMO" },
];

const demoRows = AUTONOMOUS_COMMUNITIES.map((community, index) => ({
  code: community.code,
  name: community.name,
  support: community.support,
  mean: ((index * 173) % 980) - 260,
  median: ((index * 137) % 760) - 180,
  share: 34 + ((index * 7) % 43),
  uncertainty: index % 4 === 0 ? "Alta" : index % 3 === 0 ? "Media" : "Baja",
}));

function metricValue(row: (typeof demoRows)[number], metric: string): string {
  if (metric === "demo_median_fiscal_change_eur") return `${row.median >= 0 ? "+" : ""}${row.median} €`;
  if (metric === "demo_share_gain_above_500") return `${row.share} %`;
  return `${row.mean >= 0 ? "+" : ""}${row.mean} €`;
}

function metricNumber(row: (typeof demoRows)[number], metric: string): number {
  if (metric === "demo_median_fiscal_change_eur") return row.median;
  if (metric === "demo_share_gain_above_500") return row.share;
  return row.mean;
}

export function ExplorerClient() {
  const [metric, setMetric] = useState(metrics[0].id);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | undefined>(undefined);
  const selectedMetric = metrics.find((candidate) => candidate.id === metric) ?? metrics[0];
  const filteredRows = useMemo(
    () => demoRows.filter((row) => row.name.toLocaleLowerCase("es").includes(query.toLocaleLowerCase("es"))),
    [query],
  );
  const mapValues = useMemo(
    () => Object.fromEntries(demoRows.map((row) => [row.code, metricNumber(row, metric)])),
    [metric],
  );
  const selectedRow = demoRows.find((row) => row.code === selected);

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
          <label htmlFor="place-search">Buscar comunidad</label>
          <div><Search size={16} aria-hidden="true" /><input id="place-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Comunidad autónoma" /></div>
        </div>
        {selectedRow ? (
          <div className="control-heading" aria-live="polite">
            <div>
              <span>Selección</span>
              <strong>{selectedRow.name}</strong>
              <p className="field-help">
                {selectedMetric.label}: {metricValue(selectedRow, metric)} · incertidumbre {selectedRow.uncertainty}
              </p>
            </div>
          </div>
        ) : (
          <p className="field-help">Toca o navega con el teclado por el mapa para fijar una comunidad.</p>
        )}
        <div className="map-legend" aria-label="Leyenda del mapa">
          <strong>Leyenda</strong>
          <span><i className="legend-negative" /> Valores negativos</span>
          <span><i className="legend-neutral" /> Próximo a cero</span>
          <span><i className="legend-positive" /> Valores positivos</span>
        </div>
        <Notice tone="warning" title="Capa sintética">
          Los valores listados son fixtures reproducibles, no estadísticas oficiales ni
          estimaciones publicables. Para mover palancas reales de ingresos y gasto usa el{" "}
          <Link href="/laboratorio">laboratorio fiscal <ArrowRight size={13} aria-hidden="true" /></Link>.
        </Notice>
      </aside>

      <div className="explorer-main">
        <div className="map-shell map-shell-svg">
          <div className="map-overlay-top">
            <StatusBadge tone="demo">DEMO · SVG</StatusBadge>
            <span>Geografía {SPAIN_MAP_VERSION} (NUTS-2, © EuroGeographics)</span>
          </div>
          <SpainMap
            values={mapValues}
            formatValue={(value) =>
              metric === "demo_share_gain_above_500" ? `${Math.round(value)} %` : `${value >= 0 ? "+" : ""}${Math.round(value)} € / año`
            }
            metricLabel={`${selectedMetric.label} (${selectedMetric.unit}, valores DEMO)`}
            selectedCode={selected}
            onSelect={setSelected}
          />
          <div className="demo-watermark" aria-hidden="true">DEMO · NO OFICIAL</div>
        </div>

        <section className="linked-chart">
          <div className="linked-chart-heading"><div><span>Distribución vinculada</span><h2>{selectedMetric.label}</h2></div><StatusBadge tone="demo">{selectedMetric.kind}</StatusBadge></div>
          <div className="bar-list" aria-hidden="true">
            {filteredRows.slice(0, 8).map((row) => {
              const raw = metricNumber(row, metric);
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
