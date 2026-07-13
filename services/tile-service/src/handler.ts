import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join, resolve } from "node:path";

import {
  DEMO_GEOGRAPHY_VERSION,
  demoGeographyCatalog,
  demoMetricCatalog,
} from "../../../packages/geography/index";
import { searchPlaces } from "../../../packages/geography/search";
import { createDemoTileJson } from "../../../packages/geography/tile-contract";

export interface TileServiceOptions {
  readonly repositoryRoot?: string;
  readonly tileArtifactRoot?: string;
  readonly corsOrigin?: string;
  readonly serviceVersion?: string;
}

function sendJson(
  response: ServerResponse,
  status: number,
  body: unknown,
  headers: Readonly<Record<string, string>> = {},
): void {
  const bytes = Buffer.from(`${JSON.stringify(body)}\n`, "utf8");
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": String(bytes.length),
    "X-Content-Type-Options": "nosniff",
    ...headers,
  });
  response.end(bytes);
}

function publicHeaders(corsOrigin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": corsOrigin,
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "If-None-Match, Content-Type",
    "Cross-Origin-Resource-Policy": "cross-origin",
  };
}

function requestOrigin(request: IncomingMessage): string {
  const forwardedProtocol = request.headers["x-forwarded-proto"];
  const protocol = typeof forwardedProtocol === "string" ? forwardedProtocol.split(",")[0] : "http";
  const forwardedHost = request.headers["x-forwarded-host"];
  const host = typeof forwardedHost === "string" ? forwardedHost.split(",")[0] : request.headers.host ?? "localhost:3102";
  return `${protocol}://${host}`;
}

function etag(bytes: Uint8Array): string {
  return `"${createHash("sha256").update(bytes).digest("hex")}"`;
}

function apiError(response: ServerResponse, status: number, code: string, message: string, headers: Record<string, string>) {
  sendJson(response, status, { error: { code, message } }, headers);
}

export function createTileServiceHandler(options: TileServiceOptions = {}) {
  const repositoryRoot = options.repositoryRoot ?? resolve(process.cwd());
  const tileArtifactRoot = options.tileArtifactRoot ?? join(repositoryRoot, "data/generated/tiles");
  const tileRoot = join(tileArtifactRoot, DEMO_GEOGRAPHY_VERSION);
  const corsOrigin = options.corsOrigin ?? "*";
  const serviceVersion = options.serviceVersion ?? "tile-service/1.0.0";
  const headers = publicHeaders(corsOrigin);

  return async function tileServiceHandler(request: IncomingMessage, response: ServerResponse): Promise<void> {
    if (!request.url) {
      apiError(response, 400, "invalid_request", "Solicitud no válida.", headers);
      return;
    }
    if (request.method === "OPTIONS") {
      response.writeHead(204, { ...headers, "Content-Length": "0" });
      response.end();
      return;
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      apiError(response, 405, "method_not_allowed", "Este recurso solo admite lectura.", {
        ...headers,
        Allow: "GET, HEAD, OPTIONS",
      });
      return;
    }

    const url = new URL(request.url, requestOrigin(request));
    if (url.pathname === "/healthz" || url.pathname === "/api/v1/health") {
      let tileArtifactReady = false;
      try {
        tileArtifactReady = (await stat(join(tileRoot, "manifest.json"))).isFile();
      } catch {
        tileArtifactReady = false;
      }
      sendJson(response, tileArtifactReady ? 200 : 503, {
        status: tileArtifactReady ? "ok" : "degraded",
        service: "tile-service",
        serviceVersion,
        geographyVersion: DEMO_GEOGRAPHY_VERSION,
        dataMode: "demo_synthetic",
        watermark: "DEMO",
        tileArtifact: tileArtifactReady ? "ready" : "missing",
      }, { ...headers, "Cache-Control": "no-store" });
      return;
    }

    if (url.pathname === `/tiles/${DEMO_GEOGRAPHY_VERSION}/tilejson.json`) {
      sendJson(response, 200, createDemoTileJson(requestOrigin(request)), {
        ...headers,
        "Cache-Control": "public, max-age=300",
      });
      return;
    }

    const tileMatch = url.pathname.match(
      new RegExp(`^/tiles/${DEMO_GEOGRAPHY_VERSION.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/(\\d{1,2})/(\\d{1,8})/(\\d{1,8})\\.mvt$`),
    );
    if (tileMatch) {
      const [, z, x, y] = tileMatch;
      const path = join(tileRoot, z, x, `${y}.mvt`);
      try {
        const details = await stat(path);
        if (!details.isFile()) throw new Error("not a file");
        const bytes = await readFile(path);
        const contentTag = etag(bytes);
        if (request.headers["if-none-match"] === contentTag) {
          response.writeHead(304, {
            ...headers,
            ETag: contentTag,
            "Cache-Control": "public, max-age=31536000, immutable",
          });
          response.end();
          return;
        }
        response.writeHead(200, {
          ...headers,
          "Content-Type": "application/vnd.mapbox-vector-tile",
          "Content-Length": String(bytes.length),
          "Cache-Control": "public, max-age=31536000, immutable",
          ETag: contentTag,
        });
        response.end(request.method === "HEAD" ? undefined : bytes);
      } catch {
        response.writeHead(204, {
          ...headers,
          "Cache-Control": "public, max-age=3600",
          "Content-Length": "0",
        });
        response.end();
      }
      return;
    }

    if (url.pathname === "/api/v1/geographies/search") {
      const query = url.searchParams.get("q") ?? "";
      const includeFine = url.searchParams.get("includeFine") === "true";
      const rawLimit = Number(url.searchParams.get("limit") ?? "8");
      const limit = Number.isFinite(rawLimit) ? rawLimit : 8;
      const results = searchPlaces(demoGeographyCatalog, query, {
        limit,
        includeFineGeographies: includeFine,
      });
      sendJson(response, 200, {
        query,
        count: results.length,
        geographyVersion: demoGeographyCatalog.geographyVersion,
        dataMode: "demo_synthetic",
        watermark: "DEMO",
        results,
      }, { ...headers, "Cache-Control": "public, max-age=60" });
      return;
    }

    const geographyMatch = url.pathname.match(/^\/api\/v1\/geographies\/([^/]+)$/);
    if (geographyMatch) {
      const code = decodeURIComponent(geographyMatch[1]);
      const geography = demoGeographyCatalog.findByCode(code);
      if (!geography) {
        apiError(response, 404, "geography_not_found", "No se ha encontrado esa geografía.", headers);
        return;
      }
      sendJson(response, 200, {
        geography,
        children: demoGeographyCatalog.childrenOf(geography.code),
      }, { ...headers, "Cache-Control": "public, max-age=300" });
      return;
    }

    if (url.pathname === "/api/v1/map/metrics") {
      const metricId = url.searchParams.get("metricId");
      if (metricId === null) {
        sendJson(response, 200, {
          datasetId: demoMetricCatalog.dataset.datasetId,
          generatedAt: demoMetricCatalog.dataset.generatedAt,
          dataMode: demoMetricCatalog.dataset.dataMode,
          watermark: demoMetricCatalog.dataset.watermark,
          containsHouseholdRecords: false,
          metrics: demoMetricCatalog.listDefinitions(),
        }, { ...headers, "Cache-Control": "public, max-age=300" });
        return;
      }
      const definition = demoMetricCatalog.definition(metricId);
      if (!definition) {
        apiError(response, 404, "metric_not_found", "No se ha encontrado esa métrica.", headers);
        return;
      }
      const geographyCode = url.searchParams.get("geographyCode");
      const values = geographyCode
        ? [demoMetricCatalog.value(metricId, geographyCode)].filter((value) => value !== null)
        : demoMetricCatalog.values(metricId);
      sendJson(response, 200, {
        definition,
        values,
        containsHouseholdRecords: false,
      }, { ...headers, "Cache-Control": "public, max-age=300" });
      return;
    }

    const metricMetadataMatch = url.pathname.match(/^\/api\/v1\/map\/metrics\/([^/]+)\/metadata$/);
    if (metricMetadataMatch) {
      const metricId = decodeURIComponent(metricMetadataMatch[1]);
      const definition = demoMetricCatalog.definition(metricId);
      if (!definition) {
        apiError(response, 404, "metric_not_found", "No se ha encontrado esa métrica.", headers);
        return;
      }
      sendJson(response, 200, definition, { ...headers, "Cache-Control": "public, max-age=300" });
      return;
    }

    apiError(response, 404, "not_found", "Recurso no encontrado.", headers);
  };
}
