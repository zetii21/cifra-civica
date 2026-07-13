/**
 * Builds the pre-projected SVG geometry asset for the interactive map of the
 * autonomous communities. Input is the committed Eurostat GISCO NUTS-2 (2024,
 * 1:10M) extraction for Spain; output is a deterministic JSON asset with one
 * SVG path per community, label anchors and a Canary Islands inset frame.
 *
 * The output is committed so that the web application never parses raw
 * GeoJSON at runtime and so CI can verify the artefact is reproducible:
 *   node --import tsx pipelines/geography/build-ccaa-svg.ts
 */
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const INPUT = resolve(ROOT, "data/fixtures/geography/nuts2-es-2024.geojson");
const OUTPUT = resolve(ROOT, "data/fixtures/geography/spain-ccaa-svg.json");
const PROVENANCE = resolve(ROOT, "data/provenance/spain-ccaa-svg.provenance.json");

/** INE community code per NUTS-2 identifier, aligned with lib/domain.ts. */
const NUTS_TO_INE: Record<string, string> = {
  ES61: "01",
  ES24: "02",
  ES12: "03",
  ES53: "04",
  ES70: "05",
  ES13: "06",
  ES41: "07",
  ES42: "08",
  ES51: "09",
  ES52: "10",
  ES43: "11",
  ES11: "12",
  ES30: "13",
  ES62: "14",
  ES22: "15",
  ES21: "16",
  ES23: "17",
  ES63: "18",
  ES64: "19",
};

type Ring = Array<[number, number]>;

interface Feature {
  properties: { NUTS_ID: string; NAME_LATN: string };
  geometry: { type: "MultiPolygon" | "Polygon"; coordinates: number[][][] | number[][][][] };
}

interface GeoJson {
  metadata: Record<string, string>;
  features: Feature[];
}

const WIDTH = 960;
const HEIGHT = 780;
const MARGIN = 14;
const LAT0 = 40; // standard parallel for the equirectangular fit
const KX = Math.cos((LAT0 * Math.PI) / 180);

function polygonsOf(feature: Feature): Ring[][] {
  if (feature.geometry.type === "Polygon") {
    return [feature.geometry.coordinates as unknown as Ring[]];
  }
  return feature.geometry.coordinates as unknown as Ring[][];
}

function ringArea(ring: Ring): number {
  let area = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    area += ring[index][0] * ring[index + 1][1] - ring[index + 1][0] * ring[index][1];
  }
  return area / 2;
}

function ringCentroid(ring: Ring): [number, number] {
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    const cross = ring[index][0] * ring[index + 1][1] - ring[index + 1][0] * ring[index][1];
    area += cross;
    cx += (ring[index][0] + ring[index + 1][0]) * cross;
    cy += (ring[index][1] + ring[index + 1][1]) * cross;
  }
  area /= 2;
  if (Math.abs(area) < 1e-12) return ring[0];
  return [cx / (6 * area), cy / (6 * area)];
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

interface Projector {
  x(lon: number): number;
  y(lat: number): number;
}

function fitProjector(
  lonMin: number,
  lonMax: number,
  latMin: number,
  latMax: number,
  frame: { x: number; y: number; width: number; height: number },
): Projector {
  const spanX = (lonMax - lonMin) * KX;
  const spanY = latMax - latMin;
  const scale = Math.min(frame.width / spanX, frame.height / spanY);
  const offsetX = frame.x + (frame.width - spanX * scale) / 2;
  const offsetY = frame.y + (frame.height - spanY * scale) / 2;
  return {
    x: (lon) => offsetX + (lon - lonMin) * KX * scale,
    y: (lat) => offsetY + (latMax - lat) * scale,
  };
}

function pathFor(polygons: Ring[][], projector: Projector): string {
  const segments: string[] = [];
  for (const polygon of polygons) {
    for (const ring of polygon) {
      const points: string[] = [];
      let lastX = Number.NaN;
      let lastY = Number.NaN;
      for (const [lon, lat] of ring) {
        const x = round1(projector.x(lon));
        const y = round1(projector.y(lat));
        if (x === lastX && y === lastY) continue;
        points.push(`${x} ${y}`);
        lastX = x;
        lastY = y;
      }
      if (points.length < 3) continue;
      segments.push(`M${points.join("L")}Z`);
    }
  }
  return segments.join("");
}

function labelAnchor(polygons: Ring[][], projector: Projector): [number, number] {
  let best: Ring | undefined;
  let bestArea = -1;
  for (const polygon of polygons) {
    const outer = polygon[0];
    const area = Math.abs(ringArea(outer));
    if (area > bestArea) {
      bestArea = area;
      best = outer;
    }
  }
  if (!best) return [0, 0];
  const [lon, lat] = ringCentroid(best);
  return [round1(projector.x(lon)), round1(projector.y(lat))];
}

function boundsOf(features: Feature[]): [number, number, number, number] {
  let lonMin = Infinity;
  let lonMax = -Infinity;
  let latMin = Infinity;
  let latMax = -Infinity;
  for (const feature of features) {
    for (const polygon of polygonsOf(feature)) {
      for (const ring of polygon) {
        for (const [lon, lat] of ring) {
          lonMin = Math.min(lonMin, lon);
          lonMax = Math.max(lonMax, lon);
          latMin = Math.min(latMin, lat);
          latMax = Math.max(latMax, lat);
        }
      }
    }
  }
  return [lonMin, lonMax, latMin, latMax];
}

async function main(): Promise<void> {
  const rawBytes = await readFile(INPUT);
  const raw = JSON.parse(rawBytes.toString("utf8")) as GeoJson;
  const byNuts = new Map(raw.features.map((feature) => [feature.properties.NUTS_ID, feature]));
  const missing = Object.keys(NUTS_TO_INE).filter((nutsId) => !byNuts.has(nutsId));
  if (missing.length > 0) {
    throw new Error(`NUTS-2 extraction is missing regions: ${missing.join(", ")}`);
  }

  const canarias = [byNuts.get("ES70")!];
  const mainland = raw.features.filter((feature) => feature.properties.NUTS_ID !== "ES70");

  const [lonMin, lonMax, latMin, latMax] = boundsOf(mainland);
  const mainFrame = {
    x: MARGIN,
    y: MARGIN,
    width: WIDTH - 2 * MARGIN,
    height: HEIGHT - 2 * MARGIN,
  };
  const mainProjector = fitProjector(lonMin, lonMax, latMin, latMax, mainFrame);

  // Canary Islands inset in the free Atlantic corner south-west of the
  // peninsula, following common Spanish cartographic convention.
  const inset = { x: 24, y: HEIGHT - 208, width: 300, height: 168 };
  const [cLonMin, cLonMax, cLatMin, cLatMax] = boundsOf(canarias);
  const insetPadding = 16;
  const insetProjector = fitProjector(cLonMin, cLonMax, cLatMin, cLatMax, {
    x: inset.x + insetPadding,
    y: inset.y + insetPadding,
    width: inset.width - 2 * insetPadding,
    height: inset.height - 2 * insetPadding,
  });

  const communities = raw.features
    .map((feature) => {
      const nutsId = feature.properties.NUTS_ID;
      const code = NUTS_TO_INE[nutsId];
      if (!code) throw new Error(`Unexpected NUTS-2 region ${nutsId}`);
      const isCanarias = nutsId === "ES70";
      const projector = isCanarias ? insetProjector : mainProjector;
      const polygons = polygonsOf(feature);
      const [labelX, labelY] = labelAnchor(polygons, projector);
      return {
        code,
        nutsId,
        name: feature.properties.NAME_LATN,
        inset: isCanarias,
        path: pathFor(polygons, projector),
        labelX,
        labelY,
      };
    })
    .sort((left, right) => left.code.localeCompare(right.code));

  for (const community of communities) {
    if (community.path.length < 20) {
      throw new Error(`Suspiciously small path for ${community.name}`);
    }
  }

  const asset = {
    version: "spain-ccaa-svg-2024.1",
    generator: "pipelines/geography/build-ccaa-svg.ts",
    source: {
      dataset: "Eurostat GISCO NUTS 2024, level 2, 1:10M generalised boundaries",
      url: "https://gisco-services.ec.europa.eu/distribution/v2/nuts/geojson/NUTS_RG_10M_2024_4326_LEVL_2.geojson",
      attribution: "© EuroGeographics for the administrative boundaries",
      inputSha256: createHash("sha256").update(rawBytes).digest("hex"),
      note: "Generalised statistical boundaries for visualisation; not a legal delimitation.",
    },
    projection: {
      kind: "equirectangular",
      standardParallelDeg: LAT0,
      mainlandBounds: [lonMin, latMin, lonMax, latMax],
      canariasBounds: [cLonMin, cLatMin, cLonMax, cLatMax],
    },
    width: WIDTH,
    height: HEIGHT,
    canariasInset: inset,
    communities,
  };

  const serialised = `${JSON.stringify(asset, null, 1)}\n`;
  await writeFile(OUTPUT, serialised, "utf8");

  const provenance = {
    schemaVersion: "1.0",
    datasetId: "cifra-civica-ccaa-svg-2024-v1",
    dataMode: "official_generalised",
    sourceName: "Eurostat GISCO NUTS 2024 statistical boundaries (level 2)",
    publisher: "Eurostat / EuroGeographics",
    sourceReference:
      "https://ec.europa.eu/eurostat/web/gisco/geodata/statistical-units/territorial-units-statistics",
    accessDate: "2026-07-13",
    publicationDate: "2024",
    dataPeriod: "NUTS 2024 classification",
    geographicCoverage: "Spain: 17 autonomous communities and 2 autonomous cities (NUTS-2)",
    licenceOrReuseConditions:
      "Free reuse with mandatory attribution: © EuroGeographics for the administrative boundaries. Generalised for statistical mapping; not for legal use.",
    checksum: createHash("sha256").update(serialised, "utf8").digest("hex"),
    checksumAlgorithm: "sha256",
    originalFilename: "data/fixtures/geography/nuts2-es-2024.geojson",
    inputChecksum: createHash("sha256").update(rawBytes).digest("hex"),
    transformVersion: "geography-ccaa-svg-builder/1.0.0",
    transformationSteps: [
      "Extract the 19 Spanish NUTS-2 features from the GISCO 1:10M GeoJSON distribution.",
      "Project with an equirectangular fit (standard parallel 40°N) into a 960×780 frame.",
      "Relocate the Canary Islands into a framed cartographic inset in the Atlantic corner.",
      "Emit one SVG path, label anchor and metadata entry per community, sorted by INE code.",
    ],
    qualityWarnings: [
      "Boundaries are generalised (1:10M) for fast statistical visualisation only.",
      "Ceuta and Melilla are drawn near-invisible at this scale; the UI adds tappable markers.",
    ],
    outputTables: ["spain_ccaa_svg"],
  };
  await writeFile(PROVENANCE, `${JSON.stringify(provenance, null, 2)}\n`, "utf8");

  const totalBytes = Buffer.byteLength(serialised, "utf8");
  process.stdout.write(
    `CCAA SVG asset written: ${communities.length} communities, ${totalBytes} bytes\n`,
  );
}

await main();
