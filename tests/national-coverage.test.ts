import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(import.meta.dirname, "..");
const manifest = JSON.parse(
  readFileSync(path.join(projectRoot, "model-manifest/national-coverage.json"), "utf8"),
) as {
  metric: string;
  declaredEvaluatedCount: number;
  variantEvaluations: number;
  microUnits: number;
  targetRange: { minimum: number; maximum: number };
  interpretation: string;
  privacy: string;
};
const report = JSON.parse(
  readFileSync(
    path.join(projectRoot, "model-lab/artifacts/national-study-report.json"),
    "utf8",
  ),
) as {
  coverage: { parameterCaseApplications: number; variantEvaluations: number };
  engineEquivalence: { passed: boolean };
  invariants: { passed: boolean };
};

describe("national laboratory coverage manifest", () => {
  it("passes the canonical standalone validator", () => {
    const output = execFileSync(
      process.execPath,
      [path.join(projectRoot, "scripts/validate-national-study.mjs")],
      { cwd: projectRoot, encoding: "utf8" },
    );
    expect(output).toMatch(/National study valid/);
  });

  it("mirrors the executed counts of the committed study report", () => {
    expect(manifest.metric).toBe("executed_parameter_case_applications");
    expect(manifest.declaredEvaluatedCount).toBe(report.coverage.parameterCaseApplications);
    expect(manifest.variantEvaluations).toBe(report.coverage.variantEvaluations);
    expect(manifest.declaredEvaluatedCount).toBeGreaterThanOrEqual(200_000_000_000);
    expect(manifest.declaredEvaluatedCount).toBeGreaterThanOrEqual(
      manifest.targetRange.minimum,
    );
    expect(manifest.declaredEvaluatedCount).toBeLessThanOrEqual(
      manifest.targetRange.maximum,
    );
    expect(Number.isSafeInteger(manifest.declaredEvaluatedCount)).toBe(true);
  });

  it("labels the count as executed work, never people or AI weights", () => {
    expect(manifest.interpretation).toMatch(/not a count of stored people/i);
    expect(manifest.interpretation).toMatch(/AI weights/i);
    expect(manifest.privacy).toMatch(/No unit corresponds to a real person/i);
    expect(report.engineEquivalence.passed).toBe(true);
    expect(report.invariants.passed).toBe(true);
  });
});
