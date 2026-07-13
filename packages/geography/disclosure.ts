import type {
  GeographyLevel,
  MetricKind,
  SuppressionReason,
  SuppressionStatus,
} from "./types";

export interface DisclosurePolicy {
  readonly minUnweightedHouseholds: number;
  readonly minWeightedHouseholds: number;
  readonly minEffectiveSampleSize: number;
  readonly qualifyRelativeStandardError: number;
  readonly suppressRelativeStandardError: number;
  readonly requireValidatedSmallAreaModel: boolean;
  readonly complementarySuppression: boolean;
}

export const DEFAULT_DISCLOSURE_POLICY: DisclosurePolicy = Object.freeze({
  minUnweightedHouseholds: 30,
  minWeightedHouseholds: 100,
  minEffectiveSampleSize: 25,
  qualifyRelativeStandardError: 0.2,
  suppressRelativeStandardError: 0.35,
  requireValidatedSmallAreaModel: true,
  complementarySuppression: true,
});

export interface DisclosureInput {
  readonly id: string;
  readonly value: number | string | null;
  readonly geographyLevel: GeographyLevel;
  readonly metricKind: MetricKind;
  readonly unweightedHouseholds: number | null;
  readonly weightedHouseholds: number | null;
  readonly effectiveSampleSize: number | null;
  readonly standardError: number | null;
  readonly publisherSuppressed?: boolean;
  readonly reusePermitted?: boolean;
  readonly smallAreaModelValidated?: boolean;
}

export interface DisclosureDecision {
  readonly id: string;
  readonly status: SuppressionStatus;
  readonly reasons: readonly SuppressionReason[];
  readonly publishableValue: number | string | null;
  readonly primarySuppression: boolean;
}

const SMALL_AREA_LEVELS = new Set<GeographyLevel>(["district", "census_section"]);

function relativeStandardError(value: number, standardError: number | null): number | null {
  if (standardError === null || !Number.isFinite(standardError)) return null;
  const denominator = Math.abs(value);
  if (denominator < Number.EPSILON) return standardError === 0 ? 0 : Number.POSITIVE_INFINITY;
  return Math.abs(standardError) / denominator;
}

/**
 * Applies project disclosure controls to a single aggregate cell. Official
 * publisher suppression is always preserved and can never be overridden here.
 */
export function applyDisclosureControl(
  input: DisclosureInput,
  policy: DisclosurePolicy = DEFAULT_DISCLOSURE_POLICY,
): DisclosureDecision {
  const suppress: SuppressionReason[] = [];
  const qualify: SuppressionReason[] = [];

  if (input.value === null) {
    return {
      id: input.id,
      status: "not_available",
      reasons: ["no_data"],
      publishableValue: null,
      primarySuppression: false,
    };
  }

  if (typeof input.value === "number" && !Number.isFinite(input.value)) {
    suppress.push("non_finite_value");
  }
  if (input.publisherSuppressed) suppress.push("publisher_suppressed");
  if (input.reusePermitted === false) suppress.push("restricted_reuse");

  if (input.metricKind === "simulated_estimate") {
    if (
      policy.requireValidatedSmallAreaModel &&
      SMALL_AREA_LEVELS.has(input.geographyLevel) &&
      input.smallAreaModelValidated !== true
    ) {
      suppress.push("unsupported_small_area_model");
    }
    if (
      input.unweightedHouseholds !== null &&
      input.unweightedHouseholds < policy.minUnweightedHouseholds
    ) {
      suppress.push("small_unweighted_cell");
    }
    if (
      input.weightedHouseholds !== null &&
      input.weightedHouseholds < policy.minWeightedHouseholds
    ) {
      suppress.push("small_weighted_population");
    }
    if (
      input.effectiveSampleSize !== null &&
      input.effectiveSampleSize < policy.minEffectiveSampleSize
    ) {
      suppress.push("low_effective_sample_size");
    }

    if (typeof input.value === "number") {
      const rse = relativeStandardError(input.value, input.standardError);
      if (rse !== null && rse > policy.suppressRelativeStandardError) {
        suppress.push("high_relative_standard_error");
      } else if (rse !== null && rse > policy.qualifyRelativeStandardError) {
        qualify.push("high_relative_standard_error");
      }
    }
  }

  const uniqueSuppress = [...new Set(suppress)];
  if (uniqueSuppress.length > 0) {
    return {
      id: input.id,
      status: "suppressed",
      reasons: uniqueSuppress,
      publishableValue: null,
      primarySuppression: true,
    };
  }

  const uniqueQualify = [...new Set(qualify)];
  return {
    id: input.id,
    status: uniqueQualify.length > 0 ? "qualified" : "published",
    reasons: uniqueQualify.length > 0 ? uniqueQualify : ["none"],
    publishableValue: input.value,
    primarySuppression: false,
  };
}

/**
 * Prevents differencing a single suppressed component from a published total.
 * The smallest publishable peer is secondarily suppressed. Call per metric and
 * mutually exclusive parent group only.
 */
export function applyComplementarySuppression(
  inputs: readonly DisclosureInput[],
  policy: DisclosurePolicy = DEFAULT_DISCLOSURE_POLICY,
): readonly DisclosureDecision[] {
  const decisions = inputs.map((input) => applyDisclosureControl(input, policy));
  if (!policy.complementarySuppression) return decisions;

  const primary = decisions.filter((decision) => decision.primarySuppression);
  const publishable = decisions
    .map((decision, index) => ({ decision, index, input: inputs[index] }))
    .filter(({ decision, input }) =>
      decision.status !== "suppressed" && typeof input.value === "number"
    );

  if (primary.length !== 1 || publishable.length === 0) return decisions;

  const secondary = publishable.reduce((smallest, candidate) => {
    const candidateSize = candidate.input.unweightedHouseholds ?? Number.POSITIVE_INFINITY;
    const smallestSize = smallest.input.unweightedHouseholds ?? Number.POSITIVE_INFINITY;
    return candidateSize < smallestSize ? candidate : smallest;
  });

  return decisions.map((decision, index) =>
    index === secondary.index
      ? {
          ...decision,
          status: "suppressed" as const,
          reasons: ["complementary_suppression" as const],
          publishableValue: null,
          primarySuppression: false,
        }
      : decision
  );
}
