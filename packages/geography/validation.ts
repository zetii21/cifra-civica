import type { AggregateDataset, GeographyRecord } from "./types";

export interface DatasetValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

const CODE_PATTERNS: Readonly<Record<string, RegExp>> = {
  ISO_3166_1_ALPHA2: /^[A-Z]{2}$/,
  INE_CCAA_2: /^\d{2}$/,
  INE_PROVINCE_2: /^\d{2}$/,
  INE_MUNICIPALITY_5: /^\d{5}$/,
  INE_CUDIS_7: /^\d{7}$/,
  INE_CUSEC_10: /^\d{10}$/,
};

function isFinitePosition(position: readonly number[]): boolean {
  return position.length >= 2 && Number.isFinite(position[0]) && Number.isFinite(position[1]);
}

export function validateGeographyRecords(
  records: readonly GeographyRecord[],
): DatasetValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const codes = new Set<string>();
  const byCode = new Map(records.map((record) => [record.code, record]));

  for (const record of records) {
    if (codes.has(record.code)) errors.push(`Duplicate geography code: ${record.code}`);
    codes.add(record.code);
    const codePattern = CODE_PATTERNS[record.codeScheme];
    if (codePattern && !codePattern.test(record.officialCode)) {
      errors.push(`${record.code}: official code does not match ${record.codeScheme}`);
    }
    if (!isFinitePosition(record.centroid)) errors.push(`${record.code}: invalid centroid`);
    const [west, south, east, north] = record.bbox;
    if (![west, south, east, north].every(Number.isFinite) || west >= east || south >= north) {
      errors.push(`${record.code}: invalid bbox`);
    }
    if (record.parentCode !== null && !byCode.has(record.parentCode)) {
      errors.push(`${record.code}: unknown parent ${record.parentCode}`);
    }
    if (record.dataMode === "demo_synthetic" && !record.demoNotice?.includes("DEMO")) {
      errors.push(`${record.code}: synthetic geography lacks a DEMO notice`);
    }
    if (record.geometryStatus === "synthetic_simplified_demo" && record.dataMode !== "demo_synthetic") {
      errors.push(`${record.code}: synthetic geometry cannot be marked official`);
    }
    if (record.geometry === null) {
      warnings.push(`${record.code}: no boundary geometry; search/centroid use only`);
      continue;
    }
    const polygons = record.geometry.type === "Polygon"
      ? [record.geometry.coordinates]
      : record.geometry.coordinates;
    for (const polygon of polygons) {
      for (const ring of polygon) {
        if (ring.length < 4) errors.push(`${record.code}: polygon ring has fewer than four positions`);
        const first = ring[0];
        const last = ring[ring.length - 1];
        if (!first || !last || first[0] !== last[0] || first[1] !== last[1]) {
          errors.push(`${record.code}: polygon ring is not closed`);
        }
        if (!ring.every(isFinitePosition)) errors.push(`${record.code}: polygon contains invalid positions`);
      }
    }
  }
  return { valid: errors.length === 0, errors, warnings };
}

export function validateAggregateDataset(dataset: AggregateDataset): DatasetValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const definitions = new Map<string, AggregateDataset["definitions"][number]>();
  const cells = new Set<string>();

  if (dataset.containsHouseholdRecords !== false) {
    errors.push("Published aggregate datasets must declare containsHouseholdRecords=false");
  }
  if (dataset.dataMode === "demo_synthetic" && dataset.watermark !== "DEMO") {
    errors.push("Synthetic aggregate datasets require a DEMO watermark");
  }
  for (const definition of dataset.definitions) {
    if (definitions.has(definition.id)) errors.push(`Duplicate metric definition: ${definition.id}`);
    definitions.set(definition.id, definition);
    if (definition.dataMode === "demo_synthetic" && definition.watermark !== "DEMO") {
      errors.push(`${definition.id}: synthetic metric lacks DEMO watermark`);
    }
    if (definition.kind === "official_statistic" && definition.watermark !== null) {
      errors.push(`${definition.id}: official metric may not carry a synthetic watermark`);
    }
  }

  for (const record of dataset.records) {
    const definition = definitions.get(record.metricId);
    if (!definition) {
      errors.push(`Record references unknown metric: ${record.metricId}`);
      continue;
    }
    const key = `${record.metricId}/${record.geographyCode}`;
    if (cells.has(key)) errors.push(`Duplicate aggregate cell: ${key}`);
    cells.add(key);
    if (record.suppressionStatus === "suppressed" && (record.value !== null || record.roundedValue !== null)) {
      errors.push(`${key}: suppressed values must be physically removed`);
    }
    if (record.suppressionStatus === "not_available" && record.value !== null) {
      errors.push(`${key}: unavailable values must be null`);
    }
    if (record.dataMode === "demo_synthetic" && record.watermark !== "DEMO") {
      errors.push(`${key}: synthetic record lacks DEMO watermark`);
    }
    if (definition.kind === "official_statistic" && record.dataMode !== "official") {
      errors.push(`${key}: official definition contains non-official values`);
    }
    if (!definition.valuesAvailable) warnings.push(`${record.metricId}: has records despite valuesAvailable=false`);
  }
  return { valid: errors.length === 0, errors, warnings };
}

export function assertValidPublishedData(
  geographies: readonly GeographyRecord[],
  aggregateDataset: AggregateDataset,
): void {
  const geography = validateGeographyRecords(geographies);
  const aggregate = validateAggregateDataset(aggregateDataset);
  const errors = [...geography.errors, ...aggregate.errors];
  if (errors.length > 0) throw new Error(`Invalid published geography data: ${errors.join("; ")}`);
}
