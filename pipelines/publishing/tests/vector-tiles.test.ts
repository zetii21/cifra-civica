import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";

import { generateDemoData } from "../../geography/generate-demo";
import { buildVectorTiles } from "../build-vector-tiles";

test("tile pipeline creates real MVT protobuf files, TileJSON and checksums", async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "cifra-civica-tiles-"));
  try {
    const sourcePath = join(temporaryRoot, "packages/geography/demo-source.ts");
    await mkdir(dirname(sourcePath), { recursive: true });
    await copyFile(resolve("packages/geography/demo-source.ts"), sourcePath);
    await generateDemoData(temporaryRoot);
    const result = await buildVectorTiles(temporaryRoot);
    assert.ok(result.tiles > 10);
    assert.ok(result.bytes > 1000);
    const firstTile = join(temporaryRoot, "data/generated/tiles/demo-es-2027.1/0/0/0.mvt");
    const tile = await readFile(firstTile);
    assert.ok((await stat(firstTile)).size > 0);
    assert.equal(tile[0], 0x1a); // protobuf Tile.layers field (field 3, length-delimited)
    const tileJson = JSON.parse(await readFile(
      join(temporaryRoot, "data/generated/tiles/demo-es-2027.1/tilejson.json"),
      "utf8",
    ));
    assert.equal(tileJson.tilejson, "3.0.0");
    assert.equal(tileJson.watermark, "DEMO");
    assert.ok(tileJson.vector_layers.some((layer: { id: string }) => layer.id === "municipalities"));
    const manifest = JSON.parse(await readFile(
      join(temporaryRoot, "data/generated/tiles/demo-es-2027.1/manifest.json"),
      "utf8",
    ));
    assert.ok(manifest.files.every((file: { sha256: string }) => /^[a-f0-9]{64}$/.test(file.sha256)));
    assert.equal(manifest.pmtilesArchitecture.supported, true);
    assert.equal(manifest.containsHouseholdRecords, false);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});
