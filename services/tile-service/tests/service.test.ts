import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";

import { createTileServiceHandler } from "../src/handler";

async function withService(run: (origin: string) => Promise<void>): Promise<void> {
  const handler = createTileServiceHandler({ repositoryRoot: process.cwd() });
  const server = createServer((request, response) => {
    void handler(request, response);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("Unexpected server address");
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("health and TileJSON expose versions and DEMO mode", async () => {
  await withService(async (origin) => {
    const health = await fetch(`${origin}/healthz`);
    assert.equal(health.status, 200);
    const healthBody = (await health.json()) as { geographyVersion: string };
    assert.equal(healthBody.geographyVersion, "demo-es-2027.1");
    assert.equal(health.headers.get("cache-control"), "no-store");
    const tileJson = await fetch(`${origin}/tiles/demo-es-2027.1/tilejson.json`);
    const body = (await tileJson.json()) as { watermark: string; tiles: string[] };
    assert.equal(body.watermark, "DEMO");
    assert.match(body.tiles[0], new RegExp(`^${origin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  });
});

test("service returns immutable MVT and supports conditional requests", async () => {
  await withService(async (origin) => {
    const response = await fetch(`${origin}/tiles/demo-es-2027.1/0/0/0.mvt`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "application/vnd.mapbox-vector-tile");
    assert.match(response.headers.get("cache-control") ?? "", /immutable/);
    const tag = response.headers.get("etag");
    assert.ok(tag);
    assert.ok((await response.arrayBuffer()).byteLength > 0);
    const conditional = await fetch(`${origin}/tiles/demo-es-2027.1/0/0/0.mvt`, {
      headers: { "If-None-Match": tag! },
    });
    assert.equal(conditional.status, 304);
  });
});

test("search and metric APIs return public aggregate contracts only", async () => {
  await withService(async (origin) => {
    const search = await fetch(`${origin}/api/v1/geographies/search?q=28001`);
    const searchBody = (await search.json()) as { results: Array<{ name: string; dataMode: string }> };
    assert.equal(searchBody.results[0].name, "Madrid");
    assert.equal(searchBody.results[0].dataMode, "demo_synthetic");
    const metrics = await fetch(`${origin}/api/v1/map/metrics?metricId=demo_mean_fiscal_change_eur`);
    const metricBody = (await metrics.json()) as {
      definition: { watermark: string };
      containsHouseholdRecords: boolean;
    };
    assert.equal(metricBody.definition.watermark, "DEMO");
    assert.equal(metricBody.containsHouseholdRecords, false);
    assert.equal(JSON.stringify(metricBody).includes("baselineDisposableIncome"), false);
    const official = await fetch(`${origin}/api/v1/map/metrics?metricId=official_median_net_income_eur`);
    const officialBody = (await official.json()) as {
      definition: { valuesAvailable: boolean };
      values: unknown[];
    };
    assert.equal(officialBody.definition.valuesAvailable, false);
    assert.deepEqual(officialBody.values, []);
  });
});
