import type { GeographyCatalog } from "./catalog";
import type { GeographyLevel, GeographyRecord, PlaceSearchResult } from "./types";

export interface PlaceSearchOptions {
  readonly levels?: readonly GeographyLevel[];
  readonly limit?: number;
  readonly includeFineGeographies?: boolean;
}

const LEVEL_LABEL: Readonly<Record<GeographyLevel, string>> = {
  country: "país",
  autonomous_community: "comunidad autónoma",
  province: "provincia",
  municipality: "municipio",
  district: "distrito",
  census_section: "sección censal",
  postcode: "código postal",
};

const DEFAULT_LEVELS: readonly GeographyLevel[] = [
  "autonomous_community",
  "province",
  "municipality",
];

export function normalizePlaceText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-ES")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function editDistance(first: string, second: string): number {
  const previous = Array.from({ length: second.length + 1 }, (_, index) => index);
  for (let firstIndex = 1; firstIndex <= first.length; firstIndex += 1) {
    let diagonal = previous[0];
    previous[0] = firstIndex;
    for (let secondIndex = 1; secondIndex <= second.length; secondIndex += 1) {
      const above = previous[secondIndex];
      previous[secondIndex] = Math.min(
        previous[secondIndex] + 1,
        previous[secondIndex - 1] + 1,
        diagonal + (first[firstIndex - 1] === second[secondIndex - 1] ? 0 : 1),
      );
      diagonal = above;
    }
  }
  return previous[second.length];
}

function hierarchy(record: GeographyRecord, catalog: GeographyCatalog): string {
  const labels = [record.name];
  let parentCode = record.parentCode;
  while (parentCode !== null) {
    const parent = catalog.findByCode(parentCode);
    if (!parent || parent.level === "country") break;
    if (parent.name !== record.name) labels.push(parent.name);
    parentCode = parent.parentCode;
  }
  return `${labels.join(" · ")} (${LEVEL_LABEL[record.level]})`;
}

function asResult(record: GeographyRecord, catalog: GeographyCatalog): PlaceSearchResult {
  return {
    code: record.code,
    officialCode: record.officialCode,
    name: record.name,
    hierarchicalLabel: hierarchy(record, catalog),
    level: record.level,
    autonomousCommunityCode: record.autonomousCommunityCode,
    provinceCode: record.provinceCode,
    municipalityCode: record.municipalityCode,
    postalCodes: record.postalCodes,
    centroid: record.centroid,
    bbox: record.bbox,
    territorialSupport: record.territorialSupport,
    geometryStatus: record.geometryStatus,
    geographyVersion: record.geographyVersion,
    dataMode: record.dataMode,
    demoNotice: record.demoNotice,
  };
}

function scoreRecord(record: GeographyRecord, normalizedQuery: string): number | null {
  const officialCode = normalizePlaceText(record.officialCode);
  const projectCode = normalizePlaceText(record.code);
  const postcodes = record.postalCodes.map(normalizePlaceText);
  const names = [record.name, ...record.nameVariants].map(normalizePlaceText);

  if (projectCode === normalizedQuery) return 1200 + record.importance;
  if (officialCode === normalizedQuery) return 1150 + record.importance;
  if (postcodes.includes(normalizedQuery)) return 1100 + record.importance;
  if (names.includes(normalizedQuery)) return 1000 + record.importance;
  if (names.some((name) => name.startsWith(normalizedQuery))) return 800 + record.importance;
  if (names.some((name) => name.split(" ").some((token) => token.startsWith(normalizedQuery)))) {
    return 650 + record.importance;
  }
  if (normalizedQuery.length >= 4 && names.some((name) => name.includes(normalizedQuery))) {
    return 500 + record.importance;
  }
  if (
    normalizedQuery.length >= 5 &&
    names.some((name) => editDistance(name, normalizedQuery) <= Math.min(2, Math.floor(normalizedQuery.length / 4)))
  ) {
    return 300 + record.importance;
  }
  return null;
}

export function searchPlaces(
  catalog: GeographyCatalog,
  query: string,
  options: PlaceSearchOptions = {},
): readonly PlaceSearchResult[] {
  const normalizedQuery = normalizePlaceText(query);
  if (normalizedQuery.length < 2) return [];

  const levels = new Set(options.levels ?? (
    options.includeFineGeographies
      ? [...DEFAULT_LEVELS, "district", "census_section"]
      : DEFAULT_LEVELS
  ));
  const limit = Math.max(1, Math.min(options.limit ?? 8, 20));

  return catalog.records
    .filter((record) => levels.has(record.level))
    .map((record) => ({ record, score: scoreRecord(record, normalizedQuery) }))
    .filter((candidate): candidate is { record: GeographyRecord; score: number } => candidate.score !== null)
    .sort((first, second) => second.score - first.score || first.record.name.localeCompare(second.record.name, "es"))
    .slice(0, limit)
    .map(({ record }) => asResult(record, catalog));
}
