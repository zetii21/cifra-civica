import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDemoAggregateDataset,
  buildDemoGeographies,
  createGeographyCatalog,
  createMetricCatalog,
  validateAggregateDataset,
  validateGeographyRecords,
} from "../index";

test("DEMO geography uses valid official code shapes and explicit synthetic geometry labels", () => {
  const records = buildDemoGeographies();
  const validation = validateGeographyRecords(records);
  assert.deepEqual(validation.errors, []);
  assert.equal(validation.valid, true);
  assert.equal(records.filter((record) => record.level === "autonomous_community").length, 19);
  assert.equal(records.find((record) => record.code === "ES-MUN-28079")?.name, "Madrid");
  assert.equal(records.find((record) => record.code === "ES-MUN-08019")?.officialCode, "08019");
  assert.ok(records.every((record) => record.dataMode === "demo_synthetic"));
  assert.ok(records.every((record) => record.demoNotice?.includes("DEMO")));
});

test("foral and special territories cannot look fully supported", () => {
  const catalog = createGeographyCatalog(buildDemoGeographies());
  assert.equal(catalog.findByCode("ES-CCAA-15")?.territorialSupport, "unsupported");
  assert.equal(catalog.findByCode("ES-CCAA-16")?.territorialSupport, "unsupported");
  assert.equal(catalog.findByCode("ES-CCAA-05")?.territorialSupport, "partial");
  assert.equal(catalog.findByCode("ES-CCAA-18")?.territorialSupport, "partial");
});

test("official context definitions have no fabricated fixture values", () => {
  const geographies = buildDemoGeographies();
  const dataset = buildDemoAggregateDataset(geographies);
  const validation = validateAggregateDataset(dataset);
  assert.deepEqual(validation.errors, []);
  const catalog = createMetricCatalog(dataset);
  const official = catalog.definition("official_median_net_income_eur");
  assert.equal(official?.kind, "official_statistic");
  assert.equal(official?.valuesAvailable, false);
  assert.equal(catalog.values("official_median_net_income_eur").length, 0);
  assert.ok(catalog.values("demo_mean_fiscal_change_eur").every((cell) => cell.watermark === "DEMO"));
  assert.ok(dataset.records.every((cell) =>
    cell.suppressionStatus !== "suppressed" || (cell.value === null && cell.roundedValue === null)
  ));
});

test("simulated fixture never downscales municipal estimates to census sections", () => {
  const geographies = buildDemoGeographies();
  const dataset = buildDemoAggregateDataset(geographies);
  const sectionCodes = new Set(
    geographies.filter((record) => record.level === "census_section").map((record) => record.code),
  );
  assert.equal(dataset.records.some((record) => sectionCodes.has(record.geographyCode)), false);
});
