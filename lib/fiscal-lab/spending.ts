/**
 * Public spending programmes of the national laboratory. Baselines are
 * rounded consolidated general-government references (IGAE/PGE 2024-2025 and
 * regional budgets), labelled approximate. Incidence profiles describe who
 * receives the benefit of one marginal euro of each programme.
 */
import {
  COMMUNITIES,
  consumptionWeights,
  populationWeights,
  type CommunityProfile,
} from "./demography";
import type { CommunityCode, IncidenceProfile, SpendingProgram } from "./types";

function normalise(values: number[]): number[] {
  const total = values.reduce((sum, value) => sum + value, 0);
  return values.map((value) => value / total);
}

function incidence(
  deciles: number[],
  familyTypes: number[],
  ageBands: number[],
): IncidenceProfile {
  return {
    deciles: normalise(deciles),
    familyTypes: normalise(familyTypes),
    ageBands: normalise(ageBands),
  };
}

const population = populationWeights();
const consumption = consumptionWeights();

function weightBy(selector: (community: CommunityProfile) => number): Record<CommunityCode, number> {
  const raw = COMMUNITIES.map((community) => ({
    code: community.code,
    weight: Math.max(0, selector(community)),
  }));
  const total = raw.reduce((sum, entry) => sum + entry.weight, 0);
  return Object.fromEntries(
    raw.map((entry) => [entry.code, entry.weight / total]),
  ) as Record<CommunityCode, number>;
}

/** Older-population weights approximated from the regional ageing structure. */
const ELDERLY_WEIGHTS = weightBy((community) => {
  const ageingIndex: Partial<Record<CommunityCode, number>> = {
    "03": 1.3, "07": 1.25, "12": 1.25, "11": 1.12, "02": 1.08, "06": 1.12,
    "16": 1.1, "17": 1.08, "08": 1.02, "15": 1.02, "09": 0.98, "10": 0.98,
    "01": 0.92, "13": 0.9, "14": 0.85, "04": 0.85, "05": 0.88, "18": 0.72, "19": 0.7,
  };
  return community.populationThousands * (ageingIndex[community.code] ?? 1);
});

/** School-age weights approximated from regional youth structure. */
const SCHOOL_WEIGHTS = weightBy((community) => {
  const youthIndex: Partial<Record<CommunityCode, number>> = {
    "14": 1.18, "01": 1.1, "18": 1.35, "19": 1.4, "08": 1.05, "13": 1.02,
    "05": 0.98, "10": 1.0, "09": 1.02, "04": 1.0, "11": 1.02, "02": 0.95,
    "15": 1.0, "16": 0.88, "17": 0.95, "06": 0.85, "07": 0.82, "12": 0.8, "03": 0.75,
  };
  return community.populationThousands * (youthIndex[community.code] ?? 1);
});

/** Road-network weights: large, sparsely populated regions weigh more. */
const ROAD_WEIGHTS = weightBy((community) => {
  const networkIndex: Partial<Record<CommunityCode, number>> = {
    "07": 2.2, "08": 1.9, "02": 1.8, "11": 1.6, "01": 1.25, "12": 1.3,
    "09": 0.85, "13": 0.55, "10": 0.85, "14": 0.9, "03": 1.1, "06": 1.0,
    "17": 1.2, "15": 1.15, "16": 0.7, "04": 0.6, "05": 0.6, "18": 0.2, "19": 0.2,
  };
  return community.populationThousands * (networkIndex[community.code] ?? 1);
});

/** Unemployment weights: higher where unemployment rates are higher. */
const UNEMPLOYMENT_WEIGHTS = weightBy((community) => {
  const unemploymentIndex: Partial<Record<CommunityCode, number>> = {
    "01": 1.55, "11": 1.5, "05": 1.4, "18": 1.9, "19": 1.9, "08": 1.15,
    "10": 1.1, "14": 1.05, "12": 0.85, "09": 0.8, "13": 0.75, "02": 0.75,
    "15": 0.65, "16": 0.7, "17": 0.8, "06": 0.85, "07": 0.85, "03": 0.95, "04": 0.85,
  };
  return community.populationThousands * (unemploymentIndex[community.code] ?? 1);
});

const DIFFUSE_DECILES = [10, 10, 10, 10, 10, 10, 10, 10, 10, 10];
const FAMILY_FLAT = [27, 22.5, 32, 10.5, 8];
const AGE_FLAT = [5.5, 24, 39, 31.5];

export const SPENDING_PROGRAMS: SpendingProgram[] = [
  {
    id: "pensiones",
    name: "Pensiones (contributivas, no contributivas y clases pasivas)",
    shortName: "Pensiones",
    baselineMEur: 213_000,
    regionalShare: 0,
    regionalWeights: ELDERLY_WEIGHTS,
    incidence: incidence(
      [8, 11, 12.5, 12, 11.5, 11, 10, 9, 8.5, 6.5],
      [30, 44, 8, 4, 14],
      [0.5, 2, 12, 85.5],
    ),
    minMultiplier: 0.8,
    maxMultiplier: 1.3,
    regionallyAdjustable: false,
    sourceNote: "Seguridad Social + clases pasivas ≈ 213.000 M€ (PGE 2025).",
  },
  {
    id: "sanidad",
    name: "Sanidad pública",
    shortName: "Sanidad",
    baselineMEur: 103_000,
    regionalShare: 0.93,
    regionalWeights: ELDERLY_WEIGHTS,
    incidence: incidence(
      [12, 12, 11.5, 11, 10.5, 10, 9.5, 8.5, 8, 7],
      [26, 26, 26, 9, 13],
      [4, 14, 30, 52],
    ),
    minMultiplier: 0.8,
    maxMultiplier: 1.4,
    regionallyAdjustable: true,
    sourceNote: "Gasto sanitario público consolidado ≈ 103.000 M€; gestionado casi todo por CCAA.",
  },
  {
    id: "educacion",
    name: "Educación pública",
    shortName: "Educación",
    baselineMEur: 65_000,
    regionalShare: 0.9,
    regionalWeights: SCHOOL_WEIGHTS,
    incidence: incidence(
      [13, 12.5, 12, 11.5, 11, 10, 9.5, 8, 7, 5.5],
      [4, 6, 58, 22, 10],
      [16, 48, 30, 6],
    ),
    minMultiplier: 0.8,
    maxMultiplier: 1.4,
    regionallyAdjustable: true,
    sourceNote: "Gasto público educativo ≈ 65.000 M€; competencias transferidas a CCAA.",
  },
  {
    id: "desempleo",
    name: "Prestaciones por desempleo",
    shortName: "Desempleo",
    baselineMEur: 22_000,
    regionalShare: 0,
    regionalWeights: UNEMPLOYMENT_WEIGHTS,
    incidence: incidence(
      [20, 18, 15, 12, 10, 8, 6.5, 5, 3.5, 2],
      [24, 18, 34, 15, 9],
      [16, 38, 42, 4],
    ),
    minMultiplier: 0.6,
    maxMultiplier: 1.5,
    regionallyAdjustable: false,
    sourceNote: "SEPE, prestaciones contributivas y subsidios ≈ 22.000 M€.",
  },
  {
    id: "defensa",
    name: "Defensa",
    shortName: "Defensa",
    baselineMEur: 22_000,
    regionalShare: 0,
    regionalWeights: population,
    incidence: incidence(DIFFUSE_DECILES, FAMILY_FLAT, AGE_FLAT),
    minMultiplier: 0.5,
    maxMultiplier: 2,
    regionallyAdjustable: false,
    sourceNote: "Senda hacia el objetivo OTAN; presupuesto consolidado ≈ 22.000 M€.",
  },
  {
    id: "seguridad",
    name: "Seguridad ciudadana e instituciones penitenciarias",
    shortName: "Seguridad",
    baselineMEur: 12_000,
    regionalShare: 0.15,
    regionalWeights: population,
    incidence: incidence(DIFFUSE_DECILES, FAMILY_FLAT, AGE_FLAT),
    minMultiplier: 0.7,
    maxMultiplier: 1.5,
    regionallyAdjustable: true,
    sourceNote: "Fuerzas y cuerpos estatales más policías autonómicas (≈ 15 % regional).",
  },
  {
    id: "carreteras",
    name: "Carreteras e infraestructuras de transporte",
    shortName: "Carreteras",
    baselineMEur: 12_000,
    regionalShare: 0.45,
    regionalWeights: ROAD_WEIGHTS,
    incidence: incidence(
      [5, 6.5, 8, 9, 10, 10.5, 11.5, 12, 13, 14.5],
      [15, 24, 38, 8, 15],
      [9, 32, 42, 17],
    ),
    minMultiplier: 0.5,
    maxMultiplier: 2,
    regionallyAdjustable: true,
    sourceNote: "Inversión y conservación estatal (Mitma/ADIF viario) y redes autonómicas.",
  },
  {
    id: "deuda",
    name: "Intereses de la deuda pública",
    shortName: "Intereses deuda",
    baselineMEur: 40_000,
    regionalShare: 0.12,
    regionalWeights: population,
    incidence: incidence(DIFFUSE_DECILES, FAMILY_FLAT, AGE_FLAT),
    minMultiplier: 1,
    maxMultiplier: 1,
    regionallyAdjustable: false,
    sourceNote: "Carga de intereses consolidada ≈ 40.000 M€; no ajustable directamente.",
  },
  {
    id: "idi",
    name: "Investigación, desarrollo e innovación civil",
    shortName: "I+D+i",
    baselineMEur: 9_000,
    regionalShare: 0.4,
    regionalWeights: consumption,
    incidence: incidence(
      [6, 7, 8, 9, 10, 10.5, 11, 12, 12.5, 14],
      [22, 24, 32, 8, 14],
      [14, 34, 36, 16],
    ),
    minMultiplier: 0.5,
    maxMultiplier: 2.5,
    regionallyAdjustable: true,
    sourceNote: "Política de gasto 46 más programas autonómicos ≈ 9.000 M€.",
  },
  {
    id: "dependencia",
    name: "Servicios sociales y dependencia",
    shortName: "Dependencia",
    baselineMEur: 16_000,
    regionalShare: 0.8,
    regionalWeights: ELDERLY_WEIGHTS,
    incidence: incidence(
      [16, 15, 13.5, 12, 10.5, 9.5, 8, 7, 5.5, 3],
      [26, 22, 20, 16, 16],
      [4, 12, 26, 58],
    ),
    minMultiplier: 0.7,
    maxMultiplier: 1.8,
    regionallyAdjustable: true,
    sourceNote: "SAAD y servicios sociales autonómicos y locales ≈ 16.000 M€.",
  },
  {
    id: "imv",
    name: "Ingreso mínimo vital y garantía de rentas",
    shortName: "IMV",
    baselineMEur: 6_000,
    regionalShare: 0.15,
    regionalWeights: UNEMPLOYMENT_WEIGHTS,
    incidence: incidence(
      [42, 26, 14, 8, 4.5, 2.5, 1.5, 0.8, 0.5, 0.2],
      [18, 8, 30, 34, 10],
      [14, 40, 38, 8],
    ),
    minMultiplier: 0.5,
    maxMultiplier: 2.5,
    regionallyAdjustable: true,
    sourceNote: "IMV estatal más rentas mínimas autonómicas ≈ 6.000 M€.",
  },
  {
    id: "vivienda",
    name: "Vivienda y urbanismo",
    shortName: "Vivienda",
    baselineMEur: 4_500,
    regionalShare: 0.7,
    regionalWeights: consumption,
    incidence: incidence(
      [15, 14, 13, 12, 11, 10, 8.5, 7, 5.5, 4],
      [24, 16, 28, 18, 14],
      [26, 36, 26, 12],
    ),
    minMultiplier: 0.5,
    maxMultiplier: 3,
    regionallyAdjustable: true,
    sourceNote: "Planes estatales y autonómicos de vivienda ≈ 4.500 M€.",
  },
  {
    id: "cultura",
    name: "Cultura",
    shortName: "Cultura",
    baselineMEur: 3_500,
    regionalShare: 0.6,
    regionalWeights: consumption,
    incidence: incidence(
      [7, 8, 8.5, 9, 9.5, 10, 10.5, 11.5, 12.5, 13.5],
      [26, 24, 26, 9, 15],
      [14, 28, 34, 24],
    ),
    minMultiplier: 0.4,
    maxMultiplier: 2.5,
    regionallyAdjustable: true,
    sourceNote: "Gasto cultural de todas las administraciones ≈ 3.500 M€.",
  },
  {
    id: "medio_ambiente",
    name: "Medio ambiente y transición ecológica",
    shortName: "Medio ambiente",
    baselineMEur: 7_000,
    regionalShare: 0.5,
    regionalWeights: ROAD_WEIGHTS,
    incidence: incidence(DIFFUSE_DECILES, FAMILY_FLAT, AGE_FLAT),
    minMultiplier: 0.5,
    maxMultiplier: 2.5,
    regionallyAdjustable: true,
    sourceNote: "Protección ambiental, agua y transición energética ≈ 7.000 M€.",
  },
  {
    id: "agricultura",
    name: "Agricultura, pesca y desarrollo rural",
    shortName: "Agricultura",
    baselineMEur: 7_000,
    regionalShare: 0.55,
    regionalWeights: ROAD_WEIGHTS,
    incidence: incidence(
      [11, 11.5, 11.5, 11, 10.5, 10, 9.5, 9, 8.5, 7.5],
      [18, 26, 30, 8, 18],
      [6, 24, 44, 26],
    ),
    minMultiplier: 0.5,
    maxMultiplier: 2,
    regionallyAdjustable: true,
    sourceNote: "Gasto nacional sin fondos PAC de la UE ≈ 7.000 M€.",
  },
  {
    id: "justicia",
    name: "Justicia",
    shortName: "Justicia",
    baselineMEur: 5_500,
    regionalShare: 0.4,
    regionalWeights: population,
    incidence: incidence(DIFFUSE_DECILES, FAMILY_FLAT, AGE_FLAT),
    minMultiplier: 0.7,
    maxMultiplier: 1.6,
    regionallyAdjustable: true,
    sourceNote: "Administración de justicia estatal y transferida ≈ 5.500 M€.",
  },
];

export const SPENDING_BY_ID: ReadonlyMap<string, SpendingProgram> = new Map(
  SPENDING_PROGRAMS.map((program) => [program.id, program]),
);

/**
 * Non-itemised remainders so the headline balance matches the consolidated
 * aggregate (revenue ≈ 682.000 M€ and spending ≈ 733.000 M€, IGAE 2024):
 * local taxes, fees, property income and general administration.
 */
export const OTHER_SPENDING_MEUR = 185_500;
export const OTHER_REVENUE_MEUR = 206_100;
