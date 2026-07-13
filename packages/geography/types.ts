export const GEOGRAPHY_LEVELS = [
  "country",
  "autonomous_community",
  "province",
  "municipality",
  "district",
  "census_section",
  "postcode",
] as const;

export type GeographyLevel = (typeof GEOGRAPHY_LEVELS)[number];

export type DataMode = "official" | "simulated" | "demo_synthetic";

export type GeometryStatus =
  | "official"
  | "official_simplified"
  | "synthetic_simplified_demo"
  | "centroid_only";

export type TerritorialSupport = "supported" | "partial" | "unsupported";

export type Position = readonly [number, number];

export interface PolygonGeometry {
  readonly type: "Polygon";
  readonly coordinates: readonly (readonly Position[])[];
}

export interface MultiPolygonGeometry {
  readonly type: "MultiPolygon";
  readonly coordinates: readonly (readonly (readonly Position[])[])[];
}

export type BoundaryGeometry = PolygonGeometry | MultiPolygonGeometry;

/**
 * A geography code is always namespaced. `code` is stable inside this project,
 * while `officialCode` contains the unmodified code published by the authority.
 */
export interface GeographyRecord {
  readonly code: string;
  readonly officialCode: string;
  readonly codeScheme: string;
  readonly name: string;
  readonly nameVariants: readonly string[];
  readonly level: GeographyLevel;
  readonly parentCode: string | null;
  readonly autonomousCommunityCode: string | null;
  readonly provinceCode: string | null;
  readonly municipalityCode: string | null;
  readonly postalCodes: readonly string[];
  readonly centroid: Position;
  readonly bbox: readonly [number, number, number, number];
  readonly geometry: BoundaryGeometry | null;
  readonly geometryStatus: GeometryStatus;
  readonly territorialSupport: TerritorialSupport;
  readonly validFrom: string;
  readonly validTo: string | null;
  readonly geographyVersion: string;
  readonly importance: number;
  readonly dataMode: DataMode;
  readonly demoNotice: string | null;
}

export type MetricKind = "official_statistic" | "simulated_estimate";
export type MetricValueType = "currency_eur" | "percentage" | "index" | "class";

export interface MetricSourceReference {
  readonly sourceId: string;
  readonly publisher: string;
  readonly sourceReference: string;
  readonly dataPeriod: string;
  readonly accessDate: string;
}

export interface MetricDefinition {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly kind: MetricKind;
  readonly valueType: MetricValueType;
  readonly unit: string;
  readonly dataMode: DataMode;
  readonly watermark: "DEMO" | null;
  readonly taxYear: number | null;
  readonly scenarioId: string | null;
  readonly geographyLevels: readonly GeographyLevel[];
  readonly dataVintage: string;
  readonly sourceReferences: readonly MetricSourceReference[];
  readonly methodologyPath: string;
  readonly downloadable: boolean;
  readonly valuesAvailable: boolean;
  readonly availabilityNote: string | null;
}

export type SuppressionStatus =
  | "published"
  | "qualified"
  | "suppressed"
  | "not_available";

export type SuppressionReason =
  | "none"
  | "no_data"
  | "non_finite_value"
  | "publisher_suppressed"
  | "restricted_reuse"
  | "small_unweighted_cell"
  | "small_weighted_population"
  | "low_effective_sample_size"
  | "high_relative_standard_error"
  | "unsupported_small_area_model"
  | "complementary_suppression";

export type UncertaintyLevel = "low" | "medium" | "high" | "not_assessed";
export type UncertaintyPattern = "solid" | "dots" | "diagonal" | "crosshatch";

export interface UncertaintyAssessment {
  readonly level: UncertaintyLevel;
  readonly reasons: readonly string[];
  readonly standardError: number | null;
  readonly relativeStandardError: number | null;
  readonly lowerBound: number | null;
  readonly upperBound: number | null;
  readonly confidenceLevel: number | null;
  readonly pattern: UncertaintyPattern;
}

export interface AggregateMetricRecord {
  readonly geographyCode: string;
  readonly metricId: string;
  readonly value: number | string | null;
  readonly roundedValue: number | string | null;
  readonly unweightedHouseholds: number | null;
  readonly weightedHouseholds: number | null;
  readonly effectiveSampleSize: number | null;
  readonly standardError: number | null;
  readonly modelError: number | null;
  readonly calibrationStatus: "calibrated" | "partially_calibrated" | "not_calibrated";
  readonly suppressionStatus: SuppressionStatus;
  readonly suppressionReasons: readonly SuppressionReason[];
  readonly uncertainty: UncertaintyAssessment;
  readonly dataMode: DataMode;
  readonly watermark: "DEMO" | null;
  readonly dataVintage: string;
  readonly geographyVersion: string;
}

export interface AggregateDataset {
  readonly schemaVersion: "1.0";
  readonly datasetId: string;
  readonly generatedAt: string;
  readonly dataMode: DataMode;
  readonly watermark: "DEMO" | null;
  readonly containsHouseholdRecords: false;
  readonly definitions: readonly MetricDefinition[];
  readonly records: readonly AggregateMetricRecord[];
}

export const PIPELINE_STAGES = [
  "raw",
  "staging",
  "curated",
  "calibrated",
  "published",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export interface ProvenanceManifest {
  readonly schemaVersion: "1.0";
  readonly datasetId: string;
  readonly dataMode: DataMode;
  readonly sourceName: string;
  readonly publisher: string;
  readonly sourceReference: string;
  readonly accessDate: string;
  readonly publicationDate: string | null;
  readonly dataPeriod: string;
  readonly geographicCoverage: string;
  readonly licenceOrReuseConditions: string;
  readonly checksum: string;
  readonly checksumAlgorithm: "sha256";
  readonly originalFilename: string;
  readonly transformVersion: string;
  readonly transformationSteps: readonly string[];
  readonly qualityWarnings: readonly string[];
  readonly outputTables: readonly string[];
  readonly responsibleMaintainer: string;
  readonly pipelineStage: PipelineStage;
  readonly containsRestrictedMicrodata: false;
  readonly containsAdministrativeTaxpayerMicrodata: false;
  readonly outputChecksums?: Readonly<Record<string, string>>;
}

export interface PlaceSearchResult {
  readonly code: string;
  readonly officialCode: string;
  readonly name: string;
  readonly hierarchicalLabel: string;
  readonly level: GeographyLevel;
  readonly autonomousCommunityCode: string | null;
  readonly provinceCode: string | null;
  readonly municipalityCode: string | null;
  readonly postalCodes: readonly string[];
  readonly centroid: Position;
  readonly bbox: readonly [number, number, number, number];
  readonly territorialSupport: TerritorialSupport;
  readonly geometryStatus: GeometryStatus;
  readonly geographyVersion: string;
  readonly dataMode: DataMode;
  readonly demoNotice: string | null;
}
