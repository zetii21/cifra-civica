"use client";

import { useMemo, useRef, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Download,
  Landmark,
  Landmark as LandmarkIcon,
  MapPin,
  RotateCcw,
  Scale,
  SlidersHorizontal,
  Target,
  Users,
} from "lucide-react";
import { Notice, StatusBadge } from "./Ui";
import { SpainMap } from "./SpainMap";
import { GovernmentPresets } from "./GovernmentPresets";
import { HouseholdProfileCard } from "./HouseholdProfileCard";
import { EmbedSnippet } from "./EmbedSnippet";
import { LabScoreboard } from "./LabScoreboard";
import { listActiveChanges, type ActiveChange } from "./labChanges";
import { downloadShareCard } from "./labShareCard";
import {
  buildPresetSettings,
  COMMUNITIES,
  COMMUNITY_BY_CODE,
  getPreset,
  INSTRUMENT_GROUP_LABELS,
  INSTRUMENTS,
  SPENDING_PROGRAMS,
  baselineSchedules,
  createDefaultSettings,
  simulateNation,
  type CommunityCode,
  type GovernmentPreset,
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

/** Lever control anatomy: slider + numeric stepper + per-lever reset + dot. */
function LeverControls({
  id,
  ariaLabel,
  min,
  max,
  step,
  value,
  baseline,
  onValue,
}: {
  id: string;
  ariaLabel: string;
  min: number;
  max: number;
  step: number;
  value: number;
  baseline: number;
  onValue: (value: number) => void;
}) {
  const changed = value !== baseline;
  const clamp = (raw: number) => Math.min(max, Math.max(min, raw));
  return (
    <div className="lab-lever-controls">
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={ariaLabel}
        onChange={(event) => onValue(Number(event.target.value))}
      />
      <input
        type="number"
        className="lever-number"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={`${ariaLabel} (valor exacto)`}
        onChange={(event) => {
          if (event.target.value === "") return;
          const raw = Number(event.target.value);
          if (Number.isFinite(raw)) onValue(clamp(raw));
        }}
      />
      <button
        type="button"
        className="icon-button lever-reset"
        aria-label={`Restablecer ${ariaLabel}`}
        title="Restablecer esta palanca"
        disabled={!changed}
        onClick={() => onValue(baseline)}
      >
        <RotateCcw size={13} aria-hidden="true" />
      </button>
    </div>
  );
}

function ChangedDot({ changed }: { changed: boolean }) {
  return changed ? (
    <i className="lever-dot" aria-label="palanca modificada" title="Palanca modificada" />
  ) : null;
}

function CountBadge({ count }: { count: number }) {
  return count > 0 ? <em className="lab-count-badge">{count}</em> : null;
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

export function FiscalLabClient({ initialScope }: { initialScope?: CommunityCode } = {}) {
  const [settings, setSettings] = useState<PolicySettings>(() => createDefaultSettings());
  const [scope, setScope] = useState<Scope>(initialScope ?? "estado");
  const [mapMetric, setMapMetric] = useState<MapMetric>("hogar");
  const [panel, setPanel] = useState<"ingresos" | "gasto">("ingresos");
  const [activePresetId, setActivePresetId] = useState<string | null>(null);

  const schedules = useMemo(() => baselineSchedules(), []);
  const result: NationalSimulation = useMemo(() => simulateNation(settings), [settings]);

  const update = (mutate: (draft: PolicySettings) => void) => {
    setSettings((current) => {
      const draft = cloneSettings(current);
      mutate(draft);
      return draft;
    });
  };

  const resetAll = () => {
    setSettings(createDefaultSettings());
    setActivePresetId(null);
  };

  const applyPreset = (preset: GovernmentPreset) => {
    setSettings(buildPresetSettings(preset));
    setActivePresetId(preset.id);
  };

  const presetModified = useMemo(() => {
    if (!activePresetId) return false;
    const preset = getPreset(activePresetId);
    if (!preset) return false;
    return JSON.stringify(settings) !== JSON.stringify(buildPresetSettings(preset));
  }, [settings, activePresetId]);

  const scopeCommunity = scope === "estado" ? undefined : COMMUNITY_BY_CODE.get(scope);
  const activeChanges = countActiveChanges(settings);
  const changeList = useMemo(() => listActiveChanges(settings), [settings]);
  const undoChange = (change: ActiveChange) => update((draft) => change.undo(draft));

  const presetsRef = useRef<HTMLDivElement | null>(null);
  const irpfGroupRef = useRef<HTMLDetailsElement | null>(null);
  const challengeRef = useRef<HTMLDivElement | null>(null);

  const goToPresets = () => {
    presetsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const goToIrpf = () => {
    setPanel("ingresos");
    setScope("estado");
    window.setTimeout(() => {
      const group = irpfGroupRef.current;
      if (!group) return;
      group.open = true;
      group.scrollIntoView({ behavior: "smooth", block: "start" });
      group.querySelector<HTMLInputElement>("input[type=range]")?.focus({ preventScroll: true });
    }, 60);
  };
  const goToChallenge = () => {
    challengeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const stateChangedCount = settings.irpfStateBracketDeltas.filter((delta) => delta !== 0).length;
  const savingsChangedCount = settings.irpfSavingsBracketDeltas.filter(
    (delta) => delta !== 0,
  ).length;
  const spendingChangedCount =
    Object.keys(settings.spendingMultipliers).length +
    Object.values(settings.spendingRegionalMultipliers).reduce(
      (sum, overrides) => sum + Object.keys(overrides).length,
      0,
    );

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
      <nav className="lab-quickstart" aria-label="Puntos de partida rápidos">
        <span>Empieza en 5 segundos:</span>
        <button type="button" onClick={goToPresets}>
          <LandmarkIcon size={14} aria-hidden="true" /> Prueba un paquete de gobierno
        </button>
        <button type="button" onClick={goToIrpf}>
          <SlidersHorizontal size={14} aria-hidden="true" /> Toca el IRPF por tramos
        </button>
        <button type="button" onClick={goToChallenge}>
          <Target size={14} aria-hidden="true" /> Reto: cierra el déficit
        </button>
      </nav>

      <LabScoreboard
        revenueDeltaMEur={result.totals.revenueDeltaMEur}
        revenueBaselineMEur={result.totals.revenueBaselineMEur}
        spendingDeltaMEur={result.totals.spendingDeltaMEur}
        spendingBaselineMEur={result.totals.spendingBaselineMEur}
        balanceDeltaMEur={result.totals.totalBalanceDeltaMEur}
        deficitBeforeShare={baselineDeficitShare}
        deficitAfterShare={deficitShare}
        evaluationCount={result.evaluationCount}
        changes={changeList}
        onUndo={undoChange}
        onResetAll={resetAll}
      />

      <div className="lab-columns">
        <section className="lab-controls" aria-label="Palancas de política fiscal">
          <div ref={presetsRef}>
            <GovernmentPresets
              activePresetId={activePresetId}
              modified={presetModified}
              onApply={applyPreset}
              onClear={resetAll}
            />
          </div>
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
              <details className="lab-group" open ref={irpfGroupRef}>
                <summary>
                  IRPF — escala general estatal
                  <CountBadge count={stateChangedCount} />
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
                    const rangeLabel = next
                      ? `${integerFormat.format(bracket.thresholdEur)} – ${integerFormat.format(next.thresholdEur)} €`
                      : `Más de ${integerFormat.format(bracket.thresholdEur)} €`;
                    return (
                      <div className="lab-bracket-row" key={bracket.thresholdEur}>
                        <span>
                          <ChangedDot changed={delta !== 0} />
                          {rangeLabel}
                        </span>
                        <LeverControls
                          id={`irpf-state-${index}`}
                          ariaLabel={`variación del tramo ${rangeLabel} en puntos porcentuales`}
                          min={-5}
                          max={5}
                          step={0.25}
                          value={delta}
                          baseline={0}
                          onValue={(value) =>
                            update((draft) => {
                              draft.irpfStateBracketDeltas[index] = value;
                            })
                          }
                        />
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
                  <CountBadge count={savingsChangedCount} />
                  <StatusBadge tone="official">por tramos</StatusBadge>
                </summary>
                <p className="field-help">
                  Escala conjunta del ahorro (intereses, dividendos y plusvalías).
                </p>
                <div className="lab-brackets">
                  {schedules.savings.map((bracket, index) => {
                    const delta = settings.irpfSavingsBracketDeltas[index] ?? 0;
                    const next = schedules.savings[index + 1];
                    const rangeLabel = next
                      ? `${integerFormat.format(bracket.thresholdEur)} – ${integerFormat.format(next.thresholdEur)} €`
                      : `Más de ${integerFormat.format(bracket.thresholdEur)} €`;
                    return (
                      <div className="lab-bracket-row" key={bracket.thresholdEur}>
                        <span>
                          <ChangedDot changed={delta !== 0} />
                          {rangeLabel}
                        </span>
                        <LeverControls
                          id={`irpf-savings-${index}`}
                          ariaLabel={`variación del tramo de ahorro ${rangeLabel} en puntos porcentuales`}
                          min={-5}
                          max={8}
                          step={0.25}
                          value={delta}
                          baseline={0}
                          onValue={(value) =>
                            update((draft) => {
                              draft.irpfSavingsBracketDeltas[index] = value;
                            })
                          }
                        />
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
                const groupChanged = instruments.filter(
                  (instrument) => settings.instrumentRates[instrument.id] !== undefined,
                ).length;
                return (
                  <details className="lab-group" key={group} open={group === "especiales"}>
                    <summary>
                      {label}
                      <CountBadge count={groupChanged} />
                    </summary>
                    {instruments.map((instrument) => {
                      const rate =
                        settings.instrumentRates[instrument.id] ?? instrument.baselineRate;
                      const resultRow = result.instruments.find(
                        (entry) => entry.id === instrument.id,
                      );
                      return (
                        <div className="lab-lever" key={instrument.id}>
                          <div className="lab-lever-heading">
                            <label htmlFor={`lever-${instrument.id}`}>
                              <ChangedDot changed={rate !== instrument.baselineRate} />
                              {instrument.name}
                            </label>
                            <b>{formatRate(rate, instrument.rateUnit, instrument.unitLabel)}</b>
                          </div>
                          <LeverControls
                            id={`lever-${instrument.id}`}
                            ariaLabel={instrument.name}
                            min={instrument.minRate}
                            max={instrument.maxRate}
                            step={instrument.step}
                            value={rate}
                            baseline={instrument.baselineRate}
                            onValue={(value) =>
                              update((draft) => {
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
                  <span>
                    <ChangedDot
                      changed={(settings.irpfAutonomousDeltas[scopeCommunity.code] ?? 0) !== 0}
                    />
                    Todos los tramos
                  </span>
                  <LeverControls
                    id={`irpf-auto-${scopeCommunity.code}`}
                    ariaLabel={`variación de la escala autonómica de ${scopeCommunity.name} en puntos`}
                    min={-4}
                    max={4}
                    step={0.25}
                    value={settings.irpfAutonomousDeltas[scopeCommunity.code] ?? 0}
                    baseline={0}
                    onValue={(value) =>
                      update((draft) => {
                        if (value === 0) delete draft.irpfAutonomousDeltas[scopeCommunity.code];
                        else draft.irpfAutonomousDeltas[scopeCommunity.code] = value;
                      })
                    }
                  />
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
                        <label htmlFor={`regional-${instrument.id}`}>
                          <ChangedDot changed={override !== undefined} />
                          {instrument.name}
                        </label>
                        <b>{formatRate(rate, instrument.rateUnit, instrument.unitLabel)}</b>
                      </div>
                      <LeverControls
                        id={`regional-${instrument.id}`}
                        ariaLabel={`${instrument.name} en ${scopeCommunity.name}`}
                        min={instrument.minRate}
                        max={instrument.maxRate}
                        step={instrument.step}
                        value={rate}
                        baseline={instrument.baselineRate}
                        onValue={(value) =>
                          update((draft) => {
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
                  <summary>
                    Partidas de gasto — conjunto de España
                    <CountBadge count={spendingChangedCount} />
                  </summary>
                  {SPENDING_PROGRAMS.map((program) => {
                    const multiplier = settings.spendingMultipliers[program.id] ?? 1;
                    const resultRow = result.spending.find((entry) => entry.id === program.id);
                    const locked = program.minMultiplier === program.maxMultiplier;
                    return (
                      <div className="lab-lever" key={program.id}>
                        <div className="lab-lever-heading">
                          <label htmlFor={`spend-${program.id}`}>
                            <ChangedDot changed={multiplier !== 1} />
                            {program.name}
                          </label>
                          <b>
                            {integerFormat.format(Math.round(program.baselineMEur * multiplier))}{" "}
                            M€
                          </b>
                        </div>
                        {locked ? (
                          <input
                            id={`spend-${program.id}`}
                            type="range"
                            min={program.minMultiplier * 100}
                            max={program.maxMultiplier * 100}
                            step={1}
                            value={multiplier * 100}
                            disabled
                            aria-label={program.name}
                          />
                        ) : (
                          <LeverControls
                            id={`spend-${program.id}`}
                            ariaLabel={`${program.name} (porcentaje de la referencia)`}
                            min={program.minMultiplier * 100}
                            max={program.maxMultiplier * 100}
                            step={1}
                            value={Math.round(multiplier * 100)}
                            baseline={100}
                            onValue={(value) =>
                              update((draft) => {
                                if (value === 100) delete draft.spendingMultipliers[program.id];
                                else draft.spendingMultipliers[program.id] = value / 100;
                              })
                            }
                          />
                        )}
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
                          <label htmlFor={`spend-regional-${program.id}`}>
                            <ChangedDot changed={override !== undefined} />
                            {program.name}
                          </label>
                          <b>
                            {integerFormat.format(Math.round(baselineHere * multiplier))} M€ en{" "}
                            {scopeCommunity!.shortName}
                          </b>
                        </div>
                        <LeverControls
                          id={`spend-regional-${program.id}`}
                          ariaLabel={`${program.name} en ${scopeCommunity!.name} (porcentaje de la referencia)`}
                          min={program.minMultiplier * 100}
                          max={program.maxMultiplier * 100}
                          step={1}
                          value={Math.round(multiplier * 100)}
                          baseline={Math.round((settings.spendingMultipliers[program.id] ?? 1) * 100)}
                          onValue={(value) =>
                            update((draft) => {
                              const overrides =
                                draft.spendingRegionalMultipliers[program.id] ?? {};
                              if (value === Math.round((draft.spendingMultipliers[program.id] ?? 1) * 100)) {
                                delete overrides[scopeCommunity!.code];
                              } else {
                                overrides[scopeCommunity!.code] = value / 100;
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
              <span><i className="legend-negative legend-hatch" /> Empeora (color + rayado)</span>
              <span><i className="legend-neutral" /> Sin cambio</span>
              <span><i className="legend-positive" /> Mejora</span>
            </div>
          </div>

          <div className="lab-challenge-card" ref={challengeRef}>
            <div className="lab-challenge-heading">
              <Target size={17} aria-hidden="true" />
              <div>
                <h2>Reto: cierra el déficit</h2>
                <p>
                  España parte de {formatMEur(result.totals.baselineDeficitMEur)} al año.
                  Combina impuestos y gasto hasta dejar el saldo en positivo.
                </p>
              </div>
              <strong className={result.totals.simulatedDeficitMEur >= 0 ? "lab-pos" : "lab-neg"}>
                {result.totals.simulatedDeficitMEur >= 0
                  ? "¡Déficit cerrado!"
                  : `Faltan ${integerFormat.format(Math.round(-result.totals.simulatedDeficitMEur))} M€`}
              </strong>
            </div>
            <div
              className="lab-challenge-track"
              role="progressbar"
              aria-label="Progreso hacia el equilibrio presupuestario"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(
                Math.max(
                  0,
                  Math.min(
                    1,
                    result.totals.totalBalanceDeltaMEur / -result.totals.baselineDeficitMEur,
                  ),
                ) * 100,
              )}
            >
              <i
                style={{
                  width: `${Math.max(
                    0,
                    Math.min(
                      1,
                      result.totals.totalBalanceDeltaMEur / -result.totals.baselineDeficitMEur,
                    ),
                  ) * 100}%`,
                }}
              />
            </div>
          </div>

          <HouseholdProfileCard settings={settings} activeChanges={activeChanges} />

          <div className="lab-impact-card">
            <div className="lab-impact-heading">
              <Users size={17} aria-hidden="true" />
              <h2>¿A quién afecta este escenario?</h2>
              <button
                type="button"
                className="button button-quiet lab-share-button"
                onClick={() =>
                  downloadShareCard({
                    presetName: activePresetId
                      ? `${getPreset(activePresetId)?.name ?? ""}${presetModified ? " (modificado)" : ""}`
                      : undefined,
                    balanceDeltaMEur: result.totals.totalBalanceDeltaMEur,
                    revenueDeltaMEur: result.totals.revenueDeltaMEur,
                    spendingDeltaMEur: result.totals.spendingDeltaMEur,
                    deficitBeforeShare: baselineDeficitShare,
                    deficitAfterShare: deficitShare,
                    mostAffected: result.distribution.mostAffected.map((group) => ({
                      label: group.label,
                      value: group.netPerHouseholdEur,
                    })),
                    leastAffected: result.distribution.leastAffected.map((group) => ({
                      label: group.label,
                      value: group.netPerHouseholdEur,
                    })),
                    activeChanges,
                  })
                }
              >
                <Download size={14} aria-hidden="true" /> Tarjeta PNG
              </button>
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

          <EmbedSnippet />
        </section>
      </div>
    </div>
  );
}
