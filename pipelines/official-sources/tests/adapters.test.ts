import assert from "node:assert/strict";
import test from "node:test";

import {
  IngestionNotPermittedError,
  assertSnapshotMayBeProcessed,
  createDelimitedOfficialAdapter,
  officialSourceProfile,
  parseDelimitedText,
  type RawOfficialSnapshot,
} from "../../../packages/geography/official-source-adapter";
import { ingestOfficialSnapshot } from "../ingestion";

function snapshot(sourceId: string, text: string): RawOfficialSnapshot {
  return {
    sourceId,
    originalFilename: "official-fixture.csv",
    contentType: "text/csv",
    bytes: new TextEncoder().encode(text),
    accessDate: "2026-07-13",
    publicationDate: "2026-01-01",
    dataPeriod: "2024",
    licenceOrReuseConditions: "Test fixture only",
    approvedForProcessing: true,
    containsRestrictedMicrodata: false,
  };
}

test("delimited parser handles quoted separators and doubled quotes", () => {
  assert.deepEqual(parseDelimitedText('code;name\n28079;"Madrid; capital"\n08019;"Bar""celona"\n'), [
    ["code", "name"],
    ["28079", "Madrid; capital"],
    ["08019", 'Bar"celona'],
  ]);
});

test("adapter preserves publisher suppression and official geography codes", () => {
  const profile = officialSourceProfile("aeat-irpf-municipalities");
  const adapter = createDelimitedOfficialAdapter(profile, {
    geographyCodeColumn: "codigo",
    geographyLevel: "municipality",
    valueColumns: {
      official_mean_income_eur: "renta_media",
      official_returns: "declaraciones",
    },
  });
  const result = adapter.ingest(snapshot(profile.id, [
    "codigo;renta_media;declaraciones",
    "28079;31.250,50;1200",
    "08019;..;950",
    ";100;20",
  ].join("\n")));
  assert.equal(result.records.length, 2);
  assert.equal(result.records[0].officialGeographyCode, "28079");
  assert.equal(result.records[0].values.official_mean_income_eur, 31250.5);
  assert.equal(result.records[1].publisherSuppressionStatus, "suppressed");
  assert.equal(result.records[1].values.official_mean_income_eur, null);
  assert.equal(result.rejectedRows, 1);
});

test("Renta Web Open cannot be automated by this pipeline", () => {
  const profile = officialSourceProfile("aeat-renta-web-open");
  assert.throws(
    () => assertSnapshotMayBeProcessed(profile, snapshot(profile.id, "anything")),
    IngestionNotPermittedError,
  );
});

test("restricted or unapproved snapshots are rejected before parsing", () => {
  const profile = officialSourceProfile("ine-adrh");
  const base = snapshot(profile.id, "code;value\n1;2");
  assert.throws(() => assertSnapshotMayBeProcessed(profile, {
    ...base,
    approvedForProcessing: false,
  }), /not been approved/);
  assert.throws(() => assertSnapshotMayBeProcessed(profile, {
    ...base,
    containsRestrictedMicrodata: true,
  }), /Restricted microdata/);
});

test("every coordinated official ingestion emits a checksum provenance manifest", () => {
  const profile = officialSourceProfile("ine-adrh");
  const adapter = createDelimitedOfficialAdapter(profile, {
    geographyCodeColumn: "code",
    geographyLevel: "municipality",
    valueColumns: { official_income: "income" },
  });
  const ingested = ingestOfficialSnapshot(
    adapter,
    snapshot(profile.id, "code;income\n28079;25000\n"),
    {
      datasetId: "test-ine-adrh-2024",
      geographicCoverage: "Test municipality fixture",
      transformVersion: "test/1",
      transformationSteps: ["Map the official geography code without place-name joins."],
      outputTables: ["official_income_context"],
      responsibleMaintainer: "test@example.invalid",
    },
  );
  assert.equal(ingested.provenance.dataMode, "official");
  assert.equal(ingested.provenance.pipelineStage, "curated");
  assert.match(ingested.provenance.checksum, /^[a-f0-9]{64}$/);
  assert.equal(ingested.result.records.length, 1);
});
