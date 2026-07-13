import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import { generateDemoData } from "../generate-demo";

test("DEMO pipeline is reproducible and writes provenance manifests", async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "cifra-civica-geography-"));
  try {
    const sourceDirectory = join(temporaryRoot, "packages/geography");
    await mkdir(sourceDirectory, { recursive: true });
    await copyFile(
      resolve("packages/geography/demo-source.ts"),
      join(sourceDirectory, "demo-source.ts"),
    );
    const first = await generateDemoData(temporaryRoot);
    const firstAggregate = await readFile(
      join(temporaryRoot, "data/fixtures/aggregates/spain-demo-metrics.json"),
      "utf8",
    );
    const second = await generateDemoData(temporaryRoot);
    const secondAggregate = await readFile(
      join(temporaryRoot, "data/fixtures/aggregates/spain-demo-metrics.json"),
      "utf8",
    );
    assert.deepEqual(second, first);
    assert.equal(secondAggregate, firstAggregate);
    const manifest = JSON.parse(await readFile(
      join(temporaryRoot, "data/provenance/spain-demo-aggregates.provenance.json"),
      "utf8",
    ));
    assert.equal(manifest.dataMode, "demo_synthetic");
    assert.equal(manifest.containsRestrictedMicrodata, false);
    assert.match(manifest.checksum, /^[a-f0-9]{64}$/);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});
