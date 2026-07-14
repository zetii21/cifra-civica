/**
 * Enumerates the active policy changes of a laboratory configuration as
 * human-readable, individually undoable items (the "change tray").
 */
import {
  baselineSchedules,
  COMMUNITY_BY_CODE,
  INSTRUMENT_BY_ID,
  SPENDING_BY_ID,
  type CommunityCode,
  type PolicySettings,
} from "@/lib/fiscal-lab";

const integerFormat = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 });
const decimalFormat = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 });
const signedDecimal = new Intl.NumberFormat("es-ES", {
  maximumFractionDigits: 2,
  signDisplay: "exceptZero",
});

export interface ActiveChange {
  id: string;
  label: string;
  detail: string;
  undo: (draft: PolicySettings) => void;
}

function rateText(value: number, unit: "percent" | "eurosPerUnit", unitLabel?: string): string {
  return unit === "percent"
    ? `${decimalFormat.format(value)} %`
    : `${decimalFormat.format(value)} ${unitLabel ?? "€"}`;
}

export function listActiveChanges(settings: PolicySettings): ActiveChange[] {
  const schedules = baselineSchedules();
  const changes: ActiveChange[] = [];

  settings.irpfStateBracketDeltas.forEach((delta, index) => {
    if (delta === 0) return;
    const bracket = schedules.stateGeneral[index];
    changes.push({
      id: `state-${index}`,
      label: `IRPF estatal · desde ${integerFormat.format(bracket.thresholdEur)} €`,
      detail: `${decimalFormat.format(bracket.ratePercent)} % → ${decimalFormat.format(Math.max(0, bracket.ratePercent + delta))} %`,
      undo: (draft) => {
        draft.irpfStateBracketDeltas[index] = 0;
      },
    });
  });

  settings.irpfSavingsBracketDeltas.forEach((delta, index) => {
    if (delta === 0) return;
    const bracket = schedules.savings[index];
    changes.push({
      id: `savings-${index}`,
      label: `Ahorro · desde ${integerFormat.format(bracket.thresholdEur)} €`,
      detail: `${decimalFormat.format(bracket.ratePercent)} % → ${decimalFormat.format(Math.max(0, bracket.ratePercent + delta))} %`,
      undo: (draft) => {
        draft.irpfSavingsBracketDeltas[index] = 0;
      },
    });
  });

  for (const [code, delta] of Object.entries(settings.irpfAutonomousDeltas)) {
    if (!delta) continue;
    const community = COMMUNITY_BY_CODE.get(code as CommunityCode);
    changes.push({
      id: `auto-${code}`,
      label: `IRPF ${community?.regime === "foral" ? "foral" : "autonómico"} · ${community?.name ?? code}`,
      detail: `${signedDecimal.format(delta)} puntos en todos los tramos`,
      undo: (draft) => {
        delete draft.irpfAutonomousDeltas[code as CommunityCode];
      },
    });
  }

  for (const [id, rate] of Object.entries(settings.instrumentRates)) {
    const instrument = INSTRUMENT_BY_ID.get(id);
    if (!instrument) continue;
    changes.push({
      id: `instrument-${id}`,
      label: instrument.shortName,
      detail: `${rateText(instrument.baselineRate, instrument.rateUnit, instrument.unitLabel)} → ${rateText(rate, instrument.rateUnit, instrument.unitLabel)}`,
      undo: (draft) => {
        delete draft.instrumentRates[id];
      },
    });
  }

  for (const [id, overrides] of Object.entries(settings.instrumentRegionalRates)) {
    const instrument = INSTRUMENT_BY_ID.get(id);
    if (!instrument) continue;
    for (const [code, rate] of Object.entries(overrides)) {
      const community = COMMUNITY_BY_CODE.get(code as CommunityCode);
      changes.push({
        id: `instrument-${id}-${code}`,
        label: `${instrument.shortName} · ${community?.shortName ?? code}`,
        detail: `${rateText(instrument.baselineRate, instrument.rateUnit, instrument.unitLabel)} → ${rateText(rate as number, instrument.rateUnit, instrument.unitLabel)}`,
        undo: (draft) => {
          const entry = draft.instrumentRegionalRates[id];
          if (!entry) return;
          delete entry[code as CommunityCode];
          if (Object.keys(entry).length === 0) delete draft.instrumentRegionalRates[id];
        },
      });
    }
  }

  for (const [id, multiplier] of Object.entries(settings.spendingMultipliers)) {
    const program = SPENDING_BY_ID.get(id);
    if (!program) continue;
    changes.push({
      id: `spend-${id}`,
      label: `Gasto · ${program.shortName}`,
      detail: `100 % → ${integerFormat.format(multiplier * 100)} % (${signedDecimal.format(Math.round(program.baselineMEur * (multiplier - 1)))} M€)`,
      undo: (draft) => {
        delete draft.spendingMultipliers[id];
      },
    });
  }

  for (const [id, overrides] of Object.entries(settings.spendingRegionalMultipliers)) {
    const program = SPENDING_BY_ID.get(id);
    if (!program) continue;
    for (const [code, multiplier] of Object.entries(overrides)) {
      const community = COMMUNITY_BY_CODE.get(code as CommunityCode);
      changes.push({
        id: `spend-${id}-${code}`,
        label: `Gasto · ${program.shortName} · ${community?.shortName ?? code}`,
        detail: `→ ${integerFormat.format((multiplier as number) * 100)} % en la comunidad`,
        undo: (draft) => {
          const entry = draft.spendingRegionalMultipliers[id];
          if (!entry) return;
          delete entry[code as CommunityCode];
          if (Object.keys(entry).length === 0) delete draft.spendingRegionalMultipliers[id];
        },
      });
    }
  }

  return changes;
}
