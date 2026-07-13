import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const reportUrl = new URL("../model-lab/artifacts/study-report.json", import.meta.url);
const artifactUrl = new URL("../model-lab/artifacts/diagnostic-surrogate.joblib", import.meta.url);
const requirementsUrl = new URL("../model-lab/requirements.txt", import.meta.url);
const report = JSON.parse(await readFile(reportUrl, "utf8"));
const artifact = await readFile(artifactUrl);
const requirementsText = await readFile(requirementsUrl, "utf8");
const digest = createHash("sha256").update(artifact).digest("hex");

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
const environmentFields = {
  numpy: "numpy",
  scipy: "scipy",
  "scikit-learn": "scikitLearn",
  joblib: "joblib",
};

assert.deepEqual(
  Object.keys(requirementPins).sort(),
  Object.keys(environmentFields).sort(),
  "model-lab requirements and recorded environment fields must change together",
);
for (const [packageName, reportField] of Object.entries(environmentFields)) {
  assert.equal(
    report.environment[reportField],
    requirementPins[packageName],
    `${packageName} report version must match its exact requirement pin`,
  );
}

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
  "study inputs changed without regenerating the signed report",
);

assert.equal(report.status, "reference");
assert.ok(report.coverage.syntheticHouseholdsEvaluated >= 2_000_000);
assert.ok(report.coverage.exactScenarioEvaluations >= 6_000_000);
assert.equal(report.coverage.featureCount, report.coverage.features.length);
assert.equal(report.baselineDisposableIncomeSensitivity.length, report.coverage.featureCount);
assert.equal(report.exactSweep.invariantsPassed, true);
assert.equal(report.exactSweep.familyReliefNonnegativeViolations, 0);
assert.equal(report.exactSweep.childTransferExactViolations, 0);
assert.equal(report.selectedDiagnosticModel.authoritativeForPublicResults, false);
assert.equal(report.selectedDiagnosticModel.artifactSha256, digest);
assert.equal(report.selectedDiagnosticModel.artifactBytes, artifact.byteLength);

function assertFinite(value) {
  if (typeof value === "number") assert.ok(Number.isFinite(value));
  else if (Array.isArray(value)) value.forEach(assertFinite);
  else if (value && typeof value === "object") Object.values(value).forEach(assertFinite);
}

assertFinite(report);
console.log(
  `Statistical study valid: ${report.coverage.exactScenarioEvaluations.toLocaleString("es-ES")} exact evaluations, ${report.coverage.featureCount} features`,
);
