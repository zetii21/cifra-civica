/**
 * IRPF schedule engine for the national laboratory. Common-territory state
 * and autonomous general scales are read from the versioned policy registry;
 * foral scales (Navarra, País Vasco) are reviewed approximations flagged in
 * every output. All computation happens on aggregate synthetic segments.
 */
import parametersJson from "../../policy-registry/parameters/es-common-reference-2026-v1.json";
import {
  buildSegments,
  COMMUNITIES,
  type Segment,
} from "./demography";
import {
  AGE_BANDS,
  FAMILY_TYPES,
  type BracketDefinition,
  type CommunityCode,
  type FamilyTypeId,
  type IrpfScheduleSet,
} from "./types";

interface RegistryBracket {
  thresholdCents: number;
  rateBasisPoints: number;
}

interface RegistryParameters {
  irpf: {
    stateGeneralScale: RegistryBracket[];
    stateSavingsScale: RegistryBracket[];
    autonomousSavingsScale: RegistryBracket[];
    autonomousGeneralScales: Record<string, RegistryBracket[]>;
  };
}

const registry = parametersJson as unknown as RegistryParameters;

function fromRegistry(brackets: RegistryBracket[]): BracketDefinition[] {
  return brackets.map((bracket) => ({
    thresholdEur: bracket.thresholdCents / 100,
    ratePercent: bracket.rateBasisPoints / 100,
  }));
}

/** Combines the state and autonomous savings halves into a single schedule. */
function combinedSavingsSchedule(): BracketDefinition[] {
  const state = fromRegistry(registry.irpf.stateSavingsScale);
  const autonomous = fromRegistry(registry.irpf.autonomousSavingsScale);
  return state.map((bracket, index) => ({
    thresholdEur: bracket.thresholdEur,
    ratePercent: bracket.ratePercent + (autonomous[index]?.ratePercent ?? bracket.ratePercent),
  }));
}

/**
 * Foral general scales, reviewed approximations of the 2025 statutory
 * schedules (Navarra; País Vasco common-diputación structure). They exist so
 * the laboratory can show foral territories instead of silently substituting
 * common-territory rules, and they are labelled as approximations.
 */
const FORAL_GENERAL: Record<string, BracketDefinition[]> = {
  "15": [
    { thresholdEur: 0, ratePercent: 13 },
    { thresholdEur: 4_458, ratePercent: 22 },
    { thresholdEur: 10_030, ratePercent: 25 },
    { thresholdEur: 21_175, ratePercent: 28 },
    { thresholdEur: 35_663, ratePercent: 36.5 },
    { thresholdEur: 51_266, ratePercent: 41.5 },
    { thresholdEur: 66_144, ratePercent: 44 },
    { thresholdEur: 89_159, ratePercent: 47 },
    { thresholdEur: 139_366, ratePercent: 49 },
    { thresholdEur: 195_000, ratePercent: 50.5 },
    { thresholdEur: 334_469, ratePercent: 54 },
  ],
  "16": [
    { thresholdEur: 0, ratePercent: 23 },
    { thresholdEur: 17_720, ratePercent: 28 },
    { thresholdEur: 35_440, ratePercent: 35 },
    { thresholdEur: 53_160, ratePercent: 40 },
    { thresholdEur: 76_680, ratePercent: 45 },
    { thresholdEur: 102_040, ratePercent: 46 },
    { thresholdEur: 139_130, ratePercent: 47 },
    { thresholdEur: 202_920, ratePercent: 49 },
  ],
};

/** Quota credits that approximate foral personal minima. */
const FORAL_QUOTA_CREDIT_EUR: Record<string, number> = { "15": 985, "16": 1_432 };

/** Rebate applied to the full quota in Ceuta and Melilla (60 %). */
const CIUDAD_AUTONOMA_REBATE = 0.6;

export function baselineSchedules(): IrpfScheduleSet {
  return {
    stateGeneral: fromRegistry(registry.irpf.stateGeneralScale),
    autonomousGeneral: Object.fromEntries(
      Object.entries(registry.irpf.autonomousGeneralScales).map(([code, scale]) => [
        code,
        fromRegistry(scale),
      ]),
    ),
    foralGeneral: FORAL_GENERAL,
    savings: combinedSavingsSchedule(),
  };
}

export function progressiveTaxEur(baseEur: number, schedule: BracketDefinition[]): number {
  if (baseEur <= 0) return 0;
  let tax = 0;
  for (let index = 0; index < schedule.length; index += 1) {
    const lower = schedule[index].thresholdEur;
    if (baseEur <= lower) break;
    const upper = index + 1 < schedule.length ? schedule[index + 1].thresholdEur : Infinity;
    const taxable = Math.min(baseEur, upper) - lower;
    tax += (taxable * Math.max(0, schedule[index].ratePercent)) / 100;
  }
  return tax;
}

export function applyBracketDeltas(
  schedule: BracketDefinition[],
  deltas: number[],
): BracketDefinition[] {
  return schedule.map((bracket, index) => ({
    thresholdEur: bracket.thresholdEur,
    ratePercent: Math.max(0, bracket.ratePercent + (deltas[index] ?? 0)),
  }));
}

export function applyUniformDelta(
  schedule: BracketDefinition[],
  delta: number,
): BracketDefinition[] {
  return schedule.map((bracket) => ({
    thresholdEur: bracket.thresholdEur,
    ratePercent: Math.max(0, bracket.ratePercent + delta),
  }));
}

interface FilerModel {
  /** Number of modelled filers and their income split within the household. */
  splits: number[];
  /** Personal + family minimum assigned to each filer, €/year. */
  minimums: number[];
}

/** Simplified filing structure per family type (documented approximation). */
const FILER_MODEL: Record<FamilyTypeId, FilerModel> = {
  unipersonal: { splits: [1], minimums: [5_550] },
  pareja_sin_hijos: { splits: [0.62, 0.38], minimums: [5_550, 5_550] },
  pareja_con_hijos: { splits: [0.62, 0.38], minimums: [10_150, 5_550] },
  monoparental: { splits: [1], minimums: [12_360] },
  otros: { splits: [0.55, 0.45], minimums: [5_550, 5_550] },
};

const OVER_65_MINIMUM_INCREMENT_EUR = 1_150;

/** Share of gross household income that forms the general taxable base. */
const GENERAL_BASE_FACTOR = 0.88;
const GENERAL_BASE_FLOOR_DEDUCTION_EUR = 2_000;

/** Savings taxable base as a share of gross income, per income band. */
export const SAVINGS_BASE_SHARE_BY_BAND = [
  0.002, 0.003, 0.005, 0.007, 0.01, 0.013, 0.017, 0.023, 0.04, 0.06, 0.09, 0.2, 0.42,
];

export interface SegmentIrpf {
  /** State-half general quota, €/household. Zero in foral territories. */
  stateGeneralEur: number;
  /** Autonomous-half (or full foral) general quota, €/household. */
  autonomousGeneralEur: number;
  /** Savings quota, €/household (split later between state and community). */
  savingsEur: number;
}

export interface IrpfComputationInput {
  stateSchedule: BracketDefinition[];
  autonomousSchedules: Record<string, BracketDefinition[]>;
  foralSchedules: Record<string, BracketDefinition[]>;
  savingsSchedule: BracketDefinition[];
}

function generalBase(segment: Segment): number {
  return Math.max(
    0,
    segment.grossIncomeEur * GENERAL_BASE_FACTOR - GENERAL_BASE_FLOOR_DEDUCTION_EUR,
  );
}

function savingsBase(segment: Segment): number {
  return segment.grossIncomeEur * SAVINGS_BASE_SHARE_BY_BAND[segment.band];
}

function scheduleTaxWithMinimum(
  base: number,
  minimum: number,
  schedule: BracketDefinition[],
): number {
  return Math.max(
    0,
    progressiveTaxEur(base, schedule) - progressiveTaxEur(Math.min(base, minimum), schedule),
  );
}

/** Computes the household IRPF quotas of one segment under given schedules. */
export function segmentIrpf(segment: Segment, input: IrpfComputationInput): SegmentIrpf {
  const model = FILER_MODEL[segment.familyType];
  const base = generalBase(segment);
  const over65 = segment.ageBand === "mayores_65" ? OVER_65_MINIMUM_INCREMENT_EUR : 0;
  const savings = savingsBase(segment);
  const foral = input.foralSchedules[segment.community];

  if (foral) {
    let quota = 0;
    for (let filer = 0; filer < model.splits.length; filer += 1) {
      const filerBase = base * model.splits[filer];
      quota += Math.max(
        0,
        progressiveTaxEur(filerBase, foral) - FORAL_QUOTA_CREDIT_EUR[segment.community],
      );
    }
    const savingsQuota = progressiveTaxEur(savings, input.savingsSchedule);
    return { stateGeneralEur: 0, autonomousGeneralEur: quota + savingsQuota, savingsEur: 0 };
  }

  const autonomousSchedule =
    input.autonomousSchedules[segment.community] ?? input.stateSchedule;
  let stateQuota = 0;
  let autonomousQuota = 0;
  for (let filer = 0; filer < model.splits.length; filer += 1) {
    const filerBase = base * model.splits[filer];
    const minimum = model.minimums[filer] + (filer === 0 ? over65 : 0);
    stateQuota += scheduleTaxWithMinimum(filerBase, minimum, input.stateSchedule);
    autonomousQuota += scheduleTaxWithMinimum(filerBase, minimum, autonomousSchedule);
  }
  const savingsQuota = progressiveTaxEur(savings, input.savingsSchedule);
  const rebate =
    segment.community === "18" || segment.community === "19" ? 1 - CIUDAD_AUTONOMA_REBATE : 1;
  return {
    stateGeneralEur: stateQuota * rebate,
    autonomousGeneralEur: autonomousQuota * rebate,
    savingsEur: savingsQuota * rebate,
  };
}

/**
 * Reference IRPF revenue targets in M€ (approximate 2024): AEAT common
 * territory net quota by community plus foral treasuries' own collection.
 */
export const IRPF_TARGET_MEUR: Record<CommunityCode, number> = {
  "01": 15_950,
  "02": 4_010,
  "03": 2_980,
  "04": 3_500,
  "05": 4_500,
  "06": 1_680,
  "07": 6_330,
  "08": 4_400,
  "09": 27_950,
  "10": 12_020,
  "11": 1_810,
  "12": 6_470,
  "13": 33_000,
  "14": 3_370,
  "15": 1_900,
  "16": 7_400,
  "17": 900,
  "18": 190,
  "19": 190,
};

export interface CalibratedIrpfModel {
  /** Multiplicative calibration factor per community. */
  factors: Record<CommunityCode, number>;
  /** Baseline quota per community in M€ after calibration. */
  baselineByCommunity: Record<CommunityCode, { state: number; autonomous: number; savings: number }>;
}

let cachedCalibration: CalibratedIrpfModel | undefined;

/**
 * Calibrates the synthetic segment model so its baseline IRPF matches the
 * published per-community reference revenue. The factor absorbs credits,
 * deductions and base differences the aggregate model does not represent,
 * and stays constant across policy changes.
 */
export function calibrateIrpf(): CalibratedIrpfModel {
  if (cachedCalibration) return cachedCalibration;
  const schedules = baselineSchedules();
  const input: IrpfComputationInput = {
    stateSchedule: schedules.stateGeneral,
    autonomousSchedules: schedules.autonomousGeneral,
    foralSchedules: schedules.foralGeneral,
    savingsSchedule: schedules.savings,
  };
  const rawByCommunity = new Map<CommunityCode, { state: number; autonomous: number; savings: number }>();
  for (const segment of buildSegments()) {
    const quotas = segmentIrpf(segment, input);
    const record = rawByCommunity.get(segment.community) ?? { state: 0, autonomous: 0, savings: 0 };
    record.state += (quotas.stateGeneralEur * segment.households) / 1e6;
    record.autonomous += (quotas.autonomousGeneralEur * segment.households) / 1e6;
    record.savings += (quotas.savingsEur * segment.households) / 1e6;
    rawByCommunity.set(segment.community, record);
  }
  const factors = {} as Record<CommunityCode, number>;
  const baselineByCommunity = {} as Record<
    CommunityCode,
    { state: number; autonomous: number; savings: number }
  >;
  for (const community of COMMUNITIES) {
    const raw = rawByCommunity.get(community.code) ?? { state: 0, autonomous: 0, savings: 0 };
    const rawTotal = raw.state + raw.autonomous + raw.savings;
    const factor = rawTotal > 0 ? IRPF_TARGET_MEUR[community.code] / rawTotal : 0;
    factors[community.code] = factor;
    baselineByCommunity[community.code] = {
      state: raw.state * factor,
      autonomous: raw.autonomous * factor,
      savings: raw.savings * factor,
    };
  }
  cachedCalibration = { factors, baselineByCommunity };
  return cachedCalibration;
}

export interface IrpfSimulationResult {
  /** M€ by community: state half, autonomous (or foral) half and savings. */
  byCommunity: Record<CommunityCode, { state: number; autonomous: number; savings: number }>;
  /** Per-segment household quota deltas versus baseline, €/household·year. */
  segmentDeltaEur: Float64Array;
  /** Elementary parameter evaluations performed. */
  evaluations: number;
}

export interface IrpfAdjustments {
  stateBracketDeltas: number[];
  autonomousDeltas: Partial<Record<CommunityCode, number>>;
  savingsBracketDeltas: number[];
}

/** Taxable-income behavioural response to the marginal-rate change. */
const TAXABLE_INCOME_ELASTICITY = 0.25;

export function simulateIrpf(adjustments: IrpfAdjustments): IrpfSimulationResult {
  const schedules = baselineSchedules();
  const calibration = calibrateIrpf();
  const segments = buildSegments();

  const baselineInput: IrpfComputationInput = {
    stateSchedule: schedules.stateGeneral,
    autonomousSchedules: schedules.autonomousGeneral,
    foralSchedules: schedules.foralGeneral,
    savingsSchedule: schedules.savings,
  };
  const adjustedInput: IrpfComputationInput = {
    stateSchedule: applyBracketDeltas(schedules.stateGeneral, adjustments.stateBracketDeltas),
    autonomousSchedules: Object.fromEntries(
      Object.entries(schedules.autonomousGeneral).map(([code, schedule]) => [
        code,
        applyUniformDelta(
          schedule,
          adjustments.autonomousDeltas[code as CommunityCode] ?? 0,
        ),
      ]),
    ),
    foralSchedules: Object.fromEntries(
      Object.entries(schedules.foralGeneral).map(([code, schedule]) => [
        code,
        applyUniformDelta(
          schedule,
          adjustments.autonomousDeltas[code as CommunityCode] ?? 0,
        ),
      ]),
    ),
    savingsSchedule: applyBracketDeltas(schedules.savings, adjustments.savingsBracketDeltas),
  };

  const byCommunity = {} as Record<
    CommunityCode,
    { state: number; autonomous: number; savings: number }
  >;
  for (const community of COMMUNITIES) {
    byCommunity[community.code] = { state: 0, autonomous: 0, savings: 0 };
  }
  const segmentDeltaEur = new Float64Array(segments.length);
  let evaluations = 0;

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const factor = calibration.factors[segment.community];
    const baseline = segmentIrpf(segment, baselineInput);
    const adjusted = segmentIrpf(segment, adjustedInput);

    const baselineTotal =
      baseline.stateGeneralEur + baseline.autonomousGeneralEur + baseline.savingsEur;
    const adjustedTotal =
      adjusted.stateGeneralEur + adjusted.autonomousGeneralEur + adjusted.savingsEur;
    // Behavioural attenuation: part of a mechanical increase erodes the base.
    const mechanicalDelta = adjustedTotal - baselineTotal;
    const averageRate = baselineTotal > 0 ? baselineTotal / Math.max(1, segment.grossIncomeEur) : 0;
    const attenuation =
      baselineTotal > 0 && mechanicalDelta !== 0
        ? Math.max(
            0.45,
            1 - TAXABLE_INCOME_ELASTICITY * Math.min(1.6, Math.abs(mechanicalDelta) / Math.max(1, baselineTotal)) * (1 + 2 * averageRate),
          )
        : 1;
    const scale = (component: number, componentBaseline: number) =>
      (componentBaseline + (component - componentBaseline) * attenuation) * factor;

    const state = scale(adjusted.stateGeneralEur, baseline.stateGeneralEur);
    const autonomous = scale(adjusted.autonomousGeneralEur, baseline.autonomousGeneralEur);
    const savings = scale(adjusted.savingsEur, baseline.savingsEur);

    const record = byCommunity[segment.community];
    record.state += (state * segment.households) / 1e6;
    record.autonomous += (autonomous * segment.households) / 1e6;
    record.savings += (savings * segment.households) / 1e6;

    const calibratedBaseline = baselineTotal * factor;
    segmentDeltaEur[index] = state + autonomous + savings - calibratedBaseline;

    // Two schedule passes over every filer and bracket plus behavioural terms.
    evaluations +=
      2 *
      (FILER_MODEL[segment.familyType].splits.length *
        (baselineInput.stateSchedule.length + 9) +
        baselineInput.savingsSchedule.length) +
      6;
  }

  return { byCommunity, segmentDeltaEur, evaluations };
}

export function familyTypeLabel(id: FamilyTypeId): string {
  return FAMILY_TYPES.find((familyType) => familyType.id === id)?.label ?? id;
}

export function ageBandLabel(id: string): string {
  return AGE_BANDS.find((ageBand) => ageBand.id === id)?.label ?? id;
}
