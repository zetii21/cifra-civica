import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const reportUrl = new URL("../model-lab/artifacts/national-study-report.json", import.meta.url);
const manifestUrl = new URL("../model-manifest/national-coverage.json", import.meta.url);
const requirementsUrl = new URL("../model-lab/requirements.txt", import.meta.url);

const report = JSON.parse(await readFile(reportUrl, "utf8"));
const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
const requirementsText = await readFile(requirementsUrl, "utf8");

// The recorded environment must match the exact requirement pins.
const requirementPins = Object.fromEntries(
  requirementsText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const match = /^([A-Za-z0-9_.-]+)==([^\s;]+)$/.exec(line);
      assert.ok(match, `model-lab requirement must use an exact pin: ${line}`);
      return [match[1].toLowerCase(), match[2]];
    }),
);
for (const [packageName, reportField] of Object.entries({
  numpy: "numpy",
  scipy: "scipy",
  "scikit-learn": "scikitLearn",
  joblib: "joblib",
})) {
  assert.equal(
    report.environment[reportField],
    requirementPins[packageName],
    `${packageName} version recorded by the study must match its requirement pin`,
  );
}

// Inputs must not have drifted since the committed report was generated.
assert.ok(Array.isArray(report.inputFiles) && report.inputFiles.length > 0);
assert.deepEqual(
  report.inputFiles,
  [...new Set(report.inputFiles)].sort(),
  "study input file list must be sorted and unique",
);
const inputDigest = createHash("sha256");
for (const relativePath of report.inputFiles) {
  assert.equal(typeof relativePath, "string");
  assert.ok(
    relativePath.length > 0 &&
      !relativePath.startsWith("/") &&
      !relativePath.split("/").includes(".."),
    `unsafe study input path: ${relativePath}`,
  );
  const contents = await readFile(new URL(`../${relativePath}`, import.meta.url));
  inputDigest.update(relativePath, "utf8");
  inputDigest.update("\0", "utf8");
  inputDigest.update(contents);
  inputDigest.update("\0", "utf8");
}
assert.equal(
  report.inputDigestSha256,
  inputDigest.digest("hex"),
  "laboratory model inputs changed without regenerating the national study report",
);

// Study gates.
assert.equal(report.status, "reference");
assert.equal(report.engineEquivalence.passed, true);
assert.ok(
  report.engineEquivalence.maxRelativeGap < 0.005,
  "TypeScript and NumPy engines must agree within 0,5 % on golden scenarios",
);
assert.equal(report.invariants.passed, true);
assert.equal(report.invariants.monotonicity.violations, 0);
assert.ok(report.invariants.additivity.pairsChecked >= 40);
assert.ok(
  report.invariants.crossTerritoryAdditivity.pairsChecked >= 100,
  "cross-territory additivity must cover the community pairs",
);
assert.ok(
  report.invariants.crossTerritoryAdditivity.maxGapMEur < 1e-6,
  "changes in two communities must compose exactly (disjoint unit sets)",
);
assert.ok(
  report.invariants.quantileConvergence.worstRelativeGap < 0.15,
  "quantile-grid discretisation must stay within the declared tolerance",
);
assert.ok(report.quantileConvergence.resolutions.length >= 4);
assert.ok(report.lafferPeaks.length >= 20);
assert.ok(report.responseSurfaces.elasticitySensitivity.surfaces.length >= 20);
assert.ok(report.deficitFrontier.feasibleCombos > 0);
assert.ok(report.deficitFrontier.leastRegressive.length > 0);
assert.ok(report.engineEquivalence.comparisons >= 60);
assert.ok(report.coverage.microUnits >= 400_000);
assert.ok(
  report.coverage.parameterCaseApplications >= 200_000_000_000,
  "the reference study must execute at least 200.000 millones of parameter-case applications",
);
assert.ok(Number.isSafeInteger(report.coverage.parameterCaseApplications));
assert.match(report.coverage.countingRule, /No son pesos de IA ni personas/);

// Manifest must mirror the executed counts exactly.
assert.equal(manifest.metric, "executed_parameter_case_applications");
assert.equal(
  manifest.declaredEvaluatedCount,
  report.coverage.parameterCaseApplications,
  "national coverage manifest must equal the study's executed count",
);
assert.equal(manifest.variantEvaluations, report.coverage.variantEvaluations);
assert.equal(manifest.microUnits, report.coverage.microUnits);
assert.ok(
  manifest.declaredEvaluatedCount >= manifest.targetRange.minimum &&
    manifest.declaredEvaluatedCount <= manifest.targetRange.maximum,
  "evaluated count must sit inside the declared target range",
);
assert.match(manifest.interpretation, /not a count of stored people/i);
assert.match(manifest.interpretation, /AI weights/i);
assert.match(manifest.privacy, /No unit corresponds to a real person/i);

function assertFinite(value) {
  if (typeof value === "number") assert.ok(Number.isFinite(value));
  else if (Array.isArray(value)) value.forEach(assertFinite);
  else if (value && typeof value === "object") Object.values(value).forEach(assertFinite);
}
assertFinite(report);

console.log(
  `National study valid: ${report.coverage.parameterCaseApplications.toLocaleString("es-ES")} parameter-case applications, ` +
    `${report.coverage.variantEvaluations.toLocaleString("es-ES")} variant evaluations, ` +
    `engine gap ${(report.engineEquivalence.maxRelativeGap * 100).toFixed(3)} %`,
);
