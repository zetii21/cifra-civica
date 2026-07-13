import assert from "node:assert/strict";
import test from "node:test";

import {
  applyComplementarySuppression,
  applyDisclosureControl,
  DEFAULT_DISCLOSURE_POLICY,
  type DisclosureInput,
} from "../disclosure";

function publishable(overrides: Partial<DisclosureInput> = {}): DisclosureInput {
  return {
    id: "cell",
    value: 400,
    geographyLevel: "municipality",
    metricKind: "simulated_estimate",
    unweightedHouseholds: 80,
    weightedHouseholds: 1000,
    effectiveSampleSize: 60,
    standardError: 30,
    smallAreaModelValidated: false,
    ...overrides,
  };
}

test("small cells are suppressed and their values are physically removed", () => {
  const result = applyDisclosureControl(publishable({ unweightedHouseholds: 12 }));
  assert.equal(result.status, "suppressed");
  assert.equal(result.publishableValue, null);
  assert.ok(result.reasons.includes("small_unweighted_cell"));
});

test("unvalidated district and census-section simulated estimates are suppressed", () => {
  for (const geographyLevel of ["district", "census_section"] as const) {
    const result = applyDisclosureControl(publishable({ geographyLevel }));
    assert.equal(result.status, "suppressed");
    assert.ok(result.reasons.includes("unsupported_small_area_model"));
  }
});

test("publisher suppression is preserved for official statistics", () => {
  const result = applyDisclosureControl(publishable({
    metricKind: "official_statistic",
    publisherSuppressed: true,
  }));
  assert.equal(result.status, "suppressed");
  assert.deepEqual(result.reasons, ["publisher_suppressed"]);
});

test("moderate relative standard error qualifies while high error suppresses", () => {
  const qualified = applyDisclosureControl(publishable({ value: 100, standardError: 25 }));
  assert.equal(qualified.status, "qualified");
  const suppressed = applyDisclosureControl(publishable({ value: 100, standardError: 40 }));
  assert.equal(suppressed.status, "suppressed");
});

test("complementary suppression hides one peer when one primary cell is suppressed", () => {
  const results = applyComplementarySuppression([
    publishable({ id: "primary", unweightedHouseholds: 10 }),
    publishable({ id: "smallest-peer", unweightedHouseholds: 50 }),
    publishable({ id: "larger-peer", unweightedHouseholds: 70 }),
  ], DEFAULT_DISCLOSURE_POLICY);
  assert.equal(results.filter((result) => result.status === "suppressed").length, 2);
  assert.deepEqual(results.find((result) => result.id === "smallest-peer")?.reasons, ["complementary_suppression"]);
});
