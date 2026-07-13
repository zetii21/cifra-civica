import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  aggregateOutcomesByGeography,
  aggregateWeightedOutcomes,
  weightedGini,
  weightedQuantile,
  type AggregateModelParameters,
  type WeightedHouseholdOutcome,
  DEFAULT_AGGREGATE_MODEL_PARAMETERS,
} from "../aggregate";

function outcomes(code = "ES-MUN-28079"): WeightedHouseholdOutcome[] {
  return Array.from({ length: 40 }, (_, index) => ({
    geographyCode: code,
    weight: index < 20 ? 2 : 4,
    baselineDisposableIncome: index < 20 ? 10_000 : 20_000,
    scenarioDisposableIncome: index < 20 ? 10_100 : 20_900,
    equivalenceScale: 1,
  }));
}

const parameters: AggregateModelParameters = {
  modelVersion: "test/1",
  quantiles: [0.1, 0.5, 0.9],
  gainThresholdEur: 500,
  lossThresholdEur: 500,
  povertyThresholdEur: 15_000,
  includeInequalityIndicators: true,
  modelStandardErrorEur: 0,
  smallAreaModelValidated: false,
};

test("weighted aggregation produces mean, median, quantiles, threshold shares and rates", () => {
  const result = aggregateWeightedOutcomes("ES-MUN-28079", "municipality", outcomes(), parameters);
  assert.equal(result.suppressionStatus, "published");
  assert.ok(Math.abs((result.statistics.meanChangeEur ?? 0) - 633.3333333333) < 1e-8);
  assert.equal(result.statistics.medianChangeEur, 900);
  assert.deepEqual(result.statistics.quantilesEur, { p10: 100, p50: 900, p90: 900 });
  assert.equal(result.statistics.shareGaining, 1);
  assert.ok(Math.abs((result.statistics.shareGainAboveThreshold ?? 0) - 2 / 3) < 1e-12);
  assert.equal(result.statistics.shareLosing, 0);
  assert.ok(Math.abs((result.statistics.baselinePovertyRate ?? 0) - 1 / 3) < 1e-12);
  assert.equal(result.containsHouseholdRecords, false);
  assert.equal("outcomes" in result, false);
});

test("effective sample size reflects unequal weights", () => {
  const result = aggregateWeightedOutcomes("ES-MUN-28079", "municipality", outcomes(), parameters);
  assert.equal(result.weightedHouseholds, 120);
  assert.equal(result.effectiveSampleSize, 36);
});

test("unvalidated fine-area results are suppressed with no statistics", () => {
  const result = aggregateWeightedOutcomes("ES-DIS-2807901", "district", outcomes("ES-DIS-2807901"), parameters);
  assert.equal(result.suppressionStatus, "suppressed");
  assert.ok(result.suppressionReasons.includes("unsupported_small_area_model"));
  assert.equal(result.statistics.meanChangeEur, null);
  assert.equal(result.samplingStandardErrorEur, null);
});

test("weighted primitives reject bad assumptions and gini is opt-in safe", () => {
  assert.equal(weightedQuantile([1, 9], [1, 3], 0.5), 9);
  assert.equal(weightedGini([0, 10], [1, 1]), 0.5);
  assert.equal(weightedGini([-1, 10], [1, 1]), null);
  assert.throws(() => weightedQuantile([1], [1], 2), /between 0 and 1/);
  assert.throws(() => aggregateWeightedOutcomes("x", "municipality", [{
    geographyCode: "x",
    weight: 0,
    baselineDisposableIncome: 1,
    scenarioDisposableIncome: 2,
  }], parameters), /weight/);
});

test("grouped aggregation is stable and contains aggregate outputs only", () => {
  const grouped = aggregateOutcomesByGeography("municipality", [
    ...outcomes("ES-MUN-28079"),
    ...outcomes("ES-MUN-08019"),
  ], parameters);
  assert.deepEqual(grouped.map((result) => result.geographyCode), ["ES-MUN-08019", "ES-MUN-28079"]);
  assert.ok(grouped.every((result) => result.containsHouseholdRecords === false));
});

test("machine-readable aggregate manifest matches executable default parameters", async () => {
  const manifest = JSON.parse(await readFile("data/sample/aggregate-model-manifest.json", "utf8"));
  assert.equal(manifest.modelVersion, DEFAULT_AGGREGATE_MODEL_PARAMETERS.modelVersion);
  assert.deepEqual(manifest.parameters.quantiles, DEFAULT_AGGREGATE_MODEL_PARAMETERS.quantiles);
  assert.equal(manifest.parameters.gainThresholdEur, DEFAULT_AGGREGATE_MODEL_PARAMETERS.gainThresholdEur);
  assert.equal(manifest.parameters.lossThresholdEur, DEFAULT_AGGREGATE_MODEL_PARAMETERS.lossThresholdEur);
  assert.equal(manifest.publication.containsHouseholdRecords, false);
  assert.equal(manifest.publication.smallAreaMunicipalAverageDownscalingPermitted, false);
});
