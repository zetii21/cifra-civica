/**
 * National fiscal-laboratory engine. Takes user policy settings (rate and
 * spending changes at state or community scope) and produces revenue,
 * spending, territorial and distributional outcomes over the synthetic
 * segment population. Aggregate public statistics only; no personal data.
 */
import {
  AGE_BANDS,
  DECILE_COUNT,
  FAMILY_TYPES,
  type CommunityCode,
  type CommunityOutcome,
  type DistributionalResult,
  type GroupImpact,
  type InstrumentDefinition,
  type InstrumentResult,
  type NationalSimulation,
  type PolicySettings,
  type SpendingProgram,
  type SpendingResult,
} from "./types";
import {
  buildSegments,
  COMMUNITIES,
  NATIONAL_GDP_MEUR,
  type Segment,
} from "./demography";
import { INSTRUMENTS } from "./instruments";
import {
  OTHER_REVENUE_MEUR,
  OTHER_SPENDING_MEUR,
  SPENDING_PROGRAMS,
} from "./spending";
import { baselineSchedules, calibrateIrpf, simulateIrpf } from "./irpf";

export const LAB_MODEL_VERSION = "cifra-civica-lab-1.0.0";

/** Communities whose treasuries collect state-equivalent taxes themselves. */
const FORAL_COMMUNITIES: ReadonlySet<CommunityCode> = new Set(["15", "16"]);

/** Instruments the foral agreement does not transfer (social security). */
const NON_FORAL_INSTRUMENTS: ReadonlySet<string> = new Set(["cotizaciones", "loterias"]);

const MIN_BASE_FACTOR = 0.2;
const MAX_BASE_FACTOR = 1.8;

export function createDefaultSettings(): PolicySettings {
  const schedules = baselineSchedules();
  return {
    irpfStateBracketDeltas: schedules.stateGeneral.map(() => 0),
    irpfAutonomousDeltas: {},
    irpfSavingsBracketDeltas: schedules.savings.map(() => 0),
    instrumentRates: {},
    instrumentRegionalRates: {},
    spendingMultipliers: {},
    spendingRegionalMultipliers: {},
  };
}

function emptyCommunityRecord(): Record<CommunityCode, number> {
  return Object.fromEntries(COMMUNITIES.map((community) => [community.code, 0])) as Record<
    CommunityCode,
    number
  >;
}

/** Effective per-community weights after exclusions, re-normalised to 1. */
function effectiveWeights(instrument: InstrumentDefinition): Record<CommunityCode, number> {
  const excluded = new Set(instrument.excludedCommunities ?? []);
  const weights = emptyCommunityRecord();
  let total = 0;
  for (const community of COMMUNITIES) {
    const weight = excluded.has(community.code) ? 0 : instrument.regionalWeights[community.code];
    weights[community.code] = weight;
    total += weight;
  }
  for (const community of COMMUNITIES) weights[community.code] /= total;
  return weights;
}

interface InstrumentEvaluation {
  result: InstrumentResult;
  /** Household-borne burden delta per community, M€ (positive = pay more). */
  householdBurdenByCommunity: Record<CommunityCode, number>;
  evaluations: number;
}

function evaluateInstrument(
  instrument: InstrumentDefinition,
  settings: PolicySettings,
): InstrumentEvaluation {
  const weights = effectiveWeights(instrument);
  const nationalRate = settings.instrumentRates[instrument.id] ?? instrument.baselineRate;
  const regionalOverrides = instrument.regionallyAdjustable
    ? settings.instrumentRegionalRates[instrument.id] ?? {}
    : {};

  const regionalDelta = emptyCommunityRecord();
  const householdBurden = emptyCommunityRecord();
  let simulated = 0;
  let mechanical = 0;
  let stateDelta = 0;
  let evaluations = 0;

  for (const community of COMMUNITIES) {
    const weight = weights[community.code];
    const baselineRegional = instrument.baselineRevenueMEur * weight;
    const rate = regionalOverrides[community.code] ?? nationalRate;
    const rateRatio = instrument.baselineRate > 0 ? rate / instrument.baselineRate : 1;
    const baseFactor = Math.min(
      MAX_BASE_FACTOR,
      Math.max(MIN_BASE_FACTOR, 1 + instrument.baseElasticity * (rateRatio - 1)),
    );
    const simulatedRegional = baselineRegional * rateRatio * baseFactor;
    const mechanicalRegional = baselineRegional * rateRatio;
    simulated += simulatedRegional;
    mechanical += mechanicalRegional;
    const delta = simulatedRegional - baselineRegional;

    const foralKeepsIt =
      FORAL_COMMUNITIES.has(community.code) && !NON_FORAL_INSTRUMENTS.has(instrument.id);
    if (instrument.attribution.kind === "regional" || foralKeepsIt) {
      regionalDelta[community.code] += delta;
    } else {
      const ceded = delta * instrument.attribution.cededShare;
      regionalDelta[community.code] += ceded;
      stateDelta += delta - ceded;
    }
    householdBurden[community.code] += delta * (instrument.householdBorneShare ?? 1);
    evaluations += 8;
  }

  const baseline = instrument.baselineRevenueMEur;
  return {
    result: {
      id: instrument.id,
      name: instrument.name,
      group: instrument.group,
      baselineRevenueMEur: baseline,
      simulatedRevenueMEur: simulated,
      deltaMEur: simulated - baseline,
      stateDeltaMEur: stateDelta,
      regionalDeltaMEur: regionalDelta,
      behaviouralOffsetMEur: simulated - mechanical,
    },
    householdBurdenByCommunity: householdBurden,
    evaluations,
  };
}

interface SpendingEvaluation {
  result: SpendingResult;
  /** Household benefit delta per community, M€ (positive = receive more). */
  householdBenefitByCommunity: Record<CommunityCode, number>;
  evaluations: number;
}

function evaluateProgram(
  program: SpendingProgram,
  settings: PolicySettings,
): SpendingEvaluation {
  const nationalMultiplier = settings.spendingMultipliers[program.id] ?? 1;
  const regionalOverrides = program.regionallyAdjustable
    ? settings.spendingRegionalMultipliers[program.id] ?? {}
    : {};

  const regionalDelta = emptyCommunityRecord();
  const householdBenefit = emptyCommunityRecord();
  let simulated = 0;
  let stateDelta = 0;
  let evaluations = 0;

  for (const community of COMMUNITIES) {
    const weight = program.regionalWeights[community.code];
    const baselineHere = program.baselineMEur * weight;
    const multiplier = regionalOverrides[community.code] ?? nationalMultiplier;
    const simulatedHere = baselineHere * multiplier;
    simulated += simulatedHere;
    const delta = simulatedHere - baselineHere;

    // Budget attribution: regional share is executed by the community, the
    // rest by central government (even when the benefit lands regionally).
    regionalDelta[community.code] += delta * program.regionalShare;
    stateDelta += delta * (1 - program.regionalShare);
    householdBenefit[community.code] += delta;
    evaluations += 6;
  }

  return {
    result: {
      id: program.id,
      name: program.name,
      baselineMEur: program.baselineMEur,
      simulatedMEur: simulated,
      deltaMEur: simulated - program.baselineMEur,
      stateDeltaMEur: stateDelta,
      regionalDeltaMEur: regionalDelta,
    },
    householdBenefitByCommunity: householdBenefit,
    evaluations,
  };
}

interface SegmentAllocator {
  /** Share of a community-level amount attributed to each segment (per community). */
  allocate(profileOwner: { incidence: InstrumentDefinition["incidence"] }): Float64Array;
}

/**
 * Builds an allocator that distributes a per-community amount across that
 * community's segments using the marginal incidence profiles as raking
 * multipliers over the joint household structure.
 */
function buildAllocator(segments: Segment[]): SegmentAllocator {
  const decileShare = new Array<number>(DECILE_COUNT).fill(0);
  const familyShare = new Array<number>(FAMILY_TYPES.length).fill(0);
  const ageShare = new Array<number>(AGE_BANDS.length).fill(0);
  const familyIndex = new Map(FAMILY_TYPES.map((entry, index) => [entry.id, index]));
  const ageIndex = new Map(AGE_BANDS.map((entry, index) => [entry.id, index]));
  let totalHouseholds = 0;
  for (const segment of segments) {
    totalHouseholds += segment.households;
    decileShare[segment.decile] += segment.households;
    familyShare[familyIndex.get(segment.familyType)!] += segment.households;
    ageShare[ageIndex.get(segment.ageBand)!] += segment.households;
  }
  for (let index = 0; index < decileShare.length; index += 1) decileShare[index] /= totalHouseholds;
  for (let index = 0; index < familyShare.length; index += 1) familyShare[index] /= totalHouseholds;
  for (let index = 0; index < ageShare.length; index += 1) ageShare[index] /= totalHouseholds;

  const communityIndex = new Map(COMMUNITIES.map((community, index) => [community.code, index]));

  return {
    allocate(owner) {
      const { incidence } = owner;
      const raw = new Float64Array(segments.length);
      const communityTotals = new Float64Array(COMMUNITIES.length);
      for (let index = 0; index < segments.length; index += 1) {
        const segment = segments[index];
        const multiplier =
          (incidence.deciles[segment.decile] / decileShare[segment.decile]) *
          (incidence.familyTypes[familyIndex.get(segment.familyType)!] /
            familyShare[familyIndex.get(segment.familyType)!]) *
          (incidence.ageBands[ageIndex.get(segment.ageBand)!] /
            ageShare[ageIndex.get(segment.ageBand)!]);
        const value = segment.households * multiplier;
        raw[index] = value;
        communityTotals[communityIndex.get(segment.community)!] += value;
      }
      for (let index = 0; index < segments.length; index += 1) {
        const segment = segments[index];
        const total = communityTotals[communityIndex.get(segment.community)!];
        raw[index] = total > 0 ? raw[index] / total : 0;
      }
      return raw;
    },
  };
}

function groupImpacts(
  segments: Segment[],
  taxDeltaEur: Float64Array,
  benefitDeltaEur: Float64Array,
  keyOf: (segment: Segment) => string,
  labelOf: (key: string) => string,
  order: string[],
): GroupImpact[] {
  const byKey = new Map<string, { tax: number; benefit: number; households: number }>();
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const key = keyOf(segment);
    const record = byKey.get(key) ?? { tax: 0, benefit: 0, households: 0 };
    record.tax += taxDeltaEur[index] * segment.households;
    record.benefit += benefitDeltaEur[index] * segment.households;
    record.households += segment.households;
    byKey.set(key, record);
  }
  return order.map((key) => {
    const record = byKey.get(key) ?? { tax: 0, benefit: 0, households: 0 };
    const households = Math.max(1, record.households);
    return {
      id: key,
      label: labelOf(key),
      netPerHouseholdEur: (record.benefit - record.tax) / households,
      taxPerHouseholdEur: record.tax / households,
      benefitPerHouseholdEur: record.benefit / households,
      households: record.households,
    };
  });
}

/** Runs the full national simulation for the given settings. */
export function simulateNation(settings: PolicySettings): NationalSimulation {
  const segments = buildSegments();
  const allocator = buildAllocator(segments);
  let evaluations = 0;

  // Per-segment household € deltas (tax burden and spending benefit).
  const segmentTaxDeltaEur = new Float64Array(segments.length);
  const segmentBenefitDeltaEur = new Float64Array(segments.length);

  // IRPF (exact schedule arithmetic over segments).
  const irpf = simulateIrpf({
    stateBracketDeltas: settings.irpfStateBracketDeltas,
    autonomousDeltas: settings.irpfAutonomousDeltas,
    savingsBracketDeltas: settings.irpfSavingsBracketDeltas,
  });
  evaluations += irpf.evaluations;
  const irpfCalibration = calibrateIrpf();
  const irpfRegionalDelta = emptyCommunityRecord();
  let irpfStateDelta = 0;
  let irpfBaselineTotal = 0;
  let irpfSimulatedTotal = 0;
  for (const community of COMMUNITIES) {
    const baseline = irpfCalibration.baselineByCommunity[community.code];
    const simulated = irpf.byCommunity[community.code];
    const baselineTotal = baseline.state + baseline.autonomous + baseline.savings;
    const simulatedTotal = simulated.state + simulated.autonomous + simulated.savings;
    irpfBaselineTotal += baselineTotal;
    irpfSimulatedTotal += simulatedTotal;
    if (FORAL_COMMUNITIES.has(community.code)) {
      irpfRegionalDelta[community.code] += simulatedTotal - baselineTotal;
    } else {
      // Autonomous half plus half of savings accrue to the community.
      const communityDelta =
        simulated.autonomous - baseline.autonomous + (simulated.savings - baseline.savings) / 2;
      irpfRegionalDelta[community.code] += communityDelta;
      irpfStateDelta += simulatedTotal - baselineTotal - communityDelta;
    }
  }
  for (let index = 0; index < segments.length; index += 1) {
    segmentTaxDeltaEur[index] += irpf.segmentDeltaEur[index];
  }

  const irpfResult: InstrumentResult = {
    id: "irpf",
    name: "IRPF (estatal, autonómico y foral)",
    group: "renta",
    baselineRevenueMEur: irpfBaselineTotal,
    simulatedRevenueMEur: irpfSimulatedTotal,
    deltaMEur: irpfSimulatedTotal - irpfBaselineTotal,
    stateDeltaMEur: irpfStateDelta,
    regionalDeltaMEur: irpfRegionalDelta,
    behaviouralOffsetMEur: 0,
  };

  // Other instruments. IRPF household burden comes from exact segment deltas.
  const instrumentResults: InstrumentResult[] = [irpfResult];
  const householdBurdenByCommunity = emptyCommunityRecord();
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    householdBurdenByCommunity[segment.community] +=
      (irpf.segmentDeltaEur[index] * segment.households) / 1e6;
  }

  for (const instrument of INSTRUMENTS) {
    const evaluation = evaluateInstrument(instrument, settings);
    instrumentResults.push(evaluation.result);
    evaluations += evaluation.evaluations;

    const allocation = allocator.allocate(instrument);
    evaluations += segments.length * 4;
    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index];
      const communityBurdenMEur =
        evaluation.householdBurdenByCommunity[segment.community];
      if (communityBurdenMEur === 0) continue;
      const shareOfCommunity = allocation[index];
      const amountEur =
        (communityBurdenMEur * 1e6 * shareOfCommunity) / Math.max(1, segment.households);
      segmentTaxDeltaEur[index] += amountEur;
    }
    for (const community of COMMUNITIES) {
      householdBurdenByCommunity[community.code] +=
        evaluation.householdBurdenByCommunity[community.code];
    }
  }

  // Spending programmes.
  const spendingResults: SpendingResult[] = [];
  const householdBenefitByCommunity = emptyCommunityRecord();
  for (const program of SPENDING_PROGRAMS) {
    const evaluation = evaluateProgram(program, settings);
    spendingResults.push(evaluation.result);
    evaluations += evaluation.evaluations;

    const allocation = allocator.allocate(program);
    evaluations += segments.length * 4;
    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index];
      const communityBenefitMEur =
        evaluation.householdBenefitByCommunity[segment.community];
      if (communityBenefitMEur === 0) continue;
      const amountEur =
        (communityBenefitMEur * 1e6 * allocation[index]) / Math.max(1, segment.households);
      segmentBenefitDeltaEur[index] += amountEur;
    }
    for (const community of COMMUNITIES) {
      householdBenefitByCommunity[community.code] +=
        evaluation.householdBenefitByCommunity[community.code];
    }
  }

  // Totals.
  const instrumentBaseline = instrumentResults.reduce(
    (sum, result) => sum + result.baselineRevenueMEur,
    0,
  );
  const instrumentSimulated = instrumentResults.reduce(
    (sum, result) => sum + result.simulatedRevenueMEur,
    0,
  );
  const spendingBaseline =
    SPENDING_PROGRAMS.reduce((sum, program) => sum + program.baselineMEur, 0) +
    OTHER_SPENDING_MEUR;
  const spendingSimulated =
    spendingResults.reduce((sum, result) => sum + result.simulatedMEur, 0) +
    OTHER_SPENDING_MEUR;
  const revenueBaseline = instrumentBaseline + OTHER_REVENUE_MEUR;
  const revenueSimulated = instrumentSimulated + OTHER_REVENUE_MEUR;

  const stateRevenueDelta =
    instrumentResults.reduce((sum, result) => sum + result.stateDeltaMEur, 0);
  const stateSpendingDelta = spendingResults.reduce(
    (sum, result) => sum + result.stateDeltaMEur,
    0,
  );

  // Community outcomes.
  const communities: CommunityOutcome[] = COMMUNITIES.map((community) => {
    const revenueDelta = instrumentResults.reduce(
      (sum, result) => sum + result.regionalDeltaMEur[community.code],
      0,
    );
    const spendingDelta = spendingResults.reduce(
      (sum, result) => sum + result.regionalDeltaMEur[community.code],
      0,
    );
    const burden = householdBurdenByCommunity[community.code];
    const benefit = householdBenefitByCommunity[community.code];
    const households = community.householdsThousands * 1000;
    return {
      code: community.code,
      name: community.name,
      revenueDeltaMEur: revenueDelta,
      spendingDeltaMEur: spendingDelta,
      balanceDeltaMEur: revenueDelta - spendingDelta,
      householdBurdenDeltaMEur: burden,
      householdBenefitDeltaMEur: benefit,
      netHouseholdImpactEur: ((benefit - burden) * 1e6) / households,
      households,
      population: community.populationThousands * 1000,
    };
  });

  const regionalBalanceDelta = communities.reduce(
    (sum, community) => sum + community.balanceDeltaMEur,
    0,
  );
  const revenueDelta = revenueSimulated - revenueBaseline;
  const spendingDelta = spendingSimulated - spendingBaseline;
  const baselineDeficit = revenueBaseline - spendingBaseline;

  // Distribution.
  const deciles = groupImpacts(
    segments,
    segmentTaxDeltaEur,
    segmentBenefitDeltaEur,
    (segment) => `d${segment.decile + 1}`,
    (key) => {
      const decile = Number(key.slice(1));
      return decile === 1
        ? "Decil 1 (renta más baja)"
        : decile === 10
          ? "Decil 10 (renta más alta)"
          : `Decil ${decile}`;
    },
    Array.from({ length: DECILE_COUNT }, (_, index) => `d${index + 1}`),
  );
  const familyTypes = groupImpacts(
    segments,
    segmentTaxDeltaEur,
    segmentBenefitDeltaEur,
    (segment) => segment.familyType,
    (key) => FAMILY_TYPES.find((entry) => entry.id === key)?.label ?? key,
    FAMILY_TYPES.map((entry) => entry.id),
  );
  const ageBands = groupImpacts(
    segments,
    segmentTaxDeltaEur,
    segmentBenefitDeltaEur,
    (segment) => segment.ageBand,
    (key) => AGE_BANDS.find((entry) => entry.id === key)?.label ?? key,
    AGE_BANDS.map((entry) => entry.id),
  );
  evaluations += segments.length * 6;

  const allGroups = [...deciles, ...familyTypes, ...ageBands].filter(
    (group) => Math.abs(group.netPerHouseholdEur) > 0.005,
  );
  const sorted = [...allGroups].sort(
    (left, right) => left.netPerHouseholdEur - right.netPerHouseholdEur,
  );
  const mostAffected = sorted.slice(0, 3);
  const leastAffected = sorted.slice(-3).reverse();

  const distribution: DistributionalResult = {
    deciles,
    familyTypes,
    ageBands,
    mostAffected,
    leastAffected,
  };

  const warnings: string[] = [
    "Referencia aproximada 2024: agregados oficiales redondeados, no liquidaciones.",
    "Las respuestas de comportamiento usan elasticidades publicadas y acotadas; el efecto real puede diferir.",
    "Navarra y País Vasco se muestran con escalas forales aproximadas; su recaudación es de sus haciendas.",
    "La territorialización de Sociedades, IRNR e ITF refleja domicilio fiscal, no actividad económica.",
  ];
  if (
    Object.keys(settings.instrumentRegionalRates).length > 0 ||
    Object.keys(settings.irpfAutonomousDeltas).length > 0
  ) {
    warnings.push(
      "Los cambios autonómicos no modelan efectos de deslocalización entre comunidades.",
    );
  }

  return {
    totals: {
      revenueBaselineMEur: revenueBaseline,
      revenueSimulatedMEur: revenueSimulated,
      revenueDeltaMEur: revenueDelta,
      spendingBaselineMEur: spendingBaseline,
      spendingSimulatedMEur: spendingSimulated,
      spendingDeltaMEur: spendingDelta,
      stateBalanceDeltaMEur: stateRevenueDelta - stateSpendingDelta,
      regionalBalanceDeltaMEur: regionalBalanceDelta,
      totalBalanceDeltaMEur: revenueDelta - spendingDelta,
      baselineDeficitMEur: baselineDeficit,
      simulatedDeficitMEur: baselineDeficit + revenueDelta - spendingDelta,
      gdpMEur: NATIONAL_GDP_MEUR,
    },
    instruments: instrumentResults,
    spending: spendingResults,
    communities,
    distribution,
    warnings,
    evaluationCount: evaluations,
    modelVersion: LAB_MODEL_VERSION,
  };
}
