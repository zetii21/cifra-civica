import { createServer } from "node:http";

import { assertDataModeAllowed } from "../../../packages/geography/runtime-guard";
import { createTileServiceHandler } from "./handler";

const port = Number(process.env.TILE_PORT ?? "3102");
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("TILE_PORT must be an integer between 1 and 65535");
}

assertDataModeAllowed({
  environment: process.env.NODE_ENV,
  dataMode: "demo_synthetic",
  allowSyntheticInProduction: process.env.ALLOW_SYNTHETIC_DATA_IN_PRODUCTION === "true",
});

const handler = createTileServiceHandler({
  corsOrigin: process.env.TILE_CORS_ORIGIN ?? "*",
  tileArtifactRoot: process.env.TILE_ARTIFACT_DIR,
});
const server = createServer((request, response) => {
  void handler(request, response).catch(() => {
    if (!response.headersSent) {
      response.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
    }
    response.end('{"error":{"code":"tile_service_error","message":"El servicio cartográfico no está disponible temporalmente."}}\n');
  });
});

server.listen(port, "0.0.0.0", () => {
  process.stdout.write(`tile-service listening on :${port}\n`);
});

function shutdown(): void {
  server.close((error) => {
    process.exitCode = error ? 1 : 0;
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
