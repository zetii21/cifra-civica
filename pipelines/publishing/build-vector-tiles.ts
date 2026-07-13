import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { DEMO_GEOGRAPHY_VERSION } from "../../packages/geography/demo-source";
import { createDemoTileJson, VECTOR_LAYER_CONTRACTS } from "../../packages/geography/tile-contract";
import type { BoundaryGeometry, GeographyRecord, Position, ProvenanceManifest } from "../../packages/geography/types";
import { assertValidProvenanceManifest } from "../../packages/geography/provenance";

const THIS_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPOSITORY_ROOT = resolve(THIS_DIRECTORY, "../..");
const EXTENT = 4096;
const MAX_LATITUDE = 85.05112878;

type TileKey = `${number}/${number}/${number}`;

interface TileBucket {
  readonly z: number;
  readonly x: number;
  readonly y: number;
  readonly layers: Map<string, GeographyRecord[]>;
}

function sha256(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function varint(value: number | bigint): number[] {
  let remaining = typeof value === "bigint" ? value : BigInt(Math.trunc(value));
  if (remaining < BigInt(0)) remaining = BigInt.asUintN(64, remaining);
  const bytes: number[] = [];
  do {
    let byte = Number(remaining & BigInt(0x7f));
    remaining >>= BigInt(7);
    if (remaining > BigInt(0)) byte |= 0x80;
    bytes.push(byte);
  } while (remaining > BigInt(0));
  return bytes;
}

function bytesField(fieldNumber: number, bytes: readonly number[] | Uint8Array): number[] {
  return [...varint((fieldNumber << 3) | 2), ...varint(bytes.length), ...bytes];
}

function varintField(fieldNumber: number, value: number | bigint): number[] {
  return [...varint(fieldNumber << 3), ...varint(value)];
}

function stringField(fieldNumber: number, value: string): number[] {
  return bytesField(fieldNumber, new TextEncoder().encode(value));
}

function zigZag(value: number): number {
  return ((value << 1) ^ (value >> 31)) >>> 0;
}

function stableFeatureId(code: string): number {
  let hash = 2166136261;
  for (let index = 0; index < code.length; index += 1) {
    hash ^= code.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function clampLatitude(latitude: number): number {
  return Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, latitude));
}

function worldCoordinate([longitude, latitude]: Position): Position {
  const clamped = clampLatitude(latitude);
  const sin = Math.sin((clamped * Math.PI) / 180);
  return [
    (longitude + 180) / 360,
    0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI),
  ];
}

function tileCoordinate(position: Position, z: number, x: number, y: number): [number, number] {
  const [worldX, worldY] = worldCoordinate(position);
  const scale = 2 ** z;
  return [Math.round((worldX * scale - x) * EXTENT), Math.round((worldY * scale - y) * EXTENT)];
}

function signedArea(ring: readonly [number, number][]): number {
  let area = 0;
  for (let index = 0; index < ring.length; index += 1) {
    const current = ring[index];
    const next = ring[(index + 1) % ring.length];
    area += current[0] * next[1] - next[0] * current[1];
  }
  return area / 2;
}

function geometryRings(geometry: BoundaryGeometry): readonly (readonly Position[])[] {
  if (geometry.type === "Polygon") return geometry.coordinates;
  return geometry.coordinates.flatMap((polygon) => polygon);
}

function encodePolygonGeometry(
  geometry: BoundaryGeometry,
  z: number,
  x: number,
  y: number,
): number[] {
  const commandStream: number[] = [];
  let cursorX = 0;
  let cursorY = 0;

  for (const [ringIndex, sourceRing] of geometryRings(geometry).entries()) {
    let ring = sourceRing
      .slice(0, sourceRing.length > 1 && sourceRing[0][0] === sourceRing[sourceRing.length - 1][0] && sourceRing[0][1] === sourceRing[sourceRing.length - 1][1] ? -1 : undefined)
      .map((position) => tileCoordinate(position, z, x, y))
      .filter((position, index, all) => index === 0 || position[0] !== all[index - 1][0] || position[1] !== all[index - 1][1]);
    if (ring.length < 3) continue;
    const shouldBePositive = ringIndex === 0;
    if ((signedArea(ring) > 0) !== shouldBePositive) ring = [...ring].reverse();

    commandStream.push((1 << 3) | 1); // MoveTo, one point.
    commandStream.push(zigZag(ring[0][0] - cursorX), zigZag(ring[0][1] - cursorY));
    cursorX = ring[0][0];
    cursorY = ring[0][1];
    commandStream.push(((ring.length - 1) << 3) | 2); // LineTo.
    for (let index = 1; index < ring.length; index += 1) {
      const [nextX, nextY] = ring[index];
      commandStream.push(zigZag(nextX - cursorX), zigZag(nextY - cursorY));
      cursorX = nextX;
      cursorY = nextY;
    }
    commandStream.push((1 << 3) | 7); // ClosePath.
  }
  return commandStream;
}

type TileProperty = string | number | boolean;

function propertiesFor(record: GeographyRecord): Readonly<Record<string, TileProperty>> {
  return {
    geography_code: record.code,
    official_code: record.officialCode,
    name: record.name,
    level: record.level,
    data_mode: record.dataMode,
    geometry_status: record.geometryStatus,
    geography_version: record.geographyVersion,
    territorial_support: record.territorialSupport,
    demo: record.dataMode === "demo_synthetic",
  };
}

function tileValueKey(value: TileProperty): string {
  return `${typeof value}:${String(value)}`;
}

function encodeValue(value: TileProperty): number[] {
  if (typeof value === "string") return stringField(1, value);
  if (typeof value === "boolean") return varintField(7, value ? 1 : 0);
  if (Number.isInteger(value)) return varintField(4, value);
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setFloat64(0, value, true);
  return [...varint((3 << 3) | 1), ...bytes];
}

function encodeLayer(
  layerName: string,
  records: readonly GeographyRecord[],
  z: number,
  x: number,
  y: number,
): number[] {
  const keys: string[] = [];
  const keyIndexes = new Map<string, number>();
  const values: TileProperty[] = [];
  const valueIndexes = new Map<string, number>();
  const features: number[][] = [];

  for (const record of records) {
    if (record.geometry === null) continue;
    const tags: number[] = [];
    for (const [key, value] of Object.entries(propertiesFor(record))) {
      let keyIndex = keyIndexes.get(key);
      if (keyIndex === undefined) {
        keyIndex = keys.length;
        keys.push(key);
        keyIndexes.set(key, keyIndex);
      }
      const valueKey = tileValueKey(value);
      let valueIndex = valueIndexes.get(valueKey);
      if (valueIndex === undefined) {
        valueIndex = values.length;
        values.push(value);
        valueIndexes.set(valueKey, valueIndex);
      }
      tags.push(keyIndex, valueIndex);
    }
    const geometry = encodePolygonGeometry(record.geometry, z, x, y);
    if (geometry.length === 0) continue;
    features.push([
      ...varintField(1, stableFeatureId(record.code)),
      ...bytesField(2, tags.flatMap(varint)),
      ...varintField(3, 3), // POLYGON
      ...bytesField(4, geometry.flatMap(varint)),
    ]);
  }

  return [
    ...stringField(1, layerName),
    ...features.flatMap((feature) => bytesField(2, feature)),
    ...keys.flatMap((key) => stringField(3, key)),
    ...values.flatMap((value) => bytesField(4, encodeValue(value))),
    ...varintField(5, EXTENT),
    ...varintField(15, 2),
  ];
}

function encodeTile(bucket: TileBucket): Uint8Array {
  const bytes = [...bucket.layers.entries()].flatMap(([layerName, records]) =>
    bytesField(3, encodeLayer(layerName, records, bucket.z, bucket.x, bucket.y))
  );
  return Uint8Array.from(bytes);
}

function tileRange(record: GeographyRecord, z: number): readonly [number, number, number, number] {
  const scale = 2 ** z;
  const [west, south, east, north] = record.bbox;
  const [worldWest, worldNorth] = worldCoordinate([west, north]);
  const [worldEast, worldSouth] = worldCoordinate([east, south]);
  const maximum = scale - 1;
  return [
    Math.max(0, Math.min(maximum, Math.floor(worldWest * scale))),
    Math.max(0, Math.min(maximum, Math.floor(worldNorth * scale))),
    Math.max(0, Math.min(maximum, Math.floor(worldEast * scale))),
    Math.max(0, Math.min(maximum, Math.floor(worldSouth * scale))),
  ];
}

function collectTileBuckets(records: readonly GeographyRecord[]): Map<TileKey, TileBucket> {
  const buckets = new Map<TileKey, TileBucket>();
  for (const contract of VECTOR_LAYER_CONTRACTS) {
    const layerRecords = records.filter((record) => record.level === contract.geographyLevel && record.geometry !== null);
    for (let z = contract.minzoom; z <= contract.developmentMaxzoom; z += 1) {
      for (const record of layerRecords) {
        const [minimumX, minimumY, maximumX, maximumY] = tileRange(record, z);
        for (let x = minimumX; x <= maximumX; x += 1) {
          for (let y = minimumY; y <= maximumY; y += 1) {
            const key = `${z}/${x}/${y}` as TileKey;
            let bucket = buckets.get(key);
            if (!bucket) {
              bucket = { z, x, y, layers: new Map() };
              buckets.set(key, bucket);
            }
            const current = bucket.layers.get(contract.id) ?? [];
            if (!current.some((candidate) => candidate.code === record.code)) {
              bucket.layers.set(contract.id, [...current, record]);
            }
          }
        }
      }
    }
  }
  return buckets;
}

export interface TileBuildResult {
  readonly geographyVersion: string;
  readonly tiles: number;
  readonly bytes: number;
  readonly manifestPath: string;
  readonly tileJsonPath: string;
}

export async function buildVectorTiles(repositoryRoot = DEFAULT_REPOSITORY_ROOT): Promise<TileBuildResult> {
  const sourcePath = join(repositoryRoot, "data/fixtures/geography/spain-demo-geographies.json");
  const sourceBytes = await readFile(sourcePath);
  const sourceDataset = JSON.parse(new TextDecoder().decode(sourceBytes)) as {
    records?: GeographyRecord[];
    geographyVersion?: string;
    dataMode?: string;
  };
  if (
    !Array.isArray(sourceDataset.records) ||
    sourceDataset.geographyVersion !== DEMO_GEOGRAPHY_VERSION ||
    sourceDataset.dataMode !== "demo_synthetic"
  ) {
    throw new Error("The DEMO geography fixture is missing or has an incompatible version/data mode");
  }
  const records = sourceDataset.records;
  const buckets = collectTileBuckets(records);
  const tileRoot = join(repositoryRoot, "data/generated/tiles", DEMO_GEOGRAPHY_VERSION);
  await rm(tileRoot, { recursive: true, force: true });
  await mkdir(tileRoot, { recursive: true });
  const files: Array<{
    path: string;
    bytes: number;
    sha256: string;
    layers: readonly string[];
    features: number;
  }> = [];

  for (const [key, bucket] of [...buckets.entries()].sort(([first], [second]) => first.localeCompare(second))) {
    const bytes = encodeTile(bucket);
    const path = join(tileRoot, `${key}.mvt`);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes);
    files.push({
      path: relative(tileRoot, path),
      bytes: bytes.length,
      sha256: sha256(bytes),
      layers: [...bucket.layers.keys()],
      features: [...bucket.layers.values()].reduce((sum, features) => sum + features.length, 0),
    });
  }

  const tileJsonPath = join(tileRoot, "tilejson.json");
  const tileJson = `${JSON.stringify(createDemoTileJson("http://localhost:3102"), null, 2)}\n`;
  await writeFile(tileJsonPath, tileJson, "utf8");
  const manifestPath = join(tileRoot, "manifest.json");
  const manifest = {
    schemaVersion: "1.0",
    geographyVersion: DEMO_GEOGRAPHY_VERSION,
    format: "MVT",
    scheme: "XYZ",
    extent: EXTENT,
    dataMode: "demo_synthetic",
    watermark: "DEMO",
    immutable: true,
    containsMetricValues: false,
    containsHouseholdRecords: false,
    source: "data/fixtures/geography/spain-demo-geographies.json",
    pmtilesArchitecture: {
      supported: true,
      developmentArtifact: "XYZ MVT directory",
      productionArtifact: `${DEMO_GEOGRAPHY_VERSION}.pmtiles`,
      note: "Use the same vector layer/property contract when packaging reviewed official boundaries as PMTiles.",
    },
    files,
  };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  const provenance: ProvenanceManifest = {
    schemaVersion: "1.0",
    datasetId: "cifra-civica-demo-vector-tiles-2027-v1",
    dataMode: "demo_synthetic",
    sourceName: "Cifra Cívica synthetic geography fixture",
    publisher: "Cifra Cívica",
    sourceReference: "data/fixtures/geography/spain-demo-geographies.json",
    accessDate: "2026-07-13",
    publicationDate: "2026-07-13",
    dataPeriod: "DEMO 2027",
    geographicCoverage: "Spain development sample",
    licenceOrReuseConditions: "CC0 synthetic development artifact; not official cartography.",
    checksum: sha256(sourceBytes),
    checksumAlgorithm: "sha256",
    originalFilename: "spain-demo-geographies.json",
    transformVersion: "mvt-development-builder/1.0.0",
    transformationSteps: [
      "Select features by immutable vector-layer contract and development zoom range.",
      "Project WGS84 coordinates to Web Mercator tile coordinates.",
      "Encode polygon commands and public metadata properties as Mapbox Vector Tiles.",
      "Write content checksums, TileJSON and PMTiles-compatible deployment contract.",
    ],
    qualityWarnings: [
      "DEMO — generated tiles contain synthetic simplified rectangles, not official boundaries.",
      "Development MVT polygons are not clipped or topology-optimised; production official tiles require reviewed GDAL/tippecanoe processing.",
    ],
    outputTables: ["vector_tile_manifest", "vector_tile_xyz_files"],
    responsibleMaintainer: "geospatial@cifra-civica.invalid",
    pipelineStage: "published",
    containsRestrictedMicrodata: false,
    containsAdministrativeTaxpayerMicrodata: false,
    outputChecksums: {
      [`data/generated/tiles/${DEMO_GEOGRAPHY_VERSION}/manifest.json`]: sha256(`${JSON.stringify(manifest, null, 2)}\n`),
      [`data/generated/tiles/${DEMO_GEOGRAPHY_VERSION}/tilejson.json`]: sha256(tileJson),
    },
  };
  assertValidProvenanceManifest(provenance);
  const provenancePath = join(repositoryRoot, "data/provenance/spain-demo-vector-tiles.provenance.json");
  await writeFile(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`, "utf8");

  return {
    geographyVersion: DEMO_GEOGRAPHY_VERSION,
    tiles: files.length,
    bytes: files.reduce((sum, file) => sum + file.bytes, 0),
    manifestPath: relative(repositoryRoot, manifestPath),
    tileJsonPath: relative(repositoryRoot, tileJsonPath),
  };
}

const isDirectRun = process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isDirectRun) {
  const result = await buildVectorTiles();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
