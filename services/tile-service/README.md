# Tile service

Read-only development service for immutable public vector tiles and aggregate
map APIs. It never accepts household inputs and never serves survey records.

Run after generating data and tiles:

```sh
node --import tsx pipelines/geography/generate-demo.ts
node --import tsx pipelines/publishing/build-vector-tiles.ts
TILE_PORT=3102 node --import tsx services/tile-service/src/server.ts
```

Health: `GET /healthz`. TileJSON:
`GET /tiles/demo-es-2027.1/tilejson.json`.

The committed development artifact is an XYZ MVT pyramid. `tilejson.json` and
the layer contract keep a production PMTiles package interchangeable. Reviewed
official boundaries must replace the DEMO rectangles before production. The
service refuses synthetic data under `NODE_ENV=production` unless the explicit
`ALLOW_SYNTHETIC_DATA_IN_PRODUCTION=true` emergency override is present.
