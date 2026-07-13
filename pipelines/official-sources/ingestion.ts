import { createHash } from "node:crypto";

import type {
  AdapterResult,
  OfficialSourceAdapter,
  RawOfficialSnapshot,
} from "../../packages/geography/official-source-adapter";
import { assertValidProvenanceManifest } from "../../packages/geography/provenance";
import type { ProvenanceManifest } from "../../packages/geography/types";

export interface OfficialIngestionOptions {
  readonly datasetId: string;
  readonly geographicCoverage: string;
  readonly transformVersion: string;
  readonly transformationSteps: readonly string[];
  readonly outputTables: readonly string[];
  readonly responsibleMaintainer: string;
  readonly extraQualityWarnings?: readonly string[];
}

export interface IngestedOfficialDataset<T> {
  readonly result: AdapterResult<T>;
  readonly provenance: ProvenanceManifest;
}

/**
 * The only supported official-snapshot coordinator. It always returns a
 * provenance manifest next to parsed records and never writes source bytes.
 */
export function ingestOfficialSnapshot<T>(
  adapter: OfficialSourceAdapter<T>,
  snapshot: RawOfficialSnapshot,
  options: OfficialIngestionOptions,
): IngestedOfficialDataset<T> {
  const result = adapter.ingest(snapshot);
  const checksum = createHash("sha256").update(snapshot.bytes).digest("hex");
  const provenance: ProvenanceManifest = {
    schemaVersion: "1.0",
    datasetId: options.datasetId,
    dataMode: "official",
    sourceName: adapter.profile.name,
    publisher: adapter.profile.publisher,
    sourceReference: adapter.profile.sourceReference,
    accessDate: snapshot.accessDate,
    publicationDate: snapshot.publicationDate,
    dataPeriod: snapshot.dataPeriod,
    geographicCoverage: options.geographicCoverage,
    licenceOrReuseConditions: snapshot.licenceOrReuseConditions,
    checksum,
    checksumAlgorithm: "sha256",
    originalFilename: snapshot.originalFilename,
    transformVersion: options.transformVersion,
    transformationSteps: [
      "Verify source identity, processing approval and public/research access classification.",
      "Preserve the publisher's missing and suppression markers during staging.",
      ...options.transformationSteps,
      "Validate the curated result and emit this provenance manifest before publication.",
    ],
    qualityWarnings: [
      ...result.warnings,
      ...(options.extraQualityWarnings ?? []),
    ],
    outputTables: options.outputTables,
    responsibleMaintainer: options.responsibleMaintainer,
    pipelineStage: "curated",
    containsRestrictedMicrodata: false,
    containsAdministrativeTaxpayerMicrodata: false,
  };
  assertValidProvenanceManifest(provenance);
  return { result, provenance };
}
