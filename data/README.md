# Data boundary

This tree contains only public metadata and synthetic development fixtures.
It does **not** contain taxpayer records, ECV/EPF survey microdata, restricted
research files, or household inputs from the calculator.

- `fixtures/geography/`: official-code nomenclature paired with deliberately
  simplified rectangular `DEMO` geometry. It is not official cartography.
- `fixtures/aggregates/`: deterministic synthetic aggregate values. Every
  populated cell carries `dataMode=demo_synthetic` and `watermark=DEMO`.
- `provenance/`: machine-readable source/checksum/transformation manifests.
- `sample/aggregate-model-manifest.json`: exact weighted aggregation,
  uncertainty, threshold and suppression parameters.
- `generated/`: ignored build outputs, including the XYZ MVT pyramid.

Official context metric definitions are present, but their fixture values are
intentionally absent. Official values may be added only through an approved
source adapter with a valid provenance manifest and the publisher's own
suppression markers preserved.

Regenerate reproducibly:

```sh
node --import tsx pipelines/geography/generate-demo.ts
node --import tsx pipelines/publishing/build-vector-tiles.ts
```
