/**
 * Approximate demographic and income structure used by the national fiscal
 * laboratory. Values are reviewed public aggregates (INE population and
 * household statistics, ECV income distribution), rounded and clearly
 * labelled as an approximate 2024 reference. No microdata is embedded.
 */
import {
  AGE_BANDS,
  DECILE_COUNT,
  FAMILY_TYPES,
  type AgeBandId,
  type CommunityCode,
  type FamilyTypeId,
} from "./types";

export interface CommunityProfile {
  code: CommunityCode;
  name: string;
  shortName: string;
  regime: "common" | "foral" | "ciudad_autonoma";
  /** Resident population, thousands (INE, approximate 2024). */
  populationThousands: number;
  /** Households, thousands (INE ECH, approximate 2023-2024). */
  householdsThousands: number;
  /** Regional GDP, millions of euros (INE CRE, approximate 2023-2024). */
  gdpMEur: number;
  /** Mean household gross income relative to the national mean (ECV-based). */
  incomeIndex: number;
}

export const COMMUNITIES: CommunityProfile[] = [
  { code: "01", name: "Andalucía", shortName: "AND", regime: "common", populationThousands: 8584, householdsThousands: 3260, gdpMEur: 208000, incomeIndex: 0.86 },
  { code: "02", name: "Aragón", shortName: "ARA", regime: "common", populationThousands: 1351, householdsThousands: 560, gdpMEur: 47000, incomeIndex: 1.02 },
  { code: "03", name: "Principado de Asturias", shortName: "AST", regime: "common", populationThousands: 1009, householdsThousands: 470, gdpMEur: 27500, incomeIndex: 0.97 },
  { code: "04", name: "Illes Balears", shortName: "BAL", regime: "common", populationThousands: 1231, householdsThousands: 480, gdpMEur: 41000, incomeIndex: 1.05 },
  { code: "05", name: "Canarias", shortName: "CAN", regime: "common", populationThousands: 2238, householdsThousands: 900, gdpMEur: 55000, incomeIndex: 0.89 },
  { code: "06", name: "Cantabria", shortName: "CNT", regime: "common", populationThousands: 590, householdsThousands: 250, gdpMEur: 16500, incomeIndex: 0.98 },
  { code: "07", name: "Castilla y León", shortName: "CYL", regime: "common", populationThousands: 2391, householdsThousands: 1030, gdpMEur: 68000, incomeIndex: 0.94 },
  { code: "08", name: "Castilla-La Mancha", shortName: "CLM", regime: "common", populationThousands: 2104, householdsThousands: 810, gdpMEur: 52000, incomeIndex: 0.87 },
  { code: "09", name: "Cataluña", shortName: "CAT", regime: "common", populationThousands: 8012, householdsThousands: 3120, gdpMEur: 303000, incomeIndex: 1.1 },
  { code: "10", name: "Comunitat Valenciana", shortName: "CVA", regime: "common", populationThousands: 5319, householdsThousands: 2120, gdpMEur: 141000, incomeIndex: 0.93 },
  { code: "11", name: "Extremadura", shortName: "EXT", regime: "common", populationThousands: 1054, householdsThousands: 440, gdpMEur: 25000, incomeIndex: 0.81 },
  { code: "12", name: "Galicia", shortName: "GAL", regime: "common", populationThousands: 2705, householdsThousands: 1130, gdpMEur: 74000, incomeIndex: 0.93 },
  { code: "13", name: "Comunidad de Madrid", shortName: "MAD", regime: "common", populationThousands: 7001, householdsThousands: 2700, gdpMEur: 313000, incomeIndex: 1.18 },
  { code: "14", name: "Región de Murcia", shortName: "MUR", regime: "common", populationThousands: 1568, householdsThousands: 570, gdpMEur: 41000, incomeIndex: 0.87 },
  { code: "15", name: "Comunidad Foral de Navarra", shortName: "NAV", regime: "foral", populationThousands: 678, householdsThousands: 260, gdpMEur: 24500, incomeIndex: 1.13 },
  { code: "16", name: "País Vasco", shortName: "PVA", regime: "foral", populationThousands: 2216, householdsThousands: 940, gdpMEur: 92000, incomeIndex: 1.17 },
  { code: "17", name: "La Rioja", shortName: "RIO", regime: "common", populationThousands: 324, householdsThousands: 135, gdpMEur: 10500, incomeIndex: 1.0 },
  { code: "18", name: "Ceuta", shortName: "CEU", regime: "ciudad_autonoma", populationThousands: 83, householdsThousands: 29, gdpMEur: 1900, incomeIndex: 0.92 },
  { code: "19", name: "Melilla", shortName: "MEL", regime: "ciudad_autonoma", populationThousands: 85, householdsThousands: 27, gdpMEur: 1800, incomeIndex: 0.9 },
];

export const COMMUNITY_BY_CODE: ReadonlyMap<CommunityCode, CommunityProfile> = new Map(
  COMMUNITIES.map((community) => [community.code, community]),
);

export const NATIONAL_GDP_MEUR = 1_591_000;

export const TOTAL_HOUSEHOLDS_THOUSANDS = COMMUNITIES.reduce(
  (sum, community) => sum + community.householdsThousands,
  0,
);

export const TOTAL_POPULATION_THOUSANDS = COMMUNITIES.reduce(
  (sum, community) => sum + community.populationThousands,
  0,
);

/** Mean gross household income per national decile, €/year (ECV-based). */
export const DECILE_MEAN_GROSS_INCOME_EUR = [
  11_000, 17_500, 22_500, 27_500, 32_500, 38_500, 45_500, 55_000, 70_000, 118_000,
];

export interface IncomeBand {
  /** Reporting decile the band belongs to (0..9). */
  decile: number;
  /** Share of the decile's households in this band. */
  shareOfDecile: number;
  /** Mean gross household income of the band, €/year. */
  meanGrossIncomeEur: number;
  label: string;
}

/**
 * Internal income grid: nine lower deciles plus a split top decile so top
 * marginal brackets (300.000 € and above) have a non-empty base. Top-tail
 * means follow the AEAT high-income distribution shape.
 */
export const INCOME_BANDS: IncomeBand[] = [
  ...DECILE_MEAN_GROSS_INCOME_EUR.slice(0, 9).map((mean, decile) => ({
    decile,
    shareOfDecile: 1,
    meanGrossIncomeEur: mean,
    label: `Decil ${decile + 1}`,
  })),
  { decile: 9, shareOfDecile: 0.5, meanGrossIncomeEur: 82_000, label: "Percentiles 91-95" },
  { decile: 9, shareOfDecile: 0.4, meanGrossIncomeEur: 118_000, label: "Percentiles 96-99" },
  { decile: 9, shareOfDecile: 0.09, meanGrossIncomeEur: 300_000, label: "Percentil 99-99,9" },
  { decile: 9, shareOfDecile: 0.01, meanGrossIncomeEur: 1_150_000, label: "0,1 % más alto" },
];

/** National household shares by age band of the main earner. */
const AGE_BAND_SHARES: Record<AgeBandId, number> = {
  menores_30: 0.055,
  de_30_a_44: 0.24,
  de_45_a_64: 0.39,
  mayores_65: 0.315,
};

/** National household shares by family type. */
const FAMILY_TYPE_SHARES: Record<FamilyTypeId, number> = {
  unipersonal: 0.27,
  pareja_sin_hijos: 0.225,
  pareja_con_hijos: 0.32,
  monoparental: 0.105,
  otros: 0.08,
};

/** Family-type mix conditional on the age band (seed for the joint grid). */
const FAMILY_GIVEN_AGE: Record<AgeBandId, Record<FamilyTypeId, number>> = {
  menores_30: { unipersonal: 0.32, pareja_sin_hijos: 0.3, pareja_con_hijos: 0.18, monoparental: 0.08, otros: 0.12 },
  de_30_a_44: { unipersonal: 0.22, pareja_sin_hijos: 0.2, pareja_con_hijos: 0.44, monoparental: 0.09, otros: 0.05 },
  de_45_a_64: { unipersonal: 0.24, pareja_sin_hijos: 0.22, pareja_con_hijos: 0.34, monoparental: 0.12, otros: 0.08 },
  mayores_65: { unipersonal: 0.33, pareja_sin_hijos: 0.45, pareja_con_hijos: 0.08, monoparental: 0.04, otros: 0.1 },
};

/** Decile mix conditional on the age band (seed for the joint grid). */
const DECILE_GIVEN_AGE: Record<AgeBandId, number[]> = {
  menores_30: [0.14, 0.14, 0.13, 0.12, 0.11, 0.1, 0.09, 0.07, 0.06, 0.04],
  de_30_a_44: [0.08, 0.09, 0.09, 0.1, 0.1, 0.11, 0.11, 0.11, 0.11, 0.1],
  de_45_a_64: [0.07, 0.07, 0.08, 0.08, 0.09, 0.1, 0.11, 0.12, 0.13, 0.15],
  mayores_65: [0.13, 0.13, 0.12, 0.11, 0.1, 0.09, 0.09, 0.08, 0.08, 0.07],
};

/** Relative household income by family type at equal decile position. */
export const FAMILY_INCOME_FACTOR: Record<FamilyTypeId, number> = {
  unipersonal: 0.62,
  pareja_sin_hijos: 1.0,
  pareja_con_hijos: 1.25,
  monoparental: 0.85,
  otros: 1.15,
};

export interface Segment {
  community: CommunityCode;
  /** Reporting decile, 0..9. */
  decile: number;
  /** Index into INCOME_BANDS (13 bands; the top decile is split). */
  band: number;
  familyType: FamilyTypeId;
  ageBand: AgeBandId;
  /** Number of households represented by this segment. */
  households: number;
  /** Mean gross household income of the segment, €/year. */
  grossIncomeEur: number;
}

/**
 * Joint national weight over (decile, familyType, ageBand), fitted with
 * iterative proportional fitting so all three published margins hold.
 */
function buildJointWeights(): number[][][] {
  const weights: number[][][] = [];
  for (let decile = 0; decile < DECILE_COUNT; decile += 1) {
    weights.push(
      FAMILY_TYPES.map(({ id: family }) =>
        AGE_BANDS.map(({ id: age }) =>
          AGE_BAND_SHARES[age] * FAMILY_GIVEN_AGE[age][family] * DECILE_GIVEN_AGE[age][decile],
        ),
      ),
    );
  }
  const decileTarget = 1 / DECILE_COUNT;
  for (let iteration = 0; iteration < 40; iteration += 1) {
    // Decile margin.
    for (let decile = 0; decile < DECILE_COUNT; decile += 1) {
      let sum = 0;
      for (let family = 0; family < FAMILY_TYPES.length; family += 1) {
        for (let age = 0; age < AGE_BANDS.length; age += 1) sum += weights[decile][family][age];
      }
      const factor = decileTarget / sum;
      for (let family = 0; family < FAMILY_TYPES.length; family += 1) {
        for (let age = 0; age < AGE_BANDS.length; age += 1) weights[decile][family][age] *= factor;
      }
    }
    // Family margin.
    for (let family = 0; family < FAMILY_TYPES.length; family += 1) {
      let sum = 0;
      for (let decile = 0; decile < DECILE_COUNT; decile += 1) {
        for (let age = 0; age < AGE_BANDS.length; age += 1) sum += weights[decile][family][age];
      }
      const factor = FAMILY_TYPE_SHARES[FAMILY_TYPES[family].id] / sum;
      for (let decile = 0; decile < DECILE_COUNT; decile += 1) {
        for (let age = 0; age < AGE_BANDS.length; age += 1) weights[decile][family][age] *= factor;
      }
    }
    // Age margin.
    for (let age = 0; age < AGE_BANDS.length; age += 1) {
      let sum = 0;
      for (let decile = 0; decile < DECILE_COUNT; decile += 1) {
        for (let family = 0; family < FAMILY_TYPES.length; family += 1) sum += weights[decile][family][age];
      }
      const factor = AGE_BAND_SHARES[AGE_BANDS[age].id] / sum;
      for (let decile = 0; decile < DECILE_COUNT; decile += 1) {
        for (let family = 0; family < FAMILY_TYPES.length; family += 1) weights[decile][family][age] *= factor;
      }
    }
  }
  return weights;
}

/** Regional tilt of the decile distribution as a function of the income index. */
function regionalDecileWeights(incomeIndex: number): number[] {
  const tilt = Math.max(-0.55, Math.min(0.55, (incomeIndex - 1) * 1.2));
  const raw = Array.from({ length: DECILE_COUNT }, (_, decile) => {
    const centred = (decile - (DECILE_COUNT - 1) / 2) / ((DECILE_COUNT - 1) / 2);
    return Math.max(0.05, 1 + tilt * centred);
  });
  const sum = raw.reduce((total, value) => total + value, 0);
  return raw.map((value) => value / sum);
}

let cachedSegments: Segment[] | undefined;

/** Builds the deterministic synthetic segment population (19 × 10 × 5 × 4). */
export function buildSegments(): Segment[] {
  if (cachedSegments) return cachedSegments;
  const joint = buildJointWeights();
  const segments: Segment[] = [];
  for (const community of COMMUNITIES) {
    const decileWeights = regionalDecileWeights(community.incomeIndex);
    const communityHouseholds = community.householdsThousands * 1000;
    for (let band = 0; band < INCOME_BANDS.length; band += 1) {
      const bandDefinition = INCOME_BANDS[band];
      const decile = bandDefinition.decile;
      // Mean income of the band within the community: national band mean
      // scaled by the community income index, compressed towards the national
      // structure so top deciles do not explode in rich regions.
      const regionalIncome =
        bandDefinition.meanGrossIncomeEur * (1 + (community.incomeIndex - 1) * 0.75);
      const bandShareRegional = decileWeights[decile] * bandDefinition.shareOfDecile;
      for (let family = 0; family < FAMILY_TYPES.length; family += 1) {
        for (let age = 0; age < AGE_BANDS.length; age += 1) {
          const jointShare = joint[decile][family][age] * DECILE_COUNT; // conditional on decile
          const households = communityHouseholds * bandShareRegional * jointShare;
          if (households <= 0) continue;
          segments.push({
            community: community.code,
            decile,
            band,
            familyType: FAMILY_TYPES[family].id,
            ageBand: AGE_BANDS[age].id,
            households,
            grossIncomeEur: regionalIncome * FAMILY_INCOME_FACTOR[FAMILY_TYPES[family].id],
          });
        }
      }
    }
  }
  cachedSegments = segments;
  return segments;
}

/** Household consumption weight per community (population × relative spend). */
export function consumptionWeights(): Record<CommunityCode, number> {
  const raw = COMMUNITIES.map((community) => ({
    code: community.code,
    weight:
      community.populationThousands * (1 + (community.incomeIndex - 1) * 0.7),
  }));
  const total = raw.reduce((sum, entry) => sum + entry.weight, 0);
  return Object.fromEntries(
    raw.map((entry) => [entry.code, entry.weight / total]),
  ) as Record<CommunityCode, number>;
}

/** Population-share weights per community. */
export function populationWeights(): Record<CommunityCode, number> {
  return Object.fromEntries(
    COMMUNITIES.map((community) => [
      community.code,
      community.populationThousands / TOTAL_POPULATION_THOUSANDS,
    ]),
  ) as Record<CommunityCode, number>;
}

/** GDP-share weights per community. */
export function gdpWeights(): Record<CommunityCode, number> {
  const total = COMMUNITIES.reduce((sum, community) => sum + community.gdpMEur, 0);
  return Object.fromEntries(
    COMMUNITIES.map((community) => [community.code, community.gdpMEur / total]),
  ) as Record<CommunityCode, number>;
}
