import assert from "node:assert/strict";
import test from "node:test";

import { assessUncertainty, roundForHonestPrecision } from "../uncertainty";

test("sampling and model uncertainty combine in quadrature", () => {
  const result = assessUncertainty({
    estimate: 500,
    samplingStandardError: 30,
    modelStandardError: 40,
    calibrationStatus: "calibrated",
  });
  assert.equal(result.standardError, 50);
  assert.equal(result.relativeStandardError, 0.1);
  assert.equal(result.lowerBound, 402);
  assert.equal(result.upperBound, 598);
  assert.equal(result.level, "low");
  assert.equal(result.pattern, "solid");
});

test("approximations and missing calibration increase uncertainty", () => {
  const result = assessUncertainty({
    estimate: 500,
    samplingStandardError: 10,
    modelStandardError: 10,
    approximationCount: 2,
    calibrationStatus: "not_calibrated",
  });
  assert.equal(result.level, "high");
  assert.equal(result.pattern, "diagonal");
  assert.equal(roundForHonestPrecision(527, result), 550);
});

test("missing uncertainty inputs are honestly not assessed", () => {
  const result = assessUncertainty({
    estimate: 100,
    samplingStandardError: null,
    modelStandardError: null,
  });
  assert.equal(result.level, "not_assessed");
  assert.equal(result.lowerBound, null);
});
