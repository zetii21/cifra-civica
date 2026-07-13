import type { GeographyLevel } from "./types";
import { DEMO_GEOGRAPHY_VERSION } from "./demo-source";

export interface VectorLayerContract {
  readonly id: string;
  readonly geographyLevel: GeographyLevel;
  readonly minzoom: number;
  readonly maxzoom: number;
  readonly developmentMaxzoom: number;
  readonly properties: Readonly<Record<string, "String" | "Number" | "Boolean">>;
}

export const VECTOR_LAYER_CONTRACTS: readonly VectorLayerContract[] = [
  {
    id: "autonomous_communities",
    geographyLevel: "autonomous_community",
    minzoom: 0,
    maxzoom: 7,
    developmentMaxzoom: 5,
    properties: tileProperties(),
  },
  {
    id: "municipalities",
    geographyLevel: "municipality",
    minzoom: 4,
    maxzoom: 11,
    developmentMaxzoom: 8,
    properties: tileProperties(),
  },
  {
    id: "districts",
    geographyLevel: "district",
    minzoom: 9,
    maxzoom: 14,
    developmentMaxzoom: 11,
    properties: tileProperties(),
  },
  {
    id: "census_sections",
    geographyLevel: "census_section",
    minzoom: 12,
    maxzoom: 16,
    developmentMaxzoom: 13,
    properties: tileProperties(),
  },
] as const;

function tileProperties() {
  return {
    geography_code: "String" as const,
    official_code: "String" as const,
    name: "String" as const,
    level: "String" as const,
    data_mode: "String" as const,
    geometry_status: "String" as const,
    geography_version: "String" as const,
    territorial_support: "String" as const,
    demo: "Boolean" as const,
  };
}

export interface TileJsonContract {
  readonly tilejson: "3.0.0";
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly scheme: "xyz";
  readonly tiles: readonly string[];
  readonly minzoom: number;
  readonly maxzoom: number;
  readonly bounds: readonly [number, number, number, number];
  readonly center: readonly [number, number, number];
  readonly vector_layers: readonly VectorLayerContract[];
  readonly attribution: string;
  readonly data_mode: "demo_synthetic";
  readonly watermark: "DEMO";
  readonly pmtiles: {
    readonly supported: true;
    readonly deploymentArtifactPattern: string;
    readonly developmentArtifact: "xyz_mvt";
  };
}

export function createDemoTileJson(baseUrl = "http://localhost:3102"): TileJsonContract {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  return {
    tilejson: "3.0.0",
    name: "Cifra Cívica — geografía DEMO",
    description: "DEMO: geometrías rectangulares simplificadas para desarrollo. No usar como cartografía oficial.",
    version: DEMO_GEOGRAPHY_VERSION,
    scheme: "xyz",
    tiles: [`${normalizedBaseUrl}/tiles/${DEMO_GEOGRAPHY_VERSION}/{z}/{x}/{y}.mvt`],
    minzoom: 0,
    maxzoom: 13,
    bounds: [-18.2, 27.6, 4.4, 43.8],
    center: [-3.7, 40.2, 5],
    vector_layers: VECTOR_LAYER_CONTRACTS,
    attribution: "Códigos y nombres: INE. Geometría y métricas: DEMO sintética de Cifra Cívica.",
    data_mode: "demo_synthetic",
    watermark: "DEMO",
    pmtiles: {
      supported: true,
      deploymentArtifactPattern: `/tiles/${DEMO_GEOGRAPHY_VERSION}.pmtiles`,
      developmentArtifact: "xyz_mvt",
    },
  };
}
