/**
 * Per-segment household impact lookup for the laboratory ("hogares como el
 * tuyo"). Recomputes the exact per-segment tax-burden and spending-benefit
 * deltas of a policy configuration over the synthetic segment grid, so the
 * interface can show the average yearly effect for a coarse household
 * profile (community × income band × family type × age band).
 *
 * The module deliberately lives outside the study-signed engine inputs and
 * outside the barrel export: it reuses the exported primitives and its
 * consistency with the engine's distributional output is enforced by tests.
 * These are aggregate segment means over public statistics — never a
 * personal calculation and never personal data.
 */
import {
  AGE_BANDS,
  DECILE_COUNT,
  FAMILY_TYPES,
  type AgeBandId,
  type CommunityCode,
  type FamilyTypeId,
  type PolicySettings,
} from "./types";
import { buildSegments, COMMUNITIES, INCOME_BANDS, type Segment } from "./demography";
import { INSTRUMENTS } from "./instruments";
import { SPENDING_PROGRAMS } from "./spending";
import { simulateIrpf } from "./irpf";

const MIN_BASE_FACTOR = 0.2;
const MAX_BASE_FACTOR = 1.8;

interface Margins {
  decile: number[];
  family: number[];
  age: number[];
  familyIndex: Map<FamilyTypeId, number>;
  ageIndex: Map<AgeBandId, number>;
}

function nationalMargins(segments: Segment[]): Margins {
  const familyIndex = new Map(FAMILY_TYPES.map((entry, index) => [entry.id, index]));
  const ageIndex = new Map(AGE_BANDS.map((entry, index) => [entry.id, index]));
  const decile = new Array<number>(DECILE_COUNT).fill(0);
  const family = new Array<number>(FAMILY_TYPES.length).fill(0);
  const age = new Array<number>(AGE_BANDS.length).fill(0);
  let total = 0;
  for (const segment of segments) {
    total += segment.households;
    decile[segment.decile] += segment.households;
    family[familyIndex.get(segment.familyType)!] += segment.households;
    age[ageIndex.get(segment.ageBand)!] += segment.households;
  }
  return {
    decile: decile.map((value) => value / total),
    family: family.map((value) => value / total),
    age: age.map((value) => value / total),
    familyIndex,
    ageIndex,
  };
}

/** Raking allocation of a per-community amount across its segments. */
function allocate(
  segments: Segment[],
  margins: Margins,
  incidence: { deciles: number[]; familyTypes: number[]; ageBands: number[] },
): Float64Array {
  const raw = new Float64Array(segments.length);
  const communityTotals = new Map<CommunityCode, number>();
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const multiplier =
      (incidence.deciles[segment.decile] / margins.decile[segment.decile]) *
      (incidence.familyTypes[margins.familyIndex.get(segment.familyType)!] /
        margins.family[margins.familyIndex.get(segment.familyType)!]) *
      (incidence.ageBands[margins.ageIndex.get(segment.ageBand)!] /
        margins.age[margins.ageIndex.get(segment.ageBand)!]);
    const value = segment.households * multiplier;
    raw[index] = value;
    communityTotals.set(
      segment.community,
      (communityTotals.get(segment.community) ?? 0) + value,
    );
  }
  for (let index = 0; index < segments.length; index += 1) {
    const total = communityTotals.get(segments[index].community) ?? 0;
    raw[index] = total > 0 ? raw[index] / total : 0;
  }
  return raw;
}

export interface SegmentImpacts {
  segments: Segment[];
  /** Tax-burden delta per household of each segment, €/year (positive = pays more). */
  taxEur: Float64Array;
  /** Spending-benefit delta per household of each segment, €/year. */
  benefitEur: Float64Array;
}

/** Recomputes per-segment household deltas for the given settings. */
export function computeSegmentImpacts(settings: PolicySettings): SegmentImpacts {
  const segments = buildSegments();
  const margins = nationalMargins(segments);
  const taxEur = new Float64Array(segments.length);
  const benefitEur = new Float64Array(segments.length);

  // IRPF: exact per-segment deltas from the schedule engine.
  const irpf = simulateIrpf({
    stateBracketDeltas: settings.irpfStateBracketDeltas,
    autonomousDeltas: settings.irpfAutonomousDeltas,
    savingsBracketDeltas: settings.irpfSavingsBracketDeltas,
  });
  for (let index = 0; index < segments.length; index += 1) {
    taxEur[index] += irpf.segmentDeltaEur[index];
  }

  // Other instruments: community-level household burden, raked to segments.
  for (const instrument of INSTRUMENTS) {
    const nationalRate = settings.instrumentRates[instrument.id] ?? instrument.baselineRate;
    const overrides = instrument.regionallyAdjustable
      ? settings.instrumentRegionalRates[instrument.id] ?? {}
      : {};
    const excluded = new Set(instrument.excludedCommunities ?? []);
    let weightTotal = 0;
    for (const community of COMMUNITIES) {
      if (!excluded.has(community.code)) {
        weightTotal += instrument.regionalWeights[community.code];
      }
    }
    const burdenByCommunity = new Map<CommunityCode, number>();
    let anyChange = false;
    for (const community of COMMUNITIES) {
      const weight = excluded.has(community.code)
        ? 0
        : instrument.regionalWeights[community.code] / weightTotal;
      const rate = overrides[community.code] ?? nationalRate;
      const ratio = instrument.baselineRate > 0 ? rate / instrument.baselineRate : 1;
      const baseFactor = Math.min(
        MAX_BASE_FACTOR,
        Math.max(MIN_BASE_FACTOR, 1 + instrument.baseElasticity * (ratio - 1)),
      );
      const baselineHere = instrument.baselineRevenueMEur * weight;
      const delta = baselineHere * ratio * baseFactor - baselineHere;
      if (delta !== 0) anyChange = true;
      burdenByCommunity.set(
        community.code,
        delta * (instrument.householdBorneShare ?? 1),
      );
    }
    if (!anyChange) continue;
    const allocation = allocate(segments, margins, instrument.incidence);
    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index];
      const communityBurden = burdenByCommunity.get(segment.community) ?? 0;
      if (communityBurden === 0) continue;
      taxEur[index] +=
        (communityBurden * 1e6 * allocation[index]) / Math.max(1, segment.households);
    }
  }

  // Spending programmes: benefit deltas raked to segments.
  for (const program of SPENDING_PROGRAMS) {
    const nationalMultiplier = settings.spendingMultipliers[program.id] ?? 1;
    const overrides = program.regionallyAdjustable
      ? settings.spendingRegionalMultipliers[program.id] ?? {}
      : {};
    const benefitByCommunity = new Map<CommunityCode, number>();
    let anyChange = false;
    for (const community of COMMUNITIES) {
      const multiplier = overrides[community.code] ?? nationalMultiplier;
      const delta =
        program.baselineMEur * program.regionalWeights[community.code] * (multiplier - 1);
      if (delta !== 0) anyChange = true;
      benefitByCommunity.set(community.code, delta);
    }
    if (!anyChange) continue;
    const allocation = allocate(segments, margins, program.incidence);
    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index];
      const communityBenefit = benefitByCommunity.get(segment.community) ?? 0;
      if (communityBenefit === 0) continue;
      benefitEur[index] +=
        (communityBenefit * 1e6 * allocation[index]) / Math.max(1, segment.households);
    }
  }

  return { segments, taxEur, benefitEur };
}

export interface HouseholdProfile {
  community: CommunityCode;
  /** Index into INCOME_BANDS (0..12). */
  band: number;
  familyType: FamilyTypeId;
  ageBand: AgeBandId;
}

export interface HouseholdProfileImpact {
  netEur: number;
  taxEur: number;
  benefitEur: number;
  households: number;
  /** Approximate mean gross income of the segment, €/year. */
  grossIncomeEur: number;
}

/** Impact for one coarse household profile (segment average). */
export function profileImpact(
  impacts: SegmentImpacts,
  profile: HouseholdProfile,
): HouseholdProfileImpact | undefined {
  for (let index = 0; index < impacts.segments.length; index += 1) {
    const segment = impacts.segments[index];
    if (
      segment.community === profile.community &&
      segment.band === profile.band &&
      segment.familyType === profile.familyType &&
      segment.ageBand === profile.ageBand
    ) {
      return {
        netEur: impacts.benefitEur[index] - impacts.taxEur[index],
        taxEur: impacts.taxEur[index],
        benefitEur: impacts.benefitEur[index],
        households: segment.households,
        grossIncomeEur: segment.grossIncomeEur,
      };
    }
  }
  return undefined;
}

export { INCOME_BANDS };
