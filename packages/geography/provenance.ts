import { PIPELINE_STAGES, type PipelineStage, type ProvenanceManifest } from "./types";

export interface ProvenanceValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const SHA256 = /^[a-f0-9]{64}$/;

export function validateProvenanceManifest(
  manifest: ProvenanceManifest,
): ProvenanceValidationResult {
  const errors: string[] = [];

  const requiredStrings: readonly (keyof ProvenanceManifest)[] = [
    "datasetId",
    "sourceName",
    "publisher",
    "sourceReference",
    "accessDate",
    "dataPeriod",
    "geographicCoverage",
    "licenceOrReuseConditions",
    "checksum",
    "originalFilename",
    "transformVersion",
    "responsibleMaintainer",
  ];

  for (const field of requiredStrings) {
    const value = manifest[field];
    if (typeof value !== "string" || value.trim() === "") {
      errors.push(`${field} is required`);
    }
  }

  if (!ISO_DATE.test(manifest.accessDate)) {
    errors.push("accessDate must use YYYY-MM-DD");
  }
  if (manifest.publicationDate !== null && !ISO_DATE.test(manifest.publicationDate)) {
    errors.push("publicationDate must be null or YYYY-MM-DD");
  }
  if (!SHA256.test(manifest.checksum)) {
    errors.push("checksum must be a lowercase SHA-256 hex digest");
  }
  if (manifest.transformationSteps.length === 0) {
    errors.push("transformationSteps must not be empty");
  }
  if (manifest.outputTables.length === 0) {
    errors.push("outputTables must not be empty");
  }
  if (manifest.containsRestrictedMicrodata) {
    errors.push("restricted microdata may not be published");
  }
  if (manifest.containsAdministrativeTaxpayerMicrodata) {
    errors.push("administrative taxpayer microdata may not be published");
  }
  if (manifest.dataMode === "demo_synthetic" && !manifest.qualityWarnings.some((warning) =>
    warning.toLocaleUpperCase("es-ES").includes("DEMO")
  )) {
    errors.push("synthetic manifests must carry an explicit DEMO quality warning");
  }

  return { valid: errors.length === 0, errors };
}

export function assertValidProvenanceManifest(manifest: ProvenanceManifest): void {
  const result = validateProvenanceManifest(manifest);
  if (!result.valid) {
    throw new Error(`Invalid provenance manifest: ${result.errors.join("; ")}`);
  }
}

export function assertValidStageTransition(from: PipelineStage, to: PipelineStage): void {
  const fromIndex = PIPELINE_STAGES.indexOf(from);
  const toIndex = PIPELINE_STAGES.indexOf(to);
  if (toIndex !== fromIndex + 1) {
    throw new Error(`Invalid pipeline transition ${from} -> ${to}; stages cannot be skipped`);
  }
}

export function isPublishableManifest(manifest: ProvenanceManifest): boolean {
  return manifest.pipelineStage === "published" && validateProvenanceManifest(manifest).valid;
}
