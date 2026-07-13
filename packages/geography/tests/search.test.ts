import assert from "node:assert/strict";
import test from "node:test";

import { demoGeographyCatalog } from "../catalog";
import { normalizePlaceText, searchPlaces } from "../search";

test("place normalization is accent and punctuation tolerant", () => {
  assert.equal(normalizePlaceText("  A Coruña  "), "a coruna");
  assert.equal(normalizePlaceText("Pamplona/Iruña"), "pamplona iruna");
});

test("search finds municipalities by name variant, official code and postcode", () => {
  assert.equal(searchPlaces(demoGeographyCatalog, "Coruna")[0]?.code, "ES-MUN-15030");
  assert.equal(searchPlaces(demoGeographyCatalog, "46250")[0]?.name, "València");
  assert.equal(searchPlaces(demoGeographyCatalog, "08001")[0]?.name, "Barcelona");
});

test("search returns transparent territorial and DEMO metadata", () => {
  const result = searchPlaces(demoGeographyCatalog, "Bilbao")[0];
  assert.equal(result.territorialSupport, "unsupported");
  assert.equal(result.geometryStatus, "synthetic_simplified_demo");
  assert.equal(result.dataMode, "demo_synthetic");
  assert.match(result.demoNotice ?? "", /DEMO/);
});

test("fine geography is opt-in and results are capped", () => {
  assert.equal(searchPlaces(demoGeographyCatalog, "seccion").length, 0);
  assert.ok(searchPlaces(demoGeographyCatalog, "muestra", { includeFineGeographies: true }).length > 0);
  assert.ok(searchPlaces(demoGeographyCatalog, "a", { includeFineGeographies: true }).length === 0);
  assert.ok(searchPlaces(demoGeographyCatalog, "ma", { limit: 100 }).length <= 20);
});
