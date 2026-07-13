import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(import.meta.dirname, "..");
const manifest = JSON.parse(
  readFileSync(path.join(projectRoot, "model-manifest/coverage.json"), "utf8"),
) as {
  declaredStateCount: number;
  targetRange: { minimum: number; maximum: number };
  dimensions: Record<
    string,
    { count: number; factors?: number[]; description: string }
  >;
  formula: string;
  interpretation: string;
  privacy: string;
};

function countValidHouseholdProfiles(): number {
  let count = 0;
  for (const adults of [1, 2, 3]) {
    for (const maritalStatus of [
      "single",
      "married",
      "separated",
      "divorced",
      "widowed",
      "domestic_partnership",
    ]) {
      for (const filing of ["calculate_best", "individual", "joint"]) {
        for (const dependants of [0, 1, 2, 3, 4, 5, 6]) {
          for (const singleParent of [false, true]) {
            if (
              singleParent &&
              (maritalStatus === "married" ||
                maritalStatus === "domestic_partnership" ||
                dependants === 0)
            ) {
              continue;
            }
            if (maritalStatus === "married" && adults < 2) continue;
            const jointEligible =
              (maritalStatus === "married" && adults === 2) ||
              (singleParent && dependants > 0);
            if (filing === "joint" && !jointEligible) continue;
            count += 1;
          }
        }
      }
    }
  }
  return count;
}

describe("auditable calculation-space manifest", () => {
  it("passes the canonical standalone validator", () => {
    const output = execFileSync(
      process.execPath,
      [path.join(projectRoot, "scripts/validate-coverage.mjs")],
      { cwd: projectRoot, encoding: "utf8" },
    );
    expect(output).toMatch(/Coverage manifest valid: 61\.980\.085\.440 states/);
  });

  it("derives the household profile count by enumerating eligibility gates", () => {
    expect(countValidHouseholdProfiles()).toBe(461);
    expect(manifest.dimensions.validatedHouseholdProfiles.count).toBe(461);
  });

  it("recomputes all 61.98 billion addressable states from published dimensions", () => {
    const dimensions = manifest.dimensions;
    const calculated =
      dimensions.territorialOutcomes.count *
      countValidHouseholdProfiles() *
      dimensions.incomeProfiles.count *
      dimensions.fiscalModifierProfiles.count *
      dimensions.scenarioBundles.count *
      dimensions.monthsWorkedValues.count;

    expect(calculated).toBe(61_980_085_440);
    expect(calculated).toBe(manifest.declaredStateCount);
    expect(calculated).toBeGreaterThanOrEqual(manifest.targetRange.minimum);
    expect(calculated).toBeLessThanOrEqual(manifest.targetRange.maximum);
    expect(manifest.formula).toBe("19 × 461 × 360 × 504 × 3 × 13");
  });

  it("makes every compound dimension internally auditable", () => {
    for (const dimension of Object.values(manifest.dimensions)) {
      expect(dimension.count).toBeGreaterThan(0);
      expect(dimension.description.length).toBeGreaterThan(20);
      if (dimension.factors) {
        expect(dimension.factors.reduce((product, factor) => product * factor, 1)).toBe(
          dimension.count,
        );
      }
    }
  });

  it("labels the count as states, never people, rows, or AI weights", () => {
    expect(manifest.interpretation).toMatch(/not a count of stored people/i);
    expect(manifest.interpretation).toMatch(/AI weights/i);
    expect(manifest.privacy).toMatch(/No state is precomputed from or linked to a real person/i);
  });
});
