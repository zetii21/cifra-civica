import assert from "node:assert/strict";
import test from "node:test";

import { assertDataModeAllowed } from "../runtime-guard";

test("production rejects synthetic data without an explicit override", () => {
  assert.throws(() => assertDataModeAllowed({
    environment: "production",
    dataMode: "demo_synthetic",
  }), /disabled in production/);
  assert.doesNotThrow(() => assertDataModeAllowed({
    environment: "production",
    dataMode: "demo_synthetic",
    allowSyntheticInProduction: true,
  }));
  assert.doesNotThrow(() => assertDataModeAllowed({
    environment: "production",
    dataMode: "official",
  }));
});
