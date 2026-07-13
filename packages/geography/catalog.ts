import { buildDemoAggregateDataset, buildDemoGeographies } from "./demo-source";
import type {
  AggregateDataset,
  AggregateMetricRecord,
  GeographyLevel,
  GeographyRecord,
  MetricDefinition,
} from "./types";

export interface GeographyCatalog {
  readonly geographyVersion: string;
  readonly records: readonly GeographyRecord[];
  findByCode(code: string): GeographyRecord | null;
  childrenOf(code: string): readonly GeographyRecord[];
  byLevel(level: GeographyLevel): readonly GeographyRecord[];
}

export function createGeographyCatalog(records: readonly GeographyRecord[]): GeographyCatalog {
  const byProjectCode = new Map(records.map((record) => [record.code.toLocaleUpperCase("es-ES"), record]));
  const byOfficialCode = new Map<string, GeographyRecord[]>();
  const children = new Map<string, GeographyRecord[]>();
  const levels = new Map<GeographyLevel, GeographyRecord[]>();

  for (const record of records) {
    const officialKey = record.officialCode.toLocaleUpperCase("es-ES");
    byOfficialCode.set(officialKey, [...(byOfficialCode.get(officialKey) ?? []), record]);
    if (record.parentCode !== null) {
      children.set(record.parentCode, [...(children.get(record.parentCode) ?? []), record]);
    }
    levels.set(record.level, [...(levels.get(record.level) ?? []), record]);
  }

  const geographyVersions = new Set(records.map((record) => record.geographyVersion));
  if (geographyVersions.size !== 1) {
    throw new Error("A geography catalog must contain exactly one geography version");
  }

  return Object.freeze({
    geographyVersion: records[0]?.geographyVersion ?? "empty",
    records: Object.freeze([...records]),
    findByCode(code: string) {
      const normalized = code.trim().toLocaleUpperCase("es-ES");
      const direct = byProjectCode.get(normalized);
      if (direct) return direct;
      const candidates = byOfficialCode.get(normalized) ?? [];
      if (candidates.length === 1) return candidates[0];
      return null;
    },
    childrenOf(code: string) {
      return Object.freeze([...(children.get(code) ?? [])]);
    },
    byLevel(level: GeographyLevel) {
      return Object.freeze([...(levels.get(level) ?? [])]);
    },
  });
}

export interface MetricCatalog {
  readonly dataset: AggregateDataset;
  listDefinitions(): readonly MetricDefinition[];
  definition(metricId: string): MetricDefinition | null;
  values(metricId: string): readonly AggregateMetricRecord[];
  value(metricId: string, geographyCode: string): AggregateMetricRecord | null;
}

export function createMetricCatalog(dataset: AggregateDataset): MetricCatalog {
  if (dataset.containsHouseholdRecords !== false) {
    throw new Error("Map metric catalogs may contain aggregate results only");
  }
  const definitions = new Map(dataset.definitions.map((definition) => [definition.id, definition]));
  const recordsByMetric = new Map<string, AggregateMetricRecord[]>();
  const recordsByCell = new Map<string, AggregateMetricRecord>();

  for (const record of dataset.records) {
    const definition = definitions.get(record.metricId);
    if (!definition) throw new Error(`Unknown metric definition: ${record.metricId}`);
    if (definition.kind === "official_statistic" && record.dataMode !== "official") {
      throw new Error(`Official metric ${record.metricId} cannot contain ${record.dataMode} values`);
    }
    if (definition.kind === "simulated_estimate" && record.dataMode === "official") {
      throw new Error(`Simulated metric ${record.metricId} cannot be marked official`);
    }
    if (record.dataMode === "demo_synthetic" && record.watermark !== "DEMO") {
      throw new Error(`Synthetic cell ${record.metricId}/${record.geographyCode} lacks DEMO watermark`);
    }
    recordsByMetric.set(record.metricId, [...(recordsByMetric.get(record.metricId) ?? []), record]);
    const key = `${record.metricId}\u0000${record.geographyCode}`;
    if (recordsByCell.has(key)) throw new Error(`Duplicate metric cell: ${key}`);
    recordsByCell.set(key, record);
  }

  return Object.freeze({
    dataset,
    listDefinitions: () => Object.freeze([...dataset.definitions]),
    definition: (metricId: string) => definitions.get(metricId) ?? null,
    values: (metricId: string) => Object.freeze([...(recordsByMetric.get(metricId) ?? [])]),
    value: (metricId: string, geographyCode: string) =>
      recordsByCell.get(`${metricId}\u0000${geographyCode}`) ?? null,
  });
}

export const demoGeographyCatalog = createGeographyCatalog(buildDemoGeographies());
export const demoMetricCatalog = createMetricCatalog(buildDemoAggregateDataset(demoGeographyCatalog.records));
