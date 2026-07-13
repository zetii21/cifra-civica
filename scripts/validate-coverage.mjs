import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const manifest = JSON.parse(
  await readFile(new URL("../model-manifest/coverage.json", import.meta.url), "utf8"),
);

const adultCounts = [1, 2, 3];
const maritalStates = [
  "single",
  "married",
  "separated",
  "divorced",
  "widowed",
  "domestic_partnership",
];
const filingPreferences = ["calculate_best", "individual", "joint"];
const dependantCounts = [0, 1, 2, 3, 4, 5, 6];
const singleParentStates = [false, true];

let validatedHouseholdProfiles = 0;
for (const adultCount of adultCounts) {
  for (const maritalStatus of maritalStates) {
    for (const filingPreference of filingPreferences) {
      for (const dependantCount of dependantCounts) {
        for (const singleParent of singleParentStates) {
          if (
            singleParent &&
            (maritalStatus === "married" ||
              maritalStatus === "domestic_partnership" ||
              dependantCount === 0)
          ) {
            continue;
          }
          if (maritalStatus === "married" && adultCount < 2) continue;
          const jointEligible =
            (maritalStatus === "married" && adultCount === 2) ||
            (singleParent && dependantCount > 0);
          if (filingPreference === "joint" && !jointEligible) continue;
          validatedHouseholdProfiles += 1;
        }
      }
    }
  }
}

assert.equal(validatedHouseholdProfiles, 461);
assert.equal(
  manifest.dimensions.validatedHouseholdProfiles.count,
  validatedHouseholdProfiles,
);

const stateCount =
  manifest.dimensions.territorialOutcomes.count *
  validatedHouseholdProfiles *
  manifest.dimensions.incomeProfiles.count *
  manifest.dimensions.fiscalModifierProfiles.count *
  manifest.dimensions.scenarioBundles.count *
  manifest.dimensions.monthsWorkedValues.count;

assert.equal(stateCount, manifest.declaredStateCount);
assert.ok(stateCount >= manifest.targetRange.minimum);
assert.ok(stateCount <= manifest.targetRange.maximum);

console.log(`Coverage manifest valid: ${stateCount.toLocaleString("es-ES")} states`);
