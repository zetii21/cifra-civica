import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  DEMO_GENERATED_AT,
  DEMO_GEOGRAPHY_VERSION,
  buildDemoAggregateDataset,
  buildDemoGeographies,
} from "../../packages/geography/demo-source";
import { assertValidProvenanceManifest } from "../../packages/geography/provenance";
import type { GeographyRecord, ProvenanceManifest } from "../../packages/geography/types";
import { assertValidPublishedData } from "../../packages/geography/validation";

const THIS_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPOSITORY_ROOT = resolve(THIS_DIRECTORY, "../..");

function prettyJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function asFeature(record: GeographyRecord) {
  return {
    type: "Feature" as const,
    id: record.code,
    bbox: record.bbox,
    geometry: record.geometry,
    properties: {
      geography_code: record.code,
      official_code: record.officialCode,
      code_scheme: record.codeScheme,
      name: record.name,
      level: record.level,
      parent_code: record.parentCode,
      autonomous_community_code: record.autonomousCommunityCode,
      province_code: record.provinceCode,
      municipality_code: record.municipalityCode,
      postal_codes: record.postalCodes,
      geometry_status: record.geometryStatus,
      territorial_support: record.territorialSupport,
      geography_version: record.geographyVersion,
      data_mode: record.dataMode,
      demo: true,
      demo_notice: record.demoNotice,
    },
  };
}

function geographyManifest(sourceChecksum: string, outputChecksums: Record<string, string>): ProvenanceManifest {
  return {
    schemaVersion: "1.0",
    datasetId: "cifra-civica-demo-geography-2027-v1",
    dataMode: "demo_synthetic",
    sourceName: "INE nomenclature reference + Cifra Cívica synthetic boundary fixture",
    publisher: "Instituto Nacional de Estadística / Cifra Cívica",
    sourceReference: "https://www.ine.es/daco/daco42/codmun/codmunmapa.htm",
    accessDate: "2026-07-13",
    publicationDate: null,
    dataPeriod: "Official codes consulted for development; synthetic geometry version 2027.1",
    geographicCoverage: "Spain; 19 autonomous communities/cities and a non-exhaustive municipality sample",
    licenceOrReuseConditions: "INE source reuse conditions apply to names/codes. Synthetic rectangles are CC0 project fixtures.",
    checksum: sourceChecksum,
    checksumAlgorithm: "sha256",
    originalFilename: "packages/geography/demo-source.ts",
    transformVersion: "geography-demo-generator/1.0.0",
    transformationSteps: [
      "Curate official INE codes and place names into a reviewed development seed.",
      "Generate deliberately simplified rectangular DEMO geometries around coarse extents.",
      "Validate code formats, hierarchy, bboxes, closed rings, labels and synthetic-data guards.",
      "Publish JSON catalog and vector-tile-source GeoJSON with immutable geography version.",
    ],
    qualityWarnings: [
      "DEMO — boundaries are synthetic rectangles and must never be described as official cartography.",
      "Municipality coverage is a small development sample, not all Spanish municipalities.",
      "District and census-section identifiers/geometries are development examples and not official boundary extracts.",
    ],
    outputTables: ["demo_geographies", "demo_geography_features"],
    responsibleMaintainer: "data-governance@cifra-civica.invalid",
    pipelineStage: "published",
    containsRestrictedMicrodata: false,
    containsAdministrativeTaxpayerMicrodata: false,
    outputChecksums,
  };
}

function aggregateManifest(sourceChecksum: string, outputChecksums: Record<string, string>): ProvenanceManifest {
  return {
    schemaVersion: "1.0",
    datasetId: "cifra-civica-demo-aggregates-2027-v1",
    dataMode: "demo_synthetic",
    sourceName: "Cifra Cívica deterministic synthetic aggregate generator",
    publisher: "Cifra Cívica",
    sourceReference: "urn:cifra-civica:demo:synthetic-aggregates:v1",
    accessDate: "2026-07-13",
    publicationDate: "2026-07-13",
    dataPeriod: "DEMO 2027",
    geographicCoverage: "Autonomous communities/cities and sample municipalities from the DEMO geography fixture",
    licenceOrReuseConditions: "CC0 synthetic development fixture; not suitable for substantive analysis.",
    checksum: sourceChecksum,
    checksumAlgorithm: "sha256",
    originalFilename: "packages/geography/demo-source.ts",
    transformVersion: "aggregate-demo-generator/1.0.0",
    transformationSteps: [
      "Derive deterministic pseudo-random aggregate values from stable project geography codes.",
      "Attach synthetic sample size, calibration and combined sampling/model uncertainty fields.",
      "Apply primary disclosure controls and physically remove suppressed values.",
      "Round publishable values according to uncertainty and add DEMO watermark to every cell.",
    ],
    qualityWarnings: [
      "DEMO — every populated metric is synthetic and must not be presented as an official or real-world estimate.",
      "Official metric definitions are catalogued without bundled values to prevent fabricated official context.",
      "No household or survey microdata is included.",
    ],
    outputTables: ["demo_metric_definitions", "demo_aggregate_metric_cells"],
    responsibleMaintainer: "data-governance@cifra-civica.invalid",
    pipelineStage: "published",
    containsRestrictedMicrodata: false,
    containsAdministrativeTaxpayerMicrodata: false,
    outputChecksums,
  };
}

export interface GenerateDemoResult {
  readonly geographyVersion: string;
  readonly geographyRecords: number;
  readonly aggregateRecords: number;
  readonly files: readonly string[];
}

export async function generateDemoData(repositoryRoot = DEFAULT_REPOSITORY_ROOT): Promise<GenerateDemoResult> {
  const sourcePath = join(repositoryRoot, "packages/geography/demo-source.ts");
  const sourceBytes = await readFile(sourcePath);
  const sourceChecksum = sha256(sourceBytes);
  const geographies = buildDemoGeographies();
  const aggregates = buildDemoAggregateDataset(geographies);
  assertValidPublishedData(geographies, aggregates);

  const geographyPath = join(repositoryRoot, "data/fixtures/geography/spain-demo-geographies.json");
  const geojsonPath = join(repositoryRoot, "data/fixtures/geography/spain-demo-geometries.geojson");
  const aggregatePath = join(repositoryRoot, "data/fixtures/aggregates/spain-demo-metrics.json");
  const geographyManifestPath = join(repositoryRoot, "data/provenance/spain-demo-geography.provenance.json");
  const aggregateManifestPath = join(repositoryRoot, "data/provenance/spain-demo-aggregates.provenance.json");
  const dataFiles = [geographyPath, geojsonPath, aggregatePath];
  await Promise.all(dataFiles.map((path) => mkdir(dirname(path), { recursive: true })));

  const outputs: Record<string, string> = {
    [geographyPath]: prettyJson({
      schemaVersion: "1.0",
      datasetId: "cifra-civica-demo-geography-2027-v1",
      generatedAt: DEMO_GENERATED_AT,
      geographyVersion: DEMO_GEOGRAPHY_VERSION,
      dataMode: "demo_synthetic",
      watermark: "DEMO",
      records: geographies,
    }),
    [geojsonPath]: prettyJson({
      type: "FeatureCollection",
      name: "cifra-civica-demo-geographies",
      bbox: [-18.2, 27.6, 4.4, 43.8],
      metadata: {
        geographyVersion: DEMO_GEOGRAPHY_VERSION,
        dataMode: "demo_synthetic",
        watermark: "DEMO",
        warning: "DEMO — synthetic simplified rectangles; not official boundaries.",
      },
      features: geographies.filter((record) => record.geometry !== null).map(asFeature),
    }),
    [aggregatePath]: prettyJson(aggregates),
  };

  await Promise.all(Object.entries(outputs).map(([path, contents]) => writeFile(path, contents, "utf8")));
  const outputChecksums = Object.fromEntries(
    Object.entries(outputs).map(([path, contents]) => [path.slice(repositoryRoot.length + 1), sha256(contents)]),
  );
  const geographyOutputChecksums = Object.fromEntries(
    Object.entries(outputChecksums).filter(([path]) => path.includes("geograph")),
  );
  const aggregateOutputChecksums = Object.fromEntries(
    Object.entries(outputChecksums).filter(([path]) => path.includes("aggregate")),
  );
  const manifests = {
    [geographyManifestPath]: geographyManifest(sourceChecksum, geographyOutputChecksums),
    [aggregateManifestPath]: aggregateManifest(sourceChecksum, aggregateOutputChecksums),
  };
  for (const manifest of Object.values(manifests)) assertValidProvenanceManifest(manifest);
  await Promise.all(Object.entries(manifests).map(async ([path, manifest]) => {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, prettyJson(manifest), "utf8");
  }));

  return {
    geographyVersion: DEMO_GEOGRAPHY_VERSION,
    geographyRecords: geographies.length,
    aggregateRecords: aggregates.records.length,
    files: [...dataFiles, ...Object.keys(manifests)].map((path) => path.slice(repositoryRoot.length + 1)),
  };
}

const isDirectRun = process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isDirectRun) {
  const result = await generateDemoData();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
