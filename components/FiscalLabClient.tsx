"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Landmark,
  MapPin,
  RotateCcw,
  Scale,
  Users,
} from "lucide-react";
import { Notice, StatusBadge } from "./Ui";
import { SpainMap } from "./SpainMap";
import {
  COMMUNITIES,
  COMMUNITY_BY_CODE,
  INSTRUMENT_GROUP_LABELS,
  INSTRUMENTS,
  SPENDING_PROGRAMS,
  baselineSchedules,
  createDefaultSettings,
  simulateNation,
  type CommunityCode,
  type GroupImpact,
  type NationalSimulation,
  type PolicySettings,
} from "@/lib/fiscal-lab";

const integerFormat = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 });
const signedInteger = new Intl.NumberFormat("es-ES", {
  maximumFractionDigits: 0,
  signDisplay: "exceptZero",
});
const decimalFormat = new Intl.NumberFormat("es-ES", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function formatMEur(value: number): string {
  return `${signedInteger.format(Math.round(value))} M€`;
}

function formatEurHousehold(value: number): string {
  return `${signedInteger.format(Math.round(value))} € por hogar y año`;
}

function formatRate(value: number, unit: "percent" | "eurosPerUnit", unitLabel?: string): string {
  return unit === "percent" ? `${decimalFormat.format(value)} %` : `${decimalFormat.format(value)} ${unitLabel ?? "€"}`;
}

type Scope = "estado" | CommunityCode;

type MapMetric = "hogar" | "ingresos" | "gasto" | "saldo";

const MAP_METRICS: Array<{ id: MapMetric; label: string; unit: string }> = [
  { id: "hogar", label: "Impacto neto por hogar", unit: "€ / hogar · año" },
  { id: "ingresos", label: "Cambio de ingresos de la comunidad", unit: "M€ / año" },
  { id: "gasto", label: "Cambio de gasto ejecutado", unit: "M€ / año" },
  { id: "saldo", label: "Cambio de saldo autonómico", unit: "M€ / año" },
];

function cloneSettings(settings: PolicySettings): PolicySettings {
  return {
    irpfStateBracketDeltas: [...settings.irpfStateBracketDeltas],
    irpfAutonomousDeltas: { ...settings.irpfAutonomousDeltas },
    irpfSavingsBracketDeltas: [...settings.irpfSavingsBracketDeltas],
    instrumentRates: { ...settings.instrumentRates },
    instrumentRegionalRates: Object.fromEntries(
      Object.entries(settings.instrumentRegionalRates).map(([key, value]) => [key, { ...value }]),
    ),
    spendingMultipliers: { ...settings.spendingMultipliers },
    spendingRegionalMultipliers: Object.fromEntries(
      Object.entries(settings.spendingRegionalMultipliers).map(([key, value]) => [key, { ...value }]),
    ),
  };
}

function countActiveChanges(settings: PolicySettings): number {
  return (
    settings.irpfStateBracketDeltas.filter((delta) => delta !== 0).length +
    settings.irpfSavingsBracketDeltas.filter((delta) => delta !== 0).length +
    Object.values(settings.irpfAutonomousDeltas).filter((delta) => delta !== 0).length +
    Object.keys(settings.instrumentRates).length +
    Object.values(settings.instrumentRegionalRates).reduce(
      (sum, overrides) => sum + Object.keys(overrides).length,
      0,
    ) +
    Object.keys(settings.spendingMultipliers).length +
    Object.values(settings.spendingRegionalMultipliers).reduce(
      (sum, overrides) => sum + Object.keys(overrides).length,
      0,
    )
  );
}

function ImpactBars({
  groups,
  ariaLabel,
}: {
  groups: GroupImpact[];
  ariaLabel: string;
}) {
  const maxAbs = Math.max(1, ...groups.map((group) => Math.abs(group.netPerHouseholdEur)));
  return (
    <div className="lab-bars" role="img" aria-label={ariaLabel}>
      {groups.map((group) => {
        const value = group.netPerHouseholdEur;
        const width = Math.max(2, (Math.abs(value) / maxAbs) * 100);
        return (
          <div key={group.id} className="lab-bar-row">
            <span>{group.label}</span>
            <div className="lab-bar-track">
              <i
                className={value < -0.005 ? "negative" : value > 0.005 ? "positive" : "neutral"}
                style={{ width: `${width}%` }}
              />
            </div>
            <b>{signedInteger.format(Math.round(value))} €</b>
          </div>
        );
      })}
    </div>
  );
}

export function FiscalLabClient() {
  const [settings, setSettings] = useState<PolicySettings>(() => createDefaultSettings());
  const [scope, setScope] = useState<Scope>("estado");
  const [mapMetric, setMapMetric] = useState<MapMetric>("hogar");
  const [panel, setPanel] = useState<"ingresos" | "gasto">("ingresos");

  const schedules = useMemo(() => baselineSchedules(), []);
  const result: NationalSimulation = useMemo(() => simulateNation(settings), [settings]);

  const update = (mutate: (draft: PolicySettings) => void) => {
    setSettings((current) => {
      const draft = cloneSettings(current);
      mutate(draft);
      return draft;
    });
  };

  const resetAll = () => setSettings(createDefaultSettings());

  const scopeCommunity = scope === "estado" ? undefined : COMMUNITY_BY_CODE.get(scope);
  const activeChanges = countActiveChanges(settings);

  const mapValues = useMemo(() => {
    const values: Record<string, number> = {};
    for (const community of result.communities) {
      values[community.code] =
        mapMetric === "hogar"
          ? community.netHouseholdImpactEur
          : mapMetric === "ingresos"
            ? community.revenueDeltaMEur
            : mapMetric === "gasto"
              ? community.spendingDeltaMEur
              : community.balanceDeltaMEur;
    }
    return values;
  }, [result, mapMetric]);

  const metricInfo = MAP_METRICS.find((metric) => metric.id === mapMetric)!;
  const deficitShare = (result.totals.simulatedDeficitMEur / result.totals.gdpMEur) * 100;
  const baselineDeficitShare =
    (result.totals.baselineDeficitMEur / result.totals.gdpMEur) * 100;

  const regionalInstruments = INSTRUMENTS.filter((instrument) => instrument.regionallyAdjustable);
  const regionalPrograms = SPENDING_PROGRAMS.filter((program) => program.regionallyAdjustable);

  return (
    <div className="lab-layout">
      <section className="lab-summary" aria-label="Resumen del escenario">
        <div>
          <span>Ingresos públicos</span>
          <strong className={result.totals.revenueDeltaMEur < 0 ? "lab-neg" : "lab-pos"}>
            {formatMEur(result.totals.revenueDeltaMEur)}
          </strong>
          <small>sobre {integerFormat.format(Math.round(result.totals.revenueBaselineMEur))} M€</small>
        </div>
        <div>
          <span>Gasto público</span>
          <strong className={result.totals.spendingDeltaMEur > 0 ? "lab-neg" : "lab-pos"}>
            {formatMEur(result.totals.spendingDeltaMEur)}
          </strong>
          <small>sobre {integerFormat.format(Math.round(result.totals.spendingBaselineMEur))} M€</small>
        </div>
        <div>
          <span>Saldo público</span>
          <strong className={result.totals.totalBalanceDeltaMEur < 0 ? "lab-neg" : "lab-pos"}>
            {formatMEur(result.totals.totalBalanceDeltaMEur)}
          </strong>
          <small>
            déficit {decimalFormat.format(baselineDeficitShare)} % → {decimalFormat.format(deficitShare)} % del PIB
          </small>
        </div>
        <div>
          <span>Cambios activos</span>
          <strong>{activeChanges}</strong>
          <small>{integerFormat.format(result.evaluationCount)} evaluaciones por recálculo</small>
        </div>
        <button type="button" className="button button-quiet lab-reset" onClick={resetAll}>
          <RotateCcw size={15} aria-hidden="true" /> Restablecer todo
        </button>
      </section>

      <div className="lab-columns">
        <section className="lab-controls" aria-label="Palancas de política fiscal">
          <div className="lab-scope">
            <label htmlFor="lab-scope-select">
              <MapPin size={15} aria-hidden="true" /> Ámbito de los cambios
            </label>
            <select
              id="lab-scope-select"
              value={scope}
              onChange={(event) => setScope(event.target.value as Scope)}
            >
              <option value="estado">España — palancas estatales</option>
              {COMMUNITIES.map((community) => (
                <option key={community.code} value={community.code}>
                  {community.name}
                </option>
              ))}
            </select>
            {scopeCommunity ? (
              <p className="field-help">
                Ajustas las palancas propias de {scopeCommunity.name}
                {scopeCommunity.regime === "foral"
                  ? " (régimen foral: escala aproximada de su hacienda)"
                  : ""}
                . También puedes tocar otra comunidad en el mapa.
              </p>
            ) : (
              <p className="field-help">
                Palancas estatales y comunes. Toca una comunidad en el mapa para editar sus
                tributos y su gasto propios.
              </p>
            )}
          </div>

          <div className="lab-tabs" role="tablist" aria-label="Tipo de palancas">
            <button
              type="button"
              role="tab"
              aria-selected={panel === "ingresos"}
              className={panel === "ingresos" ? "active" : ""}
              onClick={() => setPanel("ingresos")}
            >
              <Landmark size={15} aria-hidden="true" /> Impuestos
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={panel === "gasto"}
              className={panel === "gasto" ? "active" : ""}
              onClick={() => setPanel("gasto")}
            >
              <Scale size={15} aria-hidden="true" /> Gasto público
            </button>
          </div>

          {panel === "ingresos" && scope === "estado" ? (
            <div className="lab-group-stack">
              <details className="lab-group" open>
                <summary>
                  IRPF — escala general estatal
                  <StatusBadge tone="official">por tramos</StatusBadge>
                </summary>
                <p className="field-help">
                  Cambia cada tipo marginal en puntos porcentuales. La mitad autonómica se
                  edita comunidad a comunidad desde el mapa.
                </p>
                <div className="lab-brackets">
                  {schedules.stateGeneral.map((bracket, index) => {
                    const delta = settings.irpfStateBracketDeltas[index] ?? 0;
                    const next = schedules.stateGeneral[index + 1];
                    return (
                      <div className="lab-bracket-row" key={bracket.thresholdEur}>
                        <span>
                          {next
                            ? `${integerFormat.format(bracket.thresholdEur)} – ${integerFormat.format(next.thresholdEur)} €`
                            : `Más de ${integerFormat.format(bracket.thresholdEur)} €`}
                        </span>
                        <label>
                          <span className="sr-only">
                            Variación del tramo {index + 1} en puntos porcentuales
                          </span>
                          <input
                            type="range"
                            min={-5}
                            max={5}
                            step={0.25}
                            value={delta}
                            onChange={(event) =>
                              update((draft) => {
                                draft.irpfStateBracketDeltas[index] = Number(event.target.value);
                              })
                            }
                          />
                        </label>
                        <b>
                          {decimalFormat.format(bracket.ratePercent)} % →{" "}
                          {decimalFormat.format(Math.max(0, bracket.ratePercent + delta))} %
                        </b>
                      </div>
                    );
                  })}
                </div>
              </details>

              <details className="lab-group" open>
                <summary>
                  Ahorro y ganancias del patrimonio
                  <StatusBadge tone="official">por tramos</StatusBadge>
                </summary>
                <p className="field-help">
                  Escala conjunta del ahorro (intereses, dividendos y plusvalías).
                </p>
                <div className="lab-brackets">
                  {schedules.savings.map((bracket, index) => {
                    const delta = settings.irpfSavingsBracketDeltas[index] ?? 0;
                    const next = schedules.savings[index + 1];
                    return (
                      <div className="lab-bracket-row" key={bracket.thresholdEur}>
                        <span>
                          {next
                            ? `${integerFormat.format(bracket.thresholdEur)} – ${integerFormat.format(next.thresholdEur)} €`
                            : `Más de ${integerFormat.format(bracket.thresholdEur)} €`}
                        </span>
                        <label>
                          <span className="sr-only">
                            Variación del tramo de ahorro {index + 1} en puntos porcentuales
                          </span>
                          <input
                            type="range"
                            min={-5}
                            max={8}
                            step={0.25}
                            value={delta}
                            onChange={(event) =>
                              update((draft) => {
                                draft.irpfSavingsBracketDeltas[index] = Number(event.target.value);
                              })
                            }
                          />
                        </label>
                        <b>
                          {decimalFormat.format(bracket.ratePercent)} % →{" "}
                          {decimalFormat.format(Math.max(0, bracket.ratePercent + delta))} %
                        </b>
                      </div>
                    );
                  })}
                </div>
              </details>

              {Object.entries(INSTRUMENT_GROUP_LABELS).map(([group, label]) => {
                const instruments = INSTRUMENTS.filter(
                  (instrument) => instrument.group === group,
                );
                if (instruments.length === 0) return null;
                return (
                  <details className="lab-group" key={group} open={group === "especiales"}>
                    <summary>{label}</summary>
                    {instruments.map((instrument) => {
                      const rate =
                        settings.instrumentRates[instrument.id] ?? instrument.baselineRate;
                      const resultRow = result.instruments.find(
                        (entry) => entry.id === instrument.id,
                      );
                      return (
                        <div className="lab-lever" key={instrument.id}>
                          <div className="lab-lever-heading">
                            <label htmlFor={`lever-${instrument.id}`}>{instrument.name}</label>
                            <b>{formatRate(rate, instrument.rateUnit, instrument.unitLabel)}</b>
                          </div>
                          <input
                            id={`lever-${instrument.id}`}
                            type="range"
                            min={instrument.minRate}
                            max={instrument.maxRate}
                            step={instrument.step}
                            value={rate}
                            onChange={(event) =>
                              update((draft) => {
                                const value = Number(event.target.value);
                                if (value === instrument.baselineRate) {
                                  delete draft.instrumentRates[instrument.id];
                                } else {
                                  draft.instrumentRates[instrument.id] = value;
                                }
                              })
                            }
                          />
                          <div className="lab-lever-meta">
                            <span>{instrument.sourceNote}</span>
                            <b
                              className={
                                (resultRow?.deltaMEur ?? 0) < -0.5
                                  ? "lab-neg"
                                  : (resultRow?.deltaMEur ?? 0) > 0.5
                                    ? "lab-pos"
                                    : ""
                              }
                            >
                              {formatMEur(resultRow?.deltaMEur ?? 0)}
                            </b>
                          </div>
                        </div>
                      );
                    })}
                  </details>
                );
              })}
            </div>
          ) : null}

          {panel === "ingresos" && scopeCommunity ? (
            <div className="lab-group-stack">
              <details className="lab-group" open>
                <summary>
                  IRPF autonómico de {scopeCommunity.shortName}
                  <StatusBadge tone={scopeCommunity.regime === "foral" ? "warning" : "official"}>
                    {scopeCommunity.regime === "foral" ? "foral aprox." : "tramo autonómico"}
                  </StatusBadge>
                </summary>
                <p className="field-help">
                  Variación uniforme de todos los tipos de la escala{" "}
                  {scopeCommunity.regime === "foral" ? "foral" : "autonómica"} en puntos.
                </p>
                <div className="lab-bracket-row">
                  <span>Todos los tramos</span>
                  <label>
                    <span className="sr-only">
                      Variación de la escala autonómica de {scopeCommunity.name}
                    </span>
                    <input
                      type="range"
                      min={-4}
                      max={4}
                      step={0.25}
                      value={settings.irpfAutonomousDeltas[scopeCommunity.code] ?? 0}
                      onChange={(event) =>
                        update((draft) => {
                          const value = Number(event.target.value);
                          if (value === 0) delete draft.irpfAutonomousDeltas[scopeCommunity.code];
                          else draft.irpfAutonomousDeltas[scopeCommunity.code] = value;
                        })
                      }
                    />
                  </label>
                  <b>
                    {signedInteger.format(settings.irpfAutonomousDeltas[scopeCommunity.code] ?? 0)}{" "}
                    puntos
                  </b>
                </div>
              </details>

              <details className="lab-group" open>
                <summary>Tributos propios y cedidos</summary>
                {regionalInstruments.map((instrument) => {
                  const override =
                    settings.instrumentRegionalRates[instrument.id]?.[scopeCommunity.code];
                  const rate = override ?? instrument.baselineRate;
                  const resultRow = result.instruments.find((entry) => entry.id === instrument.id);
                  return (
                    <div className="lab-lever" key={instrument.id}>
                      <div className="lab-lever-heading">
                        <label htmlFor={`regional-${instrument.id}`}>{instrument.name}</label>
                        <b>{formatRate(rate, instrument.rateUnit, instrument.unitLabel)}</b>
                      </div>
                      <input
                        id={`regional-${instrument.id}`}
                        type="range"
                        min={instrument.minRate}
                        max={instrument.maxRate}
                        step={instrument.step}
                        value={rate}
                        onChange={(event) =>
                          update((draft) => {
                            const value = Number(event.target.value);
                            const overrides = draft.instrumentRegionalRates[instrument.id] ?? {};
                            if (value === instrument.baselineRate) {
                              delete overrides[scopeCommunity.code];
                            } else {
                              overrides[scopeCommunity.code] = value;
                            }
                            if (Object.keys(overrides).length === 0) {
                              delete draft.instrumentRegionalRates[instrument.id];
                            } else {
                              draft.instrumentRegionalRates[instrument.id] = overrides;
                            }
                          })
                        }
                      />
                      <div className="lab-lever-meta">
                        <span>Índice 100 = normativa vigente de la comunidad.</span>
                        <b>
                          {formatMEur(resultRow?.regionalDeltaMEur[scopeCommunity.code] ?? 0)} en{" "}
                          {scopeCommunity.shortName}
                        </b>
                      </div>
                    </div>
                  );
                })}
              </details>
            </div>
          ) : null}

          {panel === "gasto" ? (
            <div className="lab-group-stack">
              {scope === "estado" ? (
                <details className="lab-group" open>
                  <summary>Partidas de gasto — conjunto de España</summary>
                  {SPENDING_PROGRAMS.map((program) => {
                    const multiplier = settings.spendingMultipliers[program.id] ?? 1;
                    const resultRow = result.spending.find((entry) => entry.id === program.id);
                    const locked = program.minMultiplier === program.maxMultiplier;
                    return (
                      <div className="lab-lever" key={program.id}>
                        <div className="lab-lever-heading">
                          <label htmlFor={`spend-${program.id}`}>{program.name}</label>
                          <b>
                            {integerFormat.format(Math.round(program.baselineMEur * multiplier))}{" "}
                            M€
                          </b>
                        </div>
                        <input
                          id={`spend-${program.id}`}
                          type="range"
                          min={program.minMultiplier * 100}
                          max={program.maxMultiplier * 100}
                          step={1}
                          value={multiplier * 100}
                          disabled={locked}
                          onChange={(event) =>
                            update((draft) => {
                              const value = Number(event.target.value) / 100;
                              if (value === 1) delete draft.spendingMultipliers[program.id];
                              else draft.spendingMultipliers[program.id] = value;
                            })
                          }
                        />
                        <div className="lab-lever-meta">
                          <span>
                            {locked
                              ? program.sourceNote
                              : `${integerFormat.format(program.minMultiplier * 100)}–${integerFormat.format(program.maxMultiplier * 100)} % de la referencia. ${program.sourceNote}`}
                          </span>
                          <b
                            className={
                              (resultRow?.deltaMEur ?? 0) > 0.5
                                ? "lab-pos"
                                : (resultRow?.deltaMEur ?? 0) < -0.5
                                  ? "lab-neg"
                                  : ""
                            }
                          >
                            {formatMEur(resultRow?.deltaMEur ?? 0)}
                          </b>
                        </div>
                      </div>
                    );
                  })}
                </details>
              ) : (
                <details className="lab-group" open>
                  <summary>Gasto gestionado por {scopeCommunity!.name}</summary>
                  <p className="field-help">
                    Programas con ejecución autonómica. El cambio se aplica solo a la parte de{" "}
                    {scopeCommunity!.shortName}.
                  </p>
                  {regionalPrograms.map((program) => {
                    const override =
                      settings.spendingRegionalMultipliers[program.id]?.[scopeCommunity!.code];
                    const multiplier = override ?? settings.spendingMultipliers[program.id] ?? 1;
                    const baselineHere =
                      program.baselineMEur * program.regionalWeights[scopeCommunity!.code];
                    return (
                      <div className="lab-lever" key={program.id}>
                        <div className="lab-lever-heading">
                          <label htmlFor={`spend-regional-${program.id}`}>{program.name}</label>
                          <b>
                            {integerFormat.format(Math.round(baselineHere * multiplier))} M€ en{" "}
                            {scopeCommunity!.shortName}
                          </b>
                        </div>
                        <input
                          id={`spend-regional-${program.id}`}
                          type="range"
                          min={program.minMultiplier * 100}
                          max={program.maxMultiplier * 100}
                          step={1}
                          value={multiplier * 100}
                          onChange={(event) =>
                            update((draft) => {
                              const value = Number(event.target.value) / 100;
                              const overrides =
                                draft.spendingRegionalMultipliers[program.id] ?? {};
                              if (value === (draft.spendingMultipliers[program.id] ?? 1)) {
                                delete overrides[scopeCommunity!.code];
                              } else {
                                overrides[scopeCommunity!.code] = value;
                              }
                              if (Object.keys(overrides).length === 0) {
                                delete draft.spendingRegionalMultipliers[program.id];
                              } else {
                                draft.spendingRegionalMultipliers[program.id] = overrides;
                              }
                            })
                          }
                        />
                        <div className="lab-lever-meta">
                          <span>Referencia en la comunidad: {integerFormat.format(Math.round(baselineHere))} M€.</span>
                          <b>{integerFormat.format(multiplier * 100)} %</b>
                        </div>
                      </div>
                    );
                  })}
                </details>
              )}
            </div>
          ) : null}
        </section>

        <section className="lab-visual" aria-label="Resultados territoriales y distributivos">
          <div className="lab-map-card">
            <div className="lab-map-heading">
              <div>
                <span>Mapa interactivo</span>
                <h2>{metricInfo.label}</h2>
              </div>
              <label className="lab-map-metric">
                <span className="sr-only">Métrica del mapa</span>
                <select
                  value={mapMetric}
                  onChange={(event) => setMapMetric(event.target.value as MapMetric)}
                >
                  {MAP_METRICS.map((metric) => (
                    <option key={metric.id} value={metric.id}>
                      {metric.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <SpainMap
              values={mapValues}
              formatValue={(value) =>
                mapMetric === "hogar"
                  ? formatEurHousehold(value)
                  : `${signedInteger.format(Math.round(value))} M€ / año`
              }
              metricLabel={`${metricInfo.label} (${metricInfo.unit})`}
              selectedCode={scope === "estado" ? undefined : scope}
              onSelect={(code) => setScope((code as Scope) ?? "estado")}
            />
            <div className="lab-map-legend" aria-hidden="true">
              <span><i className="legend-negative" /> Empeora</span>
              <span><i className="legend-neutral" /> Sin cambio</span>
              <span><i className="legend-positive" /> Mejora</span>
            </div>
          </div>

          <div className="lab-impact-card">
            <div className="lab-impact-heading">
              <Users size={17} aria-hidden="true" />
              <h2>¿A quién afecta este escenario?</h2>
            </div>
            {activeChanges === 0 ? (
              <p className="muted">
                Mueve cualquier palanca para ver el impacto por nivel de renta, tipo de familia,
                edad y territorio.
              </p>
            ) : (
              <>
                <div className="lab-chips">
                  {result.distribution.mostAffected.map((group) => (
                    <span key={`peor-${group.id}`} className="lab-chip lab-chip-neg">
                      <ArrowDownRight size={13} aria-hidden="true" />
                      {group.label}: {signedInteger.format(Math.round(group.netPerHouseholdEur))} €
                    </span>
                  ))}
                  {result.distribution.leastAffected.map((group) => (
                    <span key={`mejor-${group.id}`} className="lab-chip lab-chip-pos">
                      <ArrowUpRight size={13} aria-hidden="true" />
                      {group.label}: {signedInteger.format(Math.round(group.netPerHouseholdEur))} €
                    </span>
                  ))}
                </div>
                <h3>Por nivel de renta</h3>
                <ImpactBars
                  groups={result.distribution.deciles}
                  ariaLabel="Impacto neto anual por hogar según decil de renta"
                />
                <h3>Por tipo de familia</h3>
                <ImpactBars
                  groups={result.distribution.familyTypes}
                  ariaLabel="Impacto neto anual por hogar según tipo de familia"
                />
                <h3>Por edad de la persona sustentadora</h3>
                <ImpactBars
                  groups={result.distribution.ageBands}
                  ariaLabel="Impacto neto anual por hogar según grupo de edad"
                />
              </>
            )}
          </div>

          <div className="lab-table-card">
            <h2>Comunidades autónomas</h2>
            <div className="table-scroll">
              <table className="map-data-table">
                <caption>
                  Cambios anuales por comunidad: ingresos y gasto públicos, saldo y hogar medio.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Territorio</th>
                    <th scope="col">Δ ingresos</th>
                    <th scope="col">Δ gasto</th>
                    <th scope="col">Δ saldo</th>
                    <th scope="col">€ / hogar·año</th>
                  </tr>
                </thead>
                <tbody>
                  {[...result.communities]
                    .sort((left, right) => right.netHouseholdImpactEur - left.netHouseholdImpactEur)
                    .map((community) => (
                      <tr
                        key={community.code}
                        className={scope === community.code ? "lab-row-selected" : undefined}
                      >
                        <th scope="row">{community.name}</th>
                        <td>{formatMEur(community.revenueDeltaMEur)}</td>
                        <td>{formatMEur(community.spendingDeltaMEur)}</td>
                        <td>{formatMEur(community.balanceDeltaMEur)}</td>
                        <td>{signedInteger.format(Math.round(community.netHouseholdImpactEur))} €</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          <Notice tone="warning" title="Referencia aproximada, no una liquidación oficial">
            <ul className="lab-warning-list">
              {result.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </Notice>
        </section>
      </div>
    </div>
  );
}
