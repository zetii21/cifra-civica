"use client";

import { useMemo, useState } from "react";
import { Notice, StatusBadge } from "./Ui";
import {
  buildPresetSettings,
  GOVERNMENT_PRESETS,
  simulateNation,
  type GovernmentPreset,
  type NationalSimulation,
} from "@/lib/fiscal-lab";

const signedInteger = new Intl.NumberFormat("es-ES", {
  maximumFractionDigits: 0,
  signDisplay: "exceptZero",
});
const decimalFormat = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 });

const MAX_SELECTED = 3;

function ComparisonColumn({
  preset,
  result,
}: {
  preset: GovernmentPreset;
  result: NationalSimulation;
}) {
  const deficitShare = (result.totals.simulatedDeficitMEur / result.totals.gdpMEur) * 100;
  const communities = [...result.communities].sort(
    (left, right) => right.netHouseholdImpactEur - left.netHouseholdImpactEur,
  );
  const best = communities[0];
  const worst = communities[communities.length - 1];
  const maxAbs = Math.max(
    1,
    ...result.distribution.deciles.map((group) => Math.abs(group.netPerHouseholdEur)),
  );
  return (
    <article className="compare-column">
      <header>
        <span className="preset-mark" style={{ background: preset.color }} aria-hidden="true">
          {preset.tileLabel}
        </span>
        <h2>{preset.name}</h2>
        <StatusBadge tone={preset.kind === "historical" ? "official" : "demo"}>
          {preset.kind === "historical" ? "Trayectoria documentada" : "Arquetipo sintético"}
        </StatusBadge>
      </header>
      <dl className="compare-metrics">
        <div>
          <dt>Ingresos públicos</dt>
          <dd className={result.totals.revenueDeltaMEur < 0 ? "lab-neg" : "lab-pos"}>
            {signedInteger.format(Math.round(result.totals.revenueDeltaMEur))} M€
          </dd>
        </div>
        <div>
          <dt>Gasto público</dt>
          <dd className={result.totals.spendingDeltaMEur > 0 ? "lab-neg" : "lab-pos"}>
            {signedInteger.format(Math.round(result.totals.spendingDeltaMEur))} M€
          </dd>
        </div>
        <div>
          <dt>Saldo público</dt>
          <dd className={result.totals.totalBalanceDeltaMEur < 0 ? "lab-neg" : "lab-pos"}>
            {signedInteger.format(Math.round(result.totals.totalBalanceDeltaMEur))} M€
          </dd>
        </div>
        <div>
          <dt>Déficit resultante</dt>
          <dd>{decimalFormat.format(deficitShare)} % del PIB</dd>
        </div>
      </dl>
      <h3>Impacto por decil de renta (€/hogar·año)</h3>
      <div className="lab-bars">
        {result.distribution.deciles.map((group) => {
          const width = Math.max(2, (Math.abs(group.netPerHouseholdEur) / maxAbs) * 100);
          return (
            <div key={group.id} className="lab-bar-row">
              <span>{group.id.toUpperCase()}</span>
              <div className="lab-bar-track">
                <i
                  className={
                    group.netPerHouseholdEur < -0.005
                      ? "negative"
                      : group.netPerHouseholdEur > 0.005
                        ? "positive"
                        : "neutral"
                  }
                  style={{ width: `${width}%` }}
                />
              </div>
              <b>{signedInteger.format(Math.round(group.netPerHouseholdEur))} €</b>
            </div>
          );
        })}
      </div>
      <h3>Territorio</h3>
      <p className="compare-territory">
        Hogar medio más beneficiado: <strong>{best.name}</strong> (
        {signedInteger.format(Math.round(best.netHouseholdImpactEur))} €). Más afectado:{" "}
        <strong>{worst.name}</strong> (
        {signedInteger.format(Math.round(worst.netHouseholdImpactEur))} €).
      </p>
      {preset.sourceNotes.length > 0 ? (
        <details>
          <summary>Medidas documentadas en que se basa</summary>
          <ul>
            {preset.sourceNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </article>
  );
}

export function ComparadorClient() {
  const [selected, setSelected] = useState<string[]>([
    "hist_pp_2011_2016",
    "hist_psoe_2018_2024",
  ]);

  const toggle = (id: string) => {
    setSelected((current) => {
      if (current.includes(id)) return current.filter((entry) => entry !== id);
      if (current.length >= MAX_SELECTED) return current;
      // Keep catalogue order (alphabetical inside groups): never reorder by
      // selection so no package gains a position advantage.
      return GOVERNMENT_PRESETS.map((preset) => preset.id).filter(
        (candidate) => current.includes(candidate) || candidate === id,
      );
    });
  };

  const results = useMemo(
    () =>
      selected
        .map((id) => GOVERNMENT_PRESETS.find((preset) => preset.id === id))
        .filter((preset): preset is GovernmentPreset => Boolean(preset))
        .map((preset) => ({
          preset,
          result: simulateNation(buildPresetSettings(preset)),
        })),
    [selected],
  );

  return (
    <div className="compare-layout">
      <section className="compare-picker" aria-label="Selección de paquetes">
        <p className="field-help">
          Elige hasta tres paquetes. El orden de las columnas sigue el catálogo, nunca el
          resultado.
        </p>
        <div className="preset-grid compare-picker-grid">
          {GOVERNMENT_PRESETS.map((preset) => {
            const isSelected = selected.includes(preset.id);
            return (
              <button
                key={preset.id}
                type="button"
                className={`preset-tile${isSelected ? " active" : ""}`}
                aria-pressed={isSelected}
                disabled={!isSelected && selected.length >= MAX_SELECTED}
                onClick={() => toggle(preset.id)}
              >
                <span
                  className="preset-mark"
                  style={{ background: preset.color }}
                  aria-hidden="true"
                >
                  {preset.tileLabel}
                </span>
                <span className="preset-name">{preset.name}</span>
              </button>
            );
          })}
        </div>
      </section>

      {results.length === 0 ? (
        <p className="muted">Selecciona al menos un paquete para comparar.</p>
      ) : (
        <div className="compare-columns" data-count={results.length}>
          {results.map(({ preset, result }) => (
            <ComparisonColumn key={preset.id} preset={preset} result={result} />
          ))}
        </div>
      )}

      <Notice tone="info" title="Programas electorales de 2027">
        Cuando los partidos publiquen sus programas fiscales para 2027, podrán cargarse
        aquí como paquetes propios, cada uno con sus fuentes, su interpretación declarada y
        su estado de revisión. Hasta entonces, ningún paquete de esta página representa una
        propuesta electoral futura.
      </Notice>
      <Notice tone="warning" title="Comparar no es recomendar">
        Trayectorias mapeadas desde medidas aprobadas (aplicación ilustrativa sobre la
        referencia actual) y arquetipos sintéticos. Referencia aproximada 2024,
        elasticidades acotadas y sin ninguna ordenación por «mejor» resultado.
      </Notice>
    </div>
  );
}
