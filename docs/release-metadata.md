# Metadatos de release

## Identidad

Una release no es solo la versión web. Debe identificar:

- application version y source commit;
- API contract version;
- calculation backend seleccionado (`python_api` o `edge_api`);
- model version;
- policy registry commit;
- data pipeline version;
- geography version;
- build date UTC;
- digests de artefactos;
- inventario exacto de modelo;
- resumen de validación;
- limitaciones conocidas;
- estado de fixtures sintéticos.

El esquema está en [infra/deployment/release-metadata.schema.json](../infra/deployment/release-metadata.schema.json).

## Ejemplo conceptual

```json
{
  "schemaVersion": "1.0",
  "applicationVersion": "release-version",
  "sourceCommit": "git-sha",
  "contractVersion": "v1",
  "calculationBackend": "python_api",
  "modelVersion": "model-version",
  "policyRegistryCommit": "git-sha",
  "dataPipelineVersion": "pipeline-version",
  "geographyVersion": "geography-version",
  "buildDate": "ISO-8601 UTC",
  "syntheticFixturesEnabled": false,
  "artifactDigests": {},
  "modelInventory": {
    "namedVariables": 0,
    "executableFormulas": 0,
    "datedParameterValues": 0,
    "publishedBaselines": 0,
    "publishedScenarios": 0,
    "publishedSyntheticScenarios": 0,
    "sourceRecords": 0,
    "goldenCases": 0,
    "aggregateBenchmarks": 0,
    "addressableValidationStates": 61980085440
  },
  "validationSummary": {
    "status": "not_assessed",
    "passed": 0,
    "failed": 0,
    "notAssessed": 0
  },
  "knownLimitations": []
}
```

Los ceros son placeholders del ejemplo. Producción genera conteos exactos del código/registro; nunca se escriben para “parecer completos”. Los pesos de un LLM no son parámetros fiscales. `calculationBackend` debe coincidir con `X-Cifra-Engine`, la etiqueta visible y la model version realmente ejecutada.

Un despliegue edge-only emite metadata separada, identifica el Worker activo mediante `sourceCommit`, model version y digest de artefacto, y publica al menos una limitación. Hasta disponer de manifiesto y validación edge propios, declara `addressableValidationStates: 0` y `validationSummary.status: not_assessed`; no reutiliza los 61.980.085.440 estados ni el estudio fiscal de `python_api` como si demostraran paridad. `policyRegistryCommit` sigue inventariando el registro incluido en la release, pero no prueba que el catálogo edge ejecute sus fórmulas.

## Compatibilidad

En `python_api`, el build falla si web/Worker y API no comparten contract major, una policy declara model compatibility incompatible o las teselas no coinciden con geography version. En `edge_api`, falla si el Worker y su catálogo no comparten contrato, versión/proyección sincronizada o si intentan heredar evidencia Python. El rollback usa el conjunto completo de digest + backend/configuración + metadata.

## Exposición pública

Las páginas de metodología muestran application/model/policy/data/geography versions, calculation backend, build date, validation summary y limitaciones. Los digests y el JSON completo pueden enlazarse desde updates/release sin distraer el resultado personal.
