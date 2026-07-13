import type {
  AggregateDataset,
  AggregateMetricRecord,
  GeographyRecord,
  MetricDefinition,
  Position,
  TerritorialSupport,
} from "./types";
import { applyDisclosureControl } from "./disclosure";
import { assessUncertainty, roundForHonestPrecision } from "./uncertainty";

export const DEMO_GEOGRAPHY_VERSION = "demo-es-2027.1";
export const DEMO_DATA_VINTAGE = "DEMO-2027-SYNTHETIC";
export const DEMO_GENERATED_AT = "2026-07-13T00:00:00.000Z";
export const DEMO_NOTICE =
  "DEMO — geometría simplificada y métricas sintéticas; no representa límites ni estadísticas oficiales.";

interface CommunitySeed {
  readonly code: string;
  readonly name: string;
  readonly variants?: readonly string[];
  readonly bbox: readonly [number, number, number, number];
  readonly support?: TerritorialSupport;
}

interface MunicipalitySeed {
  readonly code: string;
  readonly name: string;
  readonly variants?: readonly string[];
  readonly provinceCode: string;
  readonly provinceName: string;
  readonly communityCode: string;
  readonly centroid: Position;
  readonly postcodes: readonly string[];
  readonly importance: number;
}

/** Names and codes are official identifiers; every boundary below is a DEMO rectangle. */
export const COMMUNITY_SEEDS: readonly CommunitySeed[] = [
  { code: "01", name: "Andalucía", bbox: [-7.55, 36.0, -1.6, 38.75] },
  { code: "02", name: "Aragón", bbox: [-1.75, 39.85, 0.85, 42.95] },
  { code: "03", name: "Principado de Asturias", variants: ["Asturias"], bbox: [-7.2, 42.85, -4.5, 43.7] },
  { code: "04", name: "Illes Balears", variants: ["Islas Baleares", "Baleares"], bbox: [1.1, 38.6, 4.4, 40.1] },
  { code: "05", name: "Canarias", bbox: [-18.2, 27.6, -13.3, 29.5], support: "partial" },
  { code: "06", name: "Cantabria", bbox: [-4.9, 42.75, -3.15, 43.55] },
  { code: "07", name: "Castilla y León", bbox: [-7.1, 39.8, -1.75, 43.25] },
  { code: "08", name: "Castilla-La Mancha", bbox: [-5.5, 38.0, -0.9, 41.35] },
  { code: "09", name: "Cataluña", variants: ["Catalunya"], bbox: [0.15, 40.5, 3.35, 42.9] },
  { code: "10", name: "Comunitat Valenciana", variants: ["Comunidad Valenciana"], bbox: [-1.6, 37.8, 0.55, 40.8] },
  { code: "11", name: "Extremadura", bbox: [-7.55, 37.9, -4.65, 40.5] },
  { code: "12", name: "Galicia", bbox: [-9.35, 41.8, -6.75, 43.8] },
  { code: "13", name: "Comunidad de Madrid", variants: ["Madrid"], bbox: [-4.6, 39.85, -3.05, 41.2] },
  { code: "14", name: "Región de Murcia", variants: ["Murcia"], bbox: [-2.35, 37.35, -0.65, 38.8] },
  { code: "15", name: "Comunidad Foral de Navarra", variants: ["Navarra", "Nafarroa"], bbox: [-2.5, 41.85, -0.7, 43.35], support: "unsupported" },
  { code: "16", name: "País Vasco", variants: ["Euskadi"], bbox: [-3.5, 42.45, -1.7, 43.55], support: "unsupported" },
  { code: "17", name: "La Rioja", bbox: [-3.15, 41.9, -1.65, 42.7] },
  { code: "18", name: "Ceuta", bbox: [-5.37, 35.87, -5.27, 35.93], support: "partial" },
  { code: "19", name: "Melilla", bbox: [-3.0, 35.26, -2.91, 35.33], support: "partial" },
] as const;

export const MUNICIPALITY_SEEDS: readonly MunicipalitySeed[] = [
  { code: "41091", name: "Sevilla", provinceCode: "41", provinceName: "Sevilla", communityCode: "01", centroid: [-5.9845, 37.3891], postcodes: ["41001"], importance: 95 },
  { code: "50297", name: "Zaragoza", provinceCode: "50", provinceName: "Zaragoza", communityCode: "02", centroid: [-0.8891, 41.6488], postcodes: ["50001"], importance: 94 },
  { code: "33024", name: "Gijón", variants: ["Xixón"], provinceCode: "33", provinceName: "Asturias", communityCode: "03", centroid: [-5.6611, 43.5322], postcodes: ["33201"], importance: 88 },
  { code: "07040", name: "Palma", variants: ["Palma de Mallorca"], provinceCode: "07", provinceName: "Balears, Illes", communityCode: "04", centroid: [2.6502, 39.5696], postcodes: ["07001"], importance: 91 },
  { code: "35016", name: "Las Palmas de Gran Canaria", variants: ["Las Palmas"], provinceCode: "35", provinceName: "Palmas, Las", communityCode: "05", centroid: [-15.4314, 28.1248], postcodes: ["35001"], importance: 92 },
  { code: "39075", name: "Santander", provinceCode: "39", provinceName: "Cantabria", communityCode: "06", centroid: [-3.8099, 43.4623], postcodes: ["39001"], importance: 86 },
  { code: "47186", name: "Valladolid", provinceCode: "47", provinceName: "Valladolid", communityCode: "07", centroid: [-4.7245, 41.6523], postcodes: ["47001"], importance: 89 },
  { code: "45168", name: "Toledo", provinceCode: "45", provinceName: "Toledo", communityCode: "08", centroid: [-4.0273, 39.8628], postcodes: ["45001"], importance: 84 },
  { code: "08019", name: "Barcelona", provinceCode: "08", provinceName: "Barcelona", communityCode: "09", centroid: [2.1734, 41.3851], postcodes: ["08001"], importance: 100 },
  { code: "46250", name: "València", variants: ["Valencia"], provinceCode: "46", provinceName: "Valencia/València", communityCode: "10", centroid: [-0.3763, 39.4699], postcodes: ["46001"], importance: 97 },
  { code: "06015", name: "Badajoz", provinceCode: "06", provinceName: "Badajoz", communityCode: "11", centroid: [-6.9707, 38.8794], postcodes: ["06001"], importance: 82 },
  { code: "15030", name: "A Coruña", variants: ["La Coruña", "Coruña"], provinceCode: "15", provinceName: "Coruña, A", communityCode: "12", centroid: [-8.4115, 43.3623], postcodes: ["15001"], importance: 87 },
  { code: "28079", name: "Madrid", provinceCode: "28", provinceName: "Madrid", communityCode: "13", centroid: [-3.7038, 40.4168], postcodes: ["28001"], importance: 101 },
  { code: "30030", name: "Murcia", provinceCode: "30", provinceName: "Murcia", communityCode: "14", centroid: [-1.1307, 37.9922], postcodes: ["30001"], importance: 93 },
  { code: "31201", name: "Pamplona/Iruña", variants: ["Pamplona", "Iruña"], provinceCode: "31", provinceName: "Navarra", communityCode: "15", centroid: [-1.644, 42.8125], postcodes: ["31001"], importance: 88 },
  { code: "48020", name: "Bilbao", variants: ["Bilbo"], provinceCode: "48", provinceName: "Bizkaia", communityCode: "16", centroid: [-2.935, 43.263], postcodes: ["48001"], importance: 90 },
  { code: "26089", name: "Logroño", provinceCode: "26", provinceName: "Rioja, La", communityCode: "17", centroid: [-2.4449, 42.4627], postcodes: ["26001"], importance: 85 },
  { code: "51001", name: "Ceuta", provinceCode: "51", provinceName: "Ceuta", communityCode: "18", centroid: [-5.3213, 35.8894], postcodes: ["51001"], importance: 81 },
  { code: "52001", name: "Melilla", provinceCode: "52", provinceName: "Melilla", communityCode: "19", centroid: [-2.9381, 35.2923], postcodes: ["52001"], importance: 81 },
  { code: "29067", name: "Málaga", provinceCode: "29", provinceName: "Málaga", communityCode: "01", centroid: [-4.4214, 36.7213], postcodes: ["29001"], importance: 96 },
] as const;

function rectangle(bbox: readonly [number, number, number, number]) {
  const [west, south, east, north] = bbox;
  return {
    type: "Polygon" as const,
    coordinates: [[
      [west, south] as Position,
      [east, south] as Position,
      [east, north] as Position,
      [west, north] as Position,
      [west, south] as Position,
    ]],
  };
}

function centroidOf(bbox: readonly [number, number, number, number]): Position {
  return [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2];
}

function supportForCommunity(code: string): TerritorialSupport {
  return COMMUNITY_SEEDS.find((community) => community.code === code)?.support ?? "supported";
}

export function buildDemoGeographies(): readonly GeographyRecord[] {
  const records: GeographyRecord[] = [];
  const mainland = [-9.35, 35.87, 4.4, 43.8] as const;
  records.push({
    code: "ES",
    officialCode: "ES",
    codeScheme: "ISO_3166_1_ALPHA2",
    name: "España",
    nameVariants: ["Spain"],
    level: "country",
    parentCode: null,
    autonomousCommunityCode: null,
    provinceCode: null,
    municipalityCode: null,
    postalCodes: [],
    centroid: [-3.7, 40.2],
    bbox: [-18.2, 27.6, 4.4, 43.8],
    geometry: rectangle(mainland),
    geometryStatus: "synthetic_simplified_demo",
    territorialSupport: "partial",
    validFrom: "2026-01-01",
    validTo: null,
    geographyVersion: DEMO_GEOGRAPHY_VERSION,
    importance: 110,
    dataMode: "demo_synthetic",
    demoNotice: DEMO_NOTICE,
  });

  for (const community of COMMUNITY_SEEDS) {
    records.push({
      code: `ES-CCAA-${community.code}`,
      officialCode: community.code,
      codeScheme: "INE_CCAA_2",
      name: community.name,
      nameVariants: community.variants ?? [],
      level: "autonomous_community",
      parentCode: "ES",
      autonomousCommunityCode: community.code,
      provinceCode: null,
      municipalityCode: null,
      postalCodes: [],
      centroid: centroidOf(community.bbox),
      bbox: community.bbox,
      geometry: rectangle(community.bbox),
      geometryStatus: "synthetic_simplified_demo",
      territorialSupport: community.support ?? "supported",
      validFrom: "2026-01-01",
      validTo: null,
      geographyVersion: DEMO_GEOGRAPHY_VERSION,
      importance: 90,
      dataMode: "demo_synthetic",
      demoNotice: DEMO_NOTICE,
    });
  }

  const provinceSeeds = new Map<string, MunicipalitySeed>();
  for (const municipality of MUNICIPALITY_SEEDS) {
    if (!provinceSeeds.has(municipality.provinceCode)) provinceSeeds.set(municipality.provinceCode, municipality);
  }
  for (const province of provinceSeeds.values()) {
    const [longitude, latitude] = province.centroid;
    const bbox = [longitude - 0.55, latitude - 0.42, longitude + 0.55, latitude + 0.42] as const;
    records.push({
      code: `ES-PROV-${province.provinceCode}`,
      officialCode: province.provinceCode,
      codeScheme: "INE_PROVINCE_2",
      name: province.provinceName,
      nameVariants: [],
      level: "province",
      parentCode: `ES-CCAA-${province.communityCode}`,
      autonomousCommunityCode: province.communityCode,
      provinceCode: province.provinceCode,
      municipalityCode: null,
      postalCodes: [],
      centroid: province.centroid,
      bbox,
      geometry: rectangle(bbox),
      geometryStatus: "synthetic_simplified_demo",
      territorialSupport: supportForCommunity(province.communityCode),
      validFrom: "2026-01-01",
      validTo: null,
      geographyVersion: DEMO_GEOGRAPHY_VERSION,
      importance: 75,
      dataMode: "demo_synthetic",
      demoNotice: DEMO_NOTICE,
    });
  }

  for (const municipality of MUNICIPALITY_SEEDS) {
    const [longitude, latitude] = municipality.centroid;
    const bbox = [longitude - 0.11, latitude - 0.085, longitude + 0.11, latitude + 0.085] as const;
    records.push({
      code: `ES-MUN-${municipality.code}`,
      officialCode: municipality.code,
      codeScheme: "INE_MUNICIPALITY_5",
      name: municipality.name,
      nameVariants: municipality.variants ?? [],
      level: "municipality",
      parentCode: `ES-PROV-${municipality.provinceCode}`,
      autonomousCommunityCode: municipality.communityCode,
      provinceCode: municipality.provinceCode,
      municipalityCode: municipality.code,
      postalCodes: municipality.postcodes,
      centroid: municipality.centroid,
      bbox,
      geometry: rectangle(bbox),
      geometryStatus: "synthetic_simplified_demo",
      territorialSupport: supportForCommunity(municipality.communityCode),
      validFrom: "2026-01-01",
      validTo: null,
      geographyVersion: DEMO_GEOGRAPHY_VERSION,
      importance: municipality.importance,
      dataMode: "demo_synthetic",
      demoNotice: DEMO_NOTICE,
    });
  }

  for (const municipalityCode of ["28079", "08019"] as const) {
    const municipality = MUNICIPALITY_SEEDS.find((item) => item.code === municipalityCode)!;
    const [longitude, latitude] = municipality.centroid;
    const districtBbox = [longitude - 0.055, latitude - 0.045, longitude + 0.055, latitude + 0.045] as const;
    records.push({
      code: `ES-DIS-${municipality.code}01`,
      officialCode: `${municipality.code}01`,
      codeScheme: "INE_CUDIS_7",
      name: `Distrito 01 — muestra DEMO de ${municipality.name}`,
      nameVariants: [],
      level: "district",
      parentCode: `ES-MUN-${municipality.code}`,
      autonomousCommunityCode: municipality.communityCode,
      provinceCode: municipality.provinceCode,
      municipalityCode: municipality.code,
      postalCodes: municipality.postcodes,
      centroid: municipality.centroid,
      bbox: districtBbox,
      geometry: rectangle(districtBbox),
      geometryStatus: "synthetic_simplified_demo",
      territorialSupport: supportForCommunity(municipality.communityCode),
      validFrom: "2026-01-01",
      validTo: null,
      geographyVersion: DEMO_GEOGRAPHY_VERSION,
      importance: 55,
      dataMode: "demo_synthetic",
      demoNotice: DEMO_NOTICE,
    });

    const sectionBbox = [longitude - 0.02, latitude - 0.018, longitude + 0.02, latitude + 0.018] as const;
    records.push({
      code: `ES-SEC-${municipality.code}01001`,
      officialCode: `${municipality.code}01001`,
      codeScheme: "INE_CUSEC_10",
      name: `Sección 001 — muestra DEMO de ${municipality.name}`,
      nameVariants: [],
      level: "census_section",
      parentCode: `ES-DIS-${municipality.code}01`,
      autonomousCommunityCode: municipality.communityCode,
      provinceCode: municipality.provinceCode,
      municipalityCode: municipality.code,
      postalCodes: municipality.postcodes,
      centroid: municipality.centroid,
      bbox: sectionBbox,
      geometry: rectangle(sectionBbox),
      geometryStatus: "synthetic_simplified_demo",
      territorialSupport: supportForCommunity(municipality.communityCode),
      validFrom: "2026-01-01",
      validTo: null,
      geographyVersion: DEMO_GEOGRAPHY_VERSION,
      importance: 45,
      dataMode: "demo_synthetic",
      demoNotice: DEMO_NOTICE,
    });
  }

  return records;
}

export const DEMO_METRIC_DEFINITIONS: readonly MetricDefinition[] = [
  {
    id: "official_median_net_income_eur",
    label: "Renta neta mediana oficial",
    description: "Contexto territorial oficial del Atlas de Distribución de Renta de los Hogares del INE.",
    kind: "official_statistic",
    valueType: "currency_eur",
    unit: "EUR/año",
    dataMode: "official",
    watermark: null,
    taxYear: null,
    scenarioId: null,
    geographyLevels: ["municipality", "district", "census_section"],
    dataVintage: "No incluido en la fixture DEMO",
    sourceReferences: [{
      sourceId: "ine-adrh",
      publisher: "Instituto Nacional de Estadística",
      sourceReference: "https://www.ine.es/metodologia/metodologia_adrh.pdf",
      dataPeriod: "Según publicación oficial cargada",
      accessDate: "2026-07-13",
    }],
    methodologyPath: "/methodology/data#ine-adrh",
    downloadable: false,
    valuesAvailable: false,
    availabilityNote: "La fixture no incluye cifras oficiales. Deben incorporarse mediante el adaptador INE con su manifiesto de procedencia.",
  },
  {
    id: "official_gini_index",
    label: "Índice de Gini oficial",
    description: "Contexto oficial de desigualdad cuando esté publicado para la geografía seleccionada.",
    kind: "official_statistic",
    valueType: "index",
    unit: "0–100",
    dataMode: "official",
    watermark: null,
    taxYear: null,
    scenarioId: null,
    geographyLevels: ["municipality", "district"],
    dataVintage: "No incluido en la fixture DEMO",
    sourceReferences: [{
      sourceId: "ine-adrh",
      publisher: "Instituto Nacional de Estadística",
      sourceReference: "https://www.ine.es/metodologia/metodologia_adrh.pdf",
      dataPeriod: "Según publicación oficial cargada",
      accessDate: "2026-07-13",
    }],
    methodologyPath: "/methodology/data#ine-adrh",
    downloadable: false,
    valuesAvailable: false,
    availabilityNote: "Sin valores oficiales empaquetados en desarrollo.",
  },
  ...[
    ["demo_mean_fiscal_change_eur", "Cambio fiscal medio estimado", "currency_eur", "EUR/año"],
    ["demo_median_fiscal_change_eur", "Cambio fiscal mediano estimado", "currency_eur", "EUR/año"],
    ["demo_share_gain_above_500", "Hogares con aumento superior a 500 €", "percentage", "%"],
    ["demo_share_loss_below_500", "Hogares con descenso superior a 500 €", "percentage", "%"],
    ["demo_model_uncertainty_class", "Clase de incertidumbre del modelo", "class", "clase"],
  ].map(([id, label, valueType, unit]) => ({
    id,
    label,
    description: "DEMO — resultado agregado completamente sintético para probar la interfaz; no es una estimación electoral ni una estadística oficial.",
    kind: "simulated_estimate" as const,
    valueType: valueType as MetricDefinition["valueType"],
    unit,
    dataMode: "demo_synthetic" as const,
    watermark: "DEMO" as const,
    taxYear: 2027,
    scenarioId: "demo-neutral-2027",
    geographyLevels: ["autonomous_community", "municipality"] as const,
    dataVintage: DEMO_DATA_VINTAGE,
    sourceReferences: [{
      sourceId: "cifra-civica-demo-generator",
      publisher: "Cifra Cívica",
      sourceReference: "urn:cifra-civica:demo:synthetic-aggregates:v1",
      dataPeriod: "DEMO 2027",
      accessDate: "2026-07-13",
    }],
    methodologyPath: "/methodology/data#demo-synthetic",
    downloadable: true,
    valuesAvailable: true,
    availabilityNote: null,
  })),
];

function stableUnit(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0xffffffff;
}

function syntheticInputs(geography: GeographyRecord) {
  const unit = stableUnit(geography.code);
  const mean = -420 + unit * 1040;
  const median = mean * (0.72 + stableUnit(`${geography.code}:median`) * 0.2);
  const gain = 18 + stableUnit(`${geography.code}:gain`) * 67;
  const loss = Math.max(4, Math.min(82, 91 - gain + stableUnit(`${geography.code}:loss`) * 6));
  const community = geography.level === "autonomous_community";
  const forcedSmallCell = geography.officialCode === "51001" || geography.officialCode === "52001";
  const unweightedHouseholds = community
    ? 420 + Number(geography.officialCode) * 21
    : forcedSmallCell
      ? 18
      : 38 + Math.floor(stableUnit(`${geography.code}:n`) * 95);
  const weightedHouseholds = unweightedHouseholds * (community ? 3150 : 38);
  const effectiveSampleSize = Math.max(8, Math.round(unweightedHouseholds * 0.78));
  const rse = community ? 0.06 + unit * 0.03 : 0.08 + unit * 0.18;
  return { mean, median, gain, loss, unweightedHouseholds, weightedHouseholds, effectiveSampleSize, rse };
}

export function buildDemoAggregateDataset(
  geographies: readonly GeographyRecord[] = buildDemoGeographies(),
): AggregateDataset {
  const records: AggregateMetricRecord[] = [];
  const aggregateGeographies = geographies.filter((geography) =>
    geography.level === "autonomous_community" || geography.level === "municipality"
  );

  for (const geography of aggregateGeographies) {
    const values = syntheticInputs(geography);
    const calibrationStatus = geography.level === "autonomous_community"
      ? "partially_calibrated" as const
      : "not_calibrated" as const;
    const meanAssessment = assessUncertainty({
      estimate: values.mean,
      samplingStandardError: Math.max(18, Math.abs(values.mean) * values.rse),
      modelStandardError: 42,
      approximationCount: geography.level === "municipality" ? 2 : 1,
      calibrationStatus,
    });

    const metricValues: readonly [string, number | string, number | null][] = [
      ["demo_mean_fiscal_change_eur", values.mean, meanAssessment.standardError],
      ["demo_median_fiscal_change_eur", values.median, Math.max(20, Math.abs(values.median) * values.rse)],
      ["demo_share_gain_above_500", values.gain, Math.max(1.5, values.gain * values.rse)],
      ["demo_share_loss_below_500", values.loss, Math.max(1.5, values.loss * values.rse)],
      ["demo_model_uncertainty_class", meanAssessment.level, null],
    ];

    for (const [metricId, rawValue, standardError] of metricValues) {
      const assessment = typeof rawValue === "number"
        ? assessUncertainty({
            estimate: rawValue,
            samplingStandardError: standardError,
            modelStandardError: metricId.includes("fiscal_change") ? 42 : 2,
            approximationCount: geography.level === "municipality" ? 2 : 1,
            calibrationStatus,
          })
        : meanAssessment;
      const decision = applyDisclosureControl({
        id: `${geography.code}:${metricId}`,
        value: rawValue,
        geographyLevel: geography.level,
        metricKind: "simulated_estimate",
        unweightedHouseholds: values.unweightedHouseholds,
        weightedHouseholds: values.weightedHouseholds,
        effectiveSampleSize: values.effectiveSampleSize,
        standardError,
        smallAreaModelValidated: false,
      });
      const value = decision.publishableValue;
      records.push({
        geographyCode: geography.code,
        metricId,
        value,
        roundedValue: typeof value === "number" ? roundForHonestPrecision(value, assessment) : value,
        unweightedHouseholds: values.unweightedHouseholds,
        weightedHouseholds: values.weightedHouseholds,
        effectiveSampleSize: values.effectiveSampleSize,
        standardError: decision.status === "suppressed" ? null : standardError,
        modelError: decision.status === "suppressed" ? null : metricId.includes("fiscal_change") ? 42 : 2,
        calibrationStatus,
        suppressionStatus: decision.status,
        suppressionReasons: decision.reasons,
        uncertainty: decision.status === "suppressed"
          ? assessUncertainty({ estimate: null, samplingStandardError: null, modelStandardError: null })
          : assessment,
        dataMode: "demo_synthetic",
        watermark: "DEMO",
        dataVintage: DEMO_DATA_VINTAGE,
        geographyVersion: DEMO_GEOGRAPHY_VERSION,
      });
    }
  }

  return {
    schemaVersion: "1.0",
    datasetId: "cifra-civica-demo-aggregates-2027-v1",
    generatedAt: DEMO_GENERATED_AT,
    dataMode: "demo_synthetic",
    watermark: "DEMO",
    containsHouseholdRecords: false,
    definitions: DEMO_METRIC_DEFINITIONS,
    records,
  };
}
