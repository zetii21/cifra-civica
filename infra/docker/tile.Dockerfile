FROM node:22.14-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS build
COPY tsconfig.json ./
COPY packages/geography ./packages/geography
COPY pipelines ./pipelines
COPY data/fixtures ./data/fixtures
COPY data/provenance ./data/provenance
COPY data/sample ./data/sample
RUN node --import tsx pipelines/geography/generate-demo.ts \
  && node --import tsx pipelines/publishing/build-vector-tiles.ts

FROM node:22.14-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    TILE_PORT=3102 \
    TILE_ARTIFACT_DIR=/app/data/generated/tiles
COPY --from=dependencies /app/node_modules /app/node_modules
COPY --chown=node:node package.json tsconfig.json ./
COPY --chown=node:node services/tile-service ./services/tile-service
COPY --chown=node:node packages/geography ./packages/geography
COPY --from=build --chown=node:node /app/data/generated ./data/generated
USER node
EXPOSE 3102
CMD ["node", "--import", "tsx", "services/tile-service/src/server.ts"]
