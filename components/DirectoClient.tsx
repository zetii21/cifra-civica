"use client";

import { useMemo, useState } from "react";
import { Download, Zap } from "lucide-react";
import { Notice } from "./Ui";
import { downloadShareCard } from "./labShareCard";
import {
  baselineSchedules,
  createDefaultSettings,
  INSTRUMENTS,
  simulateNation,
  SPENDING_PROGRAMS,
  type PolicySettings,
} from "@/lib/fiscal-lab";

const signedInteger = new Intl.NumberFormat("es-ES", {
  maximumFractionDigits: 0,
  signDisplay: "exceptZero",
});
const integerFormat = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 });
const decimalFormat = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 });

interface QuickLever {
  id: string;
  label: string;
  kind: "irpf_state" | "irpf_savings" | "instrument" | "spending";
  index?: number;
  instrumentId?: string;
  min: number;
  max: number;
  step: number;
  baseline: number;
  unit: string;
}

function buildLevers(): QuickLever[] {
  const schedules = baselineSchedules();
  const levers: QuickLever[] = [];
  schedules.stateGeneral.forEach((bracket, index) => {
    levers.push({
      id: `irpf_state_${index}`,
      label: `IRPF estatal — tramo desde ${integerFormat.format(bracket.thresholdEur)} € (${decimalFormat.format(bracket.ratePercent)} %)`,
      kind: "irpf_state",
      index,
      min: -5,
      max: 5,
      step: 0.25,
      baseline: 0,
      unit: "puntos",
    });
  });
  schedules.savings.forEach((bracket, index) => {
    levers.push({
      id: `irpf_savings_${index}`,
      label: `Ahorro y plusvalías — tramo desde ${integerFormat.format(bracket.thresholdEur)} € (${decimalFormat.format(bracket.ratePercent)} %)`,
      kind: "irpf_savings",
      index,
      min: -5,
      max: 8,
      step: 0.25,
      baseline: 0,
      unit: "puntos",
    });
  });
  for (const instrument of INSTRUMENTS) {
    levers.push({
      id: `instrument_${instrument.id}`,
      label: instrument.name,
      kind: "instrument",
      instrumentId: instrument.id,
      min: instrument.minRate,
      max: instrument.maxRate,
      step: instrument.step,
      baseline: instrument.baselineRate,
      unit: instrument.rateUnit === "percent" ? "%" : instrument.unitLabel ?? "€",
    });
  }
  for (const program of SPENDING_PROGRAMS) {
    if (program.minMultiplier === program.maxMultiplier) continue;
    levers.push({
      id: `spending_${program.id}`,
      label: `Gasto — ${program.name}`,
      kind: "spending",
      instrumentId: program.id,
      min: program.minMultiplier * 100,
      max: program.maxMultiplier * 100,
      step: 1,
      baseline: 100,
      unit: "% de la referencia",
    });
  }
  return levers;
}

const LEVERS = buildLevers();

export function DirectoClient() {
  const [leverId, setLeverId] = useState(LEVERS[0].id);
  const [value, setValue] = useState<number>(LEVERS[0].baseline);
  const lever = LEVERS.find((entry) => entry.id === leverId) ?? LEVERS[0];

  const selectLever = (id: string) => {
    const next = LEVERS.find((entry) => entry.id === id) ?? LEVERS[0];
    setLeverId(next.id);
    setValue(next.baseline);
  };

  const settings: PolicySettings = useMemo(() => {
    const active = LEVERS.find((entry) => entry.id === leverId) ?? LEVERS[0];
    const draft = createDefaultSettings();
    if (active.kind === "irpf_state") {
      draft.irpfStateBracketDeltas[active.index!] = value;
    } else if (active.kind === "irpf_savings") {
      draft.irpfSavingsBracketDeltas[active.index!] = value;
    } else if (active.kind === "instrument") {
      if (value !== active.baseline) draft.instrumentRates[active.instrumentId!] = value;
    } else if (value !== 100) {
      draft.spendingMultipliers[active.instrumentId!] = value / 100;
    }
    return draft;
  }, [leverId, value]);

  const result = useMemo(() => simulateNation(settings), [settings]);
  const changed = value !== lever.baseline;
  const deficitBefore = (result.totals.baselineDeficitMEur / result.totals.gdpMEur) * 100;
  const deficitAfter = (result.totals.simulatedDeficitMEur / result.totals.gdpMEur) * 100;
  const description = `${lever.label}: ${lever.kind === "irpf_state" || lever.kind === "irpf_savings" ? `${signedInteger.format(value)} ${lever.unit}` : `${decimalFormat.format(lever.baseline)} → ${decimalFormat.format(value)} ${lever.unit}`}`;

  return (
    <div className="directo-layout">
      <section className="directo-controls" aria-label="Propuesta a evaluar">
        <div className="field">
          <label htmlFor="directo-lever">La propuesta toca…</label>
          <select
            id="directo-lever"
            value={leverId}
            onChange={(event) => selectLever(event.target.value)}
          >
            <optgroup label="IRPF por tramos">
              {LEVERS
                .filter((entry) => entry.kind === "irpf_state" || entry.kind === "irpf_savings")
                .map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.label}
                  </option>
                ))}
            </optgroup>
            <optgroup label="Otros impuestos">
              {LEVERS
                .filter((entry) => entry.kind === "instrument")
                .map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.label}
                  </option>
                ))}
            </optgroup>
            <optgroup label="Partidas de gasto">
              {LEVERS
                .filter((entry) => entry.kind === "spending")
                .map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.label}
                  </option>
                ))}
            </optgroup>
          </select>
        </div>
        <div className="field">
          <label htmlFor="directo-value">
            Magnitud ({lever.unit}): <b>{decimalFormat.format(value)}</b>
          </label>
          <input
            id="directo-value"
            type="range"
            min={lever.min}
            max={lever.max}
            step={lever.step}
            value={value}
            onChange={(event) => setValue(Number(event.target.value))}
          />
        </div>
        <button
          type="button"
          className="button"
          disabled={!changed}
          onClick={() =>
            downloadShareCard({
              presetName: description,
              balanceDeltaMEur: result.totals.totalBalanceDeltaMEur,
              revenueDeltaMEur: result.totals.revenueDeltaMEur,
              spendingDeltaMEur: result.totals.spendingDeltaMEur,
              deficitBeforeShare: deficitBefore,
              deficitAfterShare: deficitAfter,
              mostAffected: result.distribution.mostAffected.map((group) => ({
                label: group.label,
                value: group.netPerHouseholdEur,
              })),
              leastAffected: result.distribution.leastAffected.map((group) => ({
                label: group.label,
                value: group.netPerHouseholdEur,
              })),
              activeChanges: 1,
            })
          }
        >
          <Download size={14} aria-hidden="true" /> Descargar fact-card PNG
        </button>
      </section>

      <section className="directo-result" aria-live="polite">
        <div className="directo-headline">
          <Zap size={17} aria-hidden="true" />
          {changed ? (
            <strong
              className={result.totals.totalBalanceDeltaMEur < 0 ? "lab-neg" : "lab-pos"}
            >
              {signedInteger.format(Math.round(result.totals.totalBalanceDeltaMEur))} M€ al
              año para las cuentas públicas
            </strong>
          ) : (
            <strong>Mueve la magnitud para valorar la propuesta.</strong>
          )}
        </div>
        {changed ? (
          <>
            <p>
              Ingresos {signedInteger.format(Math.round(result.totals.revenueDeltaMEur))} M€ ·
              gasto {signedInteger.format(Math.round(result.totals.spendingDeltaMEur))} M€ ·
              déficit {decimalFormat.format(deficitBefore)} % →{" "}
              {decimalFormat.format(deficitAfter)} % del PIB.
            </p>
            <p className="directo-affected">
              {result.distribution.mostAffected
                .slice(0, 2)
                .map(
                  (group) =>
                    `${group.label}: ${signedInteger.format(Math.round(group.netPerHouseholdEur))} €/año`,
                )
                .join(" · ")}
            </p>
          </>
        ) : null}
        <Notice tone="warning" title="Para el directo, con red">
          Estimación instantánea sobre la referencia aproximada 2024 con elasticidades
          acotadas. Sirve para dimensionar una promesa en segundos, no para liquidarla; el
          detalle y las advertencias completas están en el laboratorio.
        </Notice>
      </section>
    </div>
  );
}
