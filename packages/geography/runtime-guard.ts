import type { DataMode } from "./types";

export interface DataModeGuardInput {
  readonly environment: string | undefined;
  readonly dataMode: DataMode;
  readonly allowSyntheticInProduction?: boolean;
}

/** Release guard required by the data-governance contract. */
export function assertDataModeAllowed(input: DataModeGuardInput): void {
  if (
    input.environment === "production" &&
    input.dataMode === "demo_synthetic" &&
    input.allowSyntheticInProduction !== true
  ) {
    throw new Error(
      "Synthetic DEMO data is disabled in production. Load a provenance-validated official/simulated publication or set the explicit emergency override.",
    );
  }
}
