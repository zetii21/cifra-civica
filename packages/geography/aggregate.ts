import { applyDisclosureControl, type DisclosurePolicy } from "./disclosure";
import type { GeographyLevel, SuppressionReason, SuppressionStatus, UncertaintyAssessment } from "./types";
import { assessUncertainty } from "./uncertainty";

/** Internal-only harmonised outcome. These rows must never be sent to browsers. */
export interface WeightedHouseholdOutcome {
  readonly geographyCode: string;
  readonly weight: number;
  readonly baselineDisposableIncome: number;
  readonly scenarioDisposableIncome: number;
  readonly equivalenceScale?: number;
}

export interface AggregateModelParameters {
  readonly modelVersion: string;
  readonly quantiles: readonly number[];
  readonly gainThresholdEur: number;
  readonly lossThresholdEur: number;
  readonly povertyThresholdEur: number | null;
  readonly includeInequalityIndicators: boolean;
  readonly modelStandardErrorEur: number;
  readonly smallAreaModelValidated: boolean;
}

export const DEFAULT_AGGREGATE_MODEL_PARAMETERS: AggregateModelParameters = Object.freeze({
  modelVersion: "aggregate-core/1.0.0",
  quantiles: [0.1, 0.25, 0.5, 0.75, 0.9],
  gainThresholdEur: 500,
  lossThresholdEur: 500,
  povertyThresholdEur: null,
  includeInequalityIndicators: false,
  modelStandardErrorEur: 0,
  smallAreaModelValidated: false,
});

export interface AggregateStatistics {
  readonly meanChangeEur: number | null;
  readonly medianChangeEur: number | null;
  readonly quantilesEur: Readonly<Record<string, number>> | null;
  readonly shareGaining: number | null;
  readonly shareLosing: number | null;
  readonly shareGainAboveThreshold: number | null;
  readonly shareLossBelowThreshold: number | null;
  readonly baselinePovertyRate: number | null;
  readonly scenarioPovertyRate: number | null;
  readonly povertyRateChange: number | null;
  readonly baselineGini: number | null;
  readonly scenarioGini: number | null;
}

export interface PublishedAggregateSummary {
  readonly geographyCode: string;
  readonly geographyLevel: GeographyLevel;
  readonly modelVersion: string;
  readonly unweightedHouseholds: number;
  readonly weightedHouseholds: number;
  readonly effectiveSampleSize: number;
  readonly statistics: AggregateStatistics;
  readonly samplingStandardErrorEur: number | null;
  readonly modelStandardErrorEur: number | null;
  readonly uncertainty: UncertaintyAssessment;
  readonly suppressionStatus: SuppressionStatus;
  readonly suppressionReasons: readonly SuppressionReason[];
  readonly containsHouseholdRecords: false;
}

function validateOutcomes(outcomes: readonly WeightedHouseholdOutcome[]): void {
  for (const [index, outcome] of outcomes.entries()) {
    if (!Number.isFinite(outcome.weight) || outcome.weight <= 0) {
      throw new Error(`Outcome ${index} has a non-positive or non-finite weight`);
    }
    if (!Number.isFinite(outcome.baselineDisposableIncome) || !Number.isFinite(outcome.scenarioDisposableIncome)) {
      throw new Error(`Outcome ${index} has non-finite disposable income`);
    }
    if (
      outcome.equivalenceScale !== undefined &&
      (!Number.isFinite(outcome.equivalenceScale) || outcome.equivalenceScale <= 0)
    ) {
      throw new Error(`Outcome ${index} has an invalid equivalence scale`);
    }
  }
}

function sumWeights(outcomes: readonly WeightedHouseholdOutcome[]): number {
  return outcomes.reduce((sum, outcome) => sum + outcome.weight, 0);
}

function weightedMean(values: readonly number[], weights: readonly number[]): number {
  const denominator = weights.reduce((sum, weight) => sum + weight, 0);
  if (denominator <= 0) throw new Error("Weighted statistics require a positive total weight");
  return values.reduce((sum, value, index) => sum + value * weights[index], 0) / denominator;
}

export function weightedQuantile(
  values: readonly number[],
  weights: readonly number[],
  quantile: number,
): number {
  if (values.length !== weights.length || values.length === 0) {
    throw new Error("Values and weights must be non-empty and have equal length");
  }
  if (!Number.isFinite(quantile) || quantile < 0 || quantile > 1) {
    throw new Error("Quantile must be between 0 and 1");
  }
  const ordered = values
    .map((value, index) => ({ value, weight: weights[index] }))
    .sort((first, second) => first.value - second.value);
  const totalWeight = ordered.reduce((sum, item) => sum + item.weight, 0);
  const target = quantile * totalWeight;
  let cumulative = 0;
  for (const item of ordered) {
    cumulative += item.weight;
    if (cumulative >= target) return item.value;
  }
  return ordered[ordered.length - 1].value;
}

/** Weighted Gini for non-negative values; returns null when its method assumptions fail. */
export function weightedGini(values: readonly number[], weights: readonly number[]): number | null {
  if (values.length !== weights.length || values.length === 0) return null;
  if (values.some((value) => !Number.isFinite(value) || value < 0)) return null;
  if (weights.some((weight) => !Number.isFinite(weight) || weight <= 0)) return null;
  const ordered = values
    .map((value, index) => ({ value, weight: weights[index] }))
    .sort((first, second) => first.value - second.value);
  const totalWeight = ordered.reduce((sum, item) => sum + item.weight, 0);
  const totalIncome = ordered.reduce((sum, item) => sum + item.value * item.weight, 0);
  if (totalIncome === 0) return 0;
  let cumulativeWeight = 0;
  let weightedRankIncome = 0;
  for (const item of ordered) {
    weightedRankIncome += item.value * item.weight * (cumulativeWeight + item.weight / 2);
    cumulativeWeight += item.weight;
  }
  return Math.max(0, Math.min(1, (2 * weightedRankIncome) / (totalWeight * totalIncome) - 1));
}

function emptyStatistics(): AggregateStatistics {
  return {
    meanChangeEur: null,
    medianChangeEur: null,
    quantilesEur: null,
    shareGaining: null,
    shareLosing: null,
    shareGainAboveThreshold: null,
    shareLossBelowThreshold: null,
    baselinePovertyRate: null,
    scenarioPovertyRate: null,
    povertyRateChange: null,
    baselineGini: null,
    scenarioGini: null,
  };
}

function shareWhere(
  outcomes: readonly WeightedHouseholdOutcome[],
  predicate: (outcome: WeightedHouseholdOutcome) => boolean,
): number {
  const total = sumWeights(outcomes);
  return outcomes.reduce((sum, outcome) => sum + (predicate(outcome) ? outcome.weight : 0), 0) / total;
}

export function aggregateWeightedOutcomes(
  geographyCode: string,
  geographyLevel: GeographyLevel,
  outcomes: readonly WeightedHouseholdOutcome[],
  parameters: AggregateModelParameters = DEFAULT_AGGREGATE_MODEL_PARAMETERS,
  disclosurePolicy?: DisclosurePolicy,
): PublishedAggregateSummary {
  if (outcomes.length === 0) {
    return {
      geographyCode,
      geographyLevel,
      modelVersion: parameters.modelVersion,
      unweightedHouseholds: 0,
      weightedHouseholds: 0,
      effectiveSampleSize: 0,
      statistics: emptyStatistics(),
      samplingStandardErrorEur: null,
      modelStandardErrorEur: null,
      uncertainty: assessUncertainty({ estimate: null, samplingStandardError: null, modelStandardError: null }),
      suppressionStatus: "not_available",
      suppressionReasons: ["no_data"],
      containsHouseholdRecords: false,
    };
  }
  validateOutcomes(outcomes);
  if (outcomes.some((outcome) => outcome.geographyCode !== geographyCode)) {
    throw new Error("Every input outcome must match the aggregate geography code");
  }
  for (const quantile of parameters.quantiles) {
    if (!Number.isFinite(quantile) || quantile < 0 || quantile > 1) {
      throw new Error(`Invalid configured quantile: ${quantile}`);
    }
  }
  const weights = outcomes.map((outcome) => outcome.weight);
  const changes = outcomes.map((outcome) => outcome.scenarioDisposableIncome - outcome.baselineDisposableIncome);
  const baselineEquivalised = outcomes.map((outcome) =>
    outcome.baselineDisposableIncome / (outcome.equivalenceScale ?? 1)
  );
  const scenarioEquivalised = outcomes.map((outcome) =>
    outcome.scenarioDisposableIncome / (outcome.equivalenceScale ?? 1)
  );
  const weightedHouseholds = sumWeights(outcomes);
  const squaredWeightSum = weights.reduce((sum, weight) => sum + weight ** 2, 0);
  const effectiveSampleSize = weightedHouseholds ** 2 / squaredWeightSum;
  const meanChange = weightedMean(changes, weights);
  const weightedVariance = weightedMean(changes.map((change) => (change - meanChange) ** 2), weights);
  const samplingStandardError = Math.sqrt(weightedVariance / effectiveSampleSize);
  const uncertainty = assessUncertainty({
    estimate: meanChange,
    samplingStandardError,
    modelStandardError: parameters.modelStandardErrorEur,
    approximationCount: parameters.modelStandardErrorEur > 0 ? 1 : 0,
    calibrationStatus: "calibrated",
  });
  const decision = applyDisclosureControl({
    id: geographyCode,
    value: meanChange,
    geographyLevel,
    metricKind: "simulated_estimate",
    unweightedHouseholds: outcomes.length,
    weightedHouseholds,
    effectiveSampleSize,
    standardError: uncertainty.standardError,
    smallAreaModelValidated: parameters.smallAreaModelValidated,
  }, disclosurePolicy);

  if (decision.status === "suppressed") {
    return {
      geographyCode,
      geographyLevel,
      modelVersion: parameters.modelVersion,
      unweightedHouseholds: outcomes.length,
      weightedHouseholds,
      effectiveSampleSize,
      statistics: emptyStatistics(),
      samplingStandardErrorEur: null,
      modelStandardErrorEur: null,
      uncertainty: assessUncertainty({ estimate: null, samplingStandardError: null, modelStandardError: null }),
      suppressionStatus: decision.status,
      suppressionReasons: decision.reasons,
      containsHouseholdRecords: false,
    };
  }

  const povertyThreshold = parameters.povertyThresholdEur;
  // Compute poverty rates directly so equivalence scales remain aligned by index.
  const baselinePoverty = povertyThreshold === null
    ? null
    : outcomes.reduce((sum, outcome, index) =>
        sum + (baselineEquivalised[index] < povertyThreshold ? outcome.weight : 0), 0) / weightedHouseholds;
  const scenarioPoverty = povertyThreshold === null
    ? null
    : outcomes.reduce((sum, outcome, index) =>
        sum + (scenarioEquivalised[index] < povertyThreshold ? outcome.weight : 0), 0) / weightedHouseholds;
  const statistics: AggregateStatistics = {
    meanChangeEur: meanChange,
    medianChangeEur: weightedQuantile(changes, weights, 0.5),
    quantilesEur: Object.fromEntries(parameters.quantiles.map((quantile) => [
      `p${String(Math.round(quantile * 100)).padStart(2, "0")}`,
      weightedQuantile(changes, weights, quantile),
    ])),
    shareGaining: shareWhere(outcomes, (outcome) => outcome.scenarioDisposableIncome > outcome.baselineDisposableIncome),
    shareLosing: shareWhere(outcomes, (outcome) => outcome.scenarioDisposableIncome < outcome.baselineDisposableIncome),
    shareGainAboveThreshold: shareWhere(
      outcomes,
      (outcome) => outcome.scenarioDisposableIncome - outcome.baselineDisposableIncome > parameters.gainThresholdEur,
    ),
    shareLossBelowThreshold: shareWhere(
      outcomes,
      (outcome) => outcome.scenarioDisposableIncome - outcome.baselineDisposableIncome < -parameters.lossThresholdEur,
    ),
    baselinePovertyRate: baselinePoverty,
    scenarioPovertyRate: scenarioPoverty,
    povertyRateChange: baselinePoverty === null || scenarioPoverty === null ? null : scenarioPoverty - baselinePoverty,
    baselineGini: parameters.includeInequalityIndicators ? weightedGini(baselineEquivalised, weights) : null,
    scenarioGini: parameters.includeInequalityIndicators ? weightedGini(scenarioEquivalised, weights) : null,
  };

  return {
    geographyCode,
    geographyLevel,
    modelVersion: parameters.modelVersion,
    unweightedHouseholds: outcomes.length,
    weightedHouseholds,
    effectiveSampleSize,
    statistics,
    samplingStandardErrorEur: samplingStandardError,
    modelStandardErrorEur: parameters.modelStandardErrorEur,
    uncertainty,
    suppressionStatus: decision.status,
    suppressionReasons: decision.reasons,
    containsHouseholdRecords: false,
  };
}

export function aggregateOutcomesByGeography(
  geographyLevel: GeographyLevel,
  outcomes: readonly WeightedHouseholdOutcome[],
  parameters: AggregateModelParameters = DEFAULT_AGGREGATE_MODEL_PARAMETERS,
  disclosurePolicy?: DisclosurePolicy,
): readonly PublishedAggregateSummary[] {
  const groups = new Map<string, WeightedHouseholdOutcome[]>();
  for (const outcome of outcomes) {
    groups.set(outcome.geographyCode, [...(groups.get(outcome.geographyCode) ?? []), outcome]);
  }
  return [...groups.entries()]
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([geographyCode, group]) =>
      aggregateWeightedOutcomes(geographyCode, geographyLevel, group, parameters, disclosurePolicy)
    );
}
