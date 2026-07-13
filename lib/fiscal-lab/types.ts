/**
 * Shared types for the national fiscal laboratory: an aggregate,
 * public-statistics simulator over revenue instruments, spending programmes
 * and a segmented synthetic household population. No personal data is ever
 * used or transmitted; every figure is a labelled approximate reference.
 */

export type CommunityCode =
  | "01"
  | "02"
  | "03"
  | "04"
  | "05"
  | "06"
  | "07"
  | "08"
  | "09"
  | "10"
  | "11"
  | "12"
  | "13"
  | "14"
  | "15"
  | "16"
  | "17"
  | "18"
  | "19";

/** Ten household gross-income deciles, from D1 (lowest) to D10 (highest). */
export const DECILE_COUNT = 10;

export type FamilyTypeId =
  | "unipersonal"
  | "pareja_sin_hijos"
  | "pareja_con_hijos"
  | "monoparental"
  | "otros";

export type AgeBandId = "menores_30" | "de_30_a_44" | "de_45_a_64" | "mayores_65";

export const FAMILY_TYPES: Array<{ id: FamilyTypeId; label: string }> = [
  { id: "unipersonal", label: "Hogar unipersonal" },
  { id: "pareja_sin_hijos", label: "Pareja sin hijos" },
  { id: "pareja_con_hijos", label: "Pareja con hijos" },
  { id: "monoparental", label: "Hogar monoparental" },
  { id: "otros", label: "Otros hogares" },
];

export const AGE_BANDS: Array<{ id: AgeBandId; label: string }> = [
  { id: "menores_30", label: "Menores de 30 años" },
  { id: "de_30_a_44", label: "30 a 44 años" },
  { id: "de_45_a_64", label: "45 a 64 años" },
  { id: "mayores_65", label: "65 años o más" },
];

/** How an instrument's revenue is assigned between the State and communities. */
export interface RevenueAttribution {
  /** Share of common-territory revenue ceded to the communities (0..1). */
  cededShare: number;
  /**
   * "state" instruments belong to central government (partly ceded);
   * "regional" instruments are fully managed and kept by each community;
   * "foral_equivalent" marks state instruments that foral treasuries collect
   * for themselves under the economic agreement.
   */
  kind: "state" | "regional";
}

export interface IncidenceProfile {
  /** Share of the burden (or benefit) borne by each income decile; sums to 1. */
  deciles: number[];
  /** Share by family type, aligned with FAMILY_TYPES; sums to 1. */
  familyTypes: number[];
  /** Share by age band of the main earner, aligned with AGE_BANDS; sums to 1. */
  ageBands: number[];
}

export type InstrumentGroup =
  | "renta"
  | "consumo"
  | "especiales"
  | "juego"
  | "patrimonio"
  | "empresas"
  | "cotizaciones";

export interface InstrumentDefinition {
  id: string;
  name: string;
  shortName: string;
  group: InstrumentGroup;
  /** Baseline statutory rate in the unit below. */
  baselineRate: number;
  /** "percent" rates are expressed in %, "eurosPerUnit" in € per unitLabel. */
  rateUnit: "percent" | "eurosPerUnit";
  unitLabel?: string;
  minRate: number;
  maxRate: number;
  step: number;
  /** Approximate national baseline revenue, in millions of euros per year. */
  baselineRevenueMEur: number;
  attribution: RevenueAttribution;
  /** Share of the national base located in each community; sums to 1. */
  regionalWeights: Record<CommunityCode, number>;
  /**
   * Demand/base semi-elasticity: proportional base change per proportional
   * statutory-rate change. Negative for consumption-type responses.
   */
  baseElasticity: number;
  incidence: IncidenceProfile;
  /** Share of the burden ultimately borne by resident households (0..1). */
  householdBorneShare?: number;
  /** Whether each community can override this instrument's rate. */
  regionallyAdjustable: boolean;
  /** Communities excluded from the instrument (for example IGIC territories). */
  excludedCommunities?: CommunityCode[];
  sourceNote: string;
}

export interface SpendingProgram {
  id: string;
  name: string;
  shortName: string;
  /** Approximate consolidated baseline, in millions of euros per year. */
  baselineMEur: number;
  /** Share executed by communities (0 = fully central, 1 = fully regional). */
  regionalShare: number;
  /** Share of regional execution located in each community; sums to 1. */
  regionalWeights: Record<CommunityCode, number>;
  /** Who receives the benefit of one marginal euro of this programme. */
  incidence: IncidenceProfile;
  minMultiplier: number;
  maxMultiplier: number;
  regionallyAdjustable: boolean;
  sourceNote: string;
}

export interface BracketDefinition {
  /** Lower threshold of the bracket, in euros of taxable base per year. */
  thresholdEur: number;
  /** Statutory marginal rate for the bracket, in percent. */
  ratePercent: number;
}

export interface IrpfScheduleSet {
  /** State general schedule (common territory). */
  stateGeneral: BracketDefinition[];
  /** Autonomous general schedule per common-regime community. */
  autonomousGeneral: Record<string, BracketDefinition[]>;
  /** Foral general schedules (Navarra, País Vasco), full quota. */
  foralGeneral: Record<string, BracketDefinition[]>;
  /** National savings schedule (state + autonomous halves combined). */
  savings: BracketDefinition[];
}

/** User adjustments applied on top of the baseline. */
export interface PolicySettings {
  /** Percentage-point delta per state general IRPF bracket index. */
  irpfStateBracketDeltas: number[];
  /** Percentage-point delta applied to every autonomous IRPF bracket, per community. */
  irpfAutonomousDeltas: Partial<Record<CommunityCode, number>>;
  /** Percentage-point delta per savings-schedule bracket index. */
  irpfSavingsBracketDeltas: number[];
  /** New statutory rate per instrument id (absent = baseline). */
  instrumentRates: Record<string, number>;
  /** Per-community statutory rate overrides for regionally adjustable instruments. */
  instrumentRegionalRates: Record<string, Partial<Record<CommunityCode, number>>>;
  /** Spending multiplier per programme id (1 = baseline). */
  spendingMultipliers: Record<string, number>;
  /** Per-community spending multiplier overrides for regional programmes. */
  spendingRegionalMultipliers: Record<string, Partial<Record<CommunityCode, number>>>;
}

export interface InstrumentResult {
  id: string;
  name: string;
  group: InstrumentGroup;
  baselineRevenueMEur: number;
  simulatedRevenueMEur: number;
  deltaMEur: number;
  /** Delta attributed to the central State after cessions. */
  stateDeltaMEur: number;
  /** Delta attributed to each community (ceded + own + foral equivalents). */
  regionalDeltaMEur: Record<CommunityCode, number>;
  behaviouralOffsetMEur: number;
}

export interface SpendingResult {
  id: string;
  name: string;
  baselineMEur: number;
  simulatedMEur: number;
  deltaMEur: number;
  stateDeltaMEur: number;
  regionalDeltaMEur: Record<CommunityCode, number>;
}

export interface CommunityOutcome {
  code: CommunityCode;
  name: string;
  /** Change in revenue assigned to the community's budget, M€. */
  revenueDeltaMEur: number;
  /** Change in public spending executed in the community, M€. */
  spendingDeltaMEur: number;
  /** Net budget-balance change for the community's administrations, M€. */
  balanceDeltaMEur: number;
  /** Net household impact per household and year, €. Positive = gains money. */
  netHouseholdImpactEur: number;
  /** Tax burden change borne by resident households, M€ (positive = pay more). */
  householdBurdenDeltaMEur: number;
  /** Spending benefit change received by resident households, M€. */
  householdBenefitDeltaMEur: number;
  households: number;
  population: number;
}

export interface GroupImpact {
  id: string;
  label: string;
  /** Average yearly € change per household in the group (negative = pays more / loses benefit). */
  netPerHouseholdEur: number;
  taxPerHouseholdEur: number;
  benefitPerHouseholdEur: number;
  households: number;
}

export interface DistributionalResult {
  deciles: GroupImpact[];
  familyTypes: GroupImpact[];
  ageBands: GroupImpact[];
  mostAffected: GroupImpact[];
  leastAffected: GroupImpact[];
}

export interface SimulationTotals {
  revenueBaselineMEur: number;
  revenueSimulatedMEur: number;
  revenueDeltaMEur: number;
  spendingBaselineMEur: number;
  spendingSimulatedMEur: number;
  spendingDeltaMEur: number;
  /** State (central) balance change in M€: revenue delta − spending delta. */
  stateBalanceDeltaMEur: number;
  /** Aggregate regional balance change in M€. */
  regionalBalanceDeltaMEur: number;
  /** Total general-government balance change in M€. */
  totalBalanceDeltaMEur: number;
  baselineDeficitMEur: number;
  simulatedDeficitMEur: number;
  gdpMEur: number;
}

export interface NationalSimulation {
  totals: SimulationTotals;
  instruments: InstrumentResult[];
  spending: SpendingResult[];
  communities: CommunityOutcome[];
  distribution: DistributionalResult;
  warnings: string[];
  /** Number of elementary parameter evaluations performed for this run. */
  evaluationCount: number;
  modelVersion: string;
}
