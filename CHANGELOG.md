# Changelog

Los cambios materiales indican versiones de aplicación, modelo, política, datos y geografía. No se reescribe una release publicada.

## [Unreleased]

### Added

- Vertical slice de Cifra Cívica para comparación fiscal informativa 2027.
- Motor determinista, registro versionado y escenarios sintéticos DEMO.
- Explorer geográfico DEMO con controles de divulgación.
- Documentación de metodología, privacidad, seguridad, validación y operaciones.
- CI, contenedores no root y manifiestos auditables de modelo/cobertura.
- Enrutamiento de simulación por Worker del mismo origen, con FastAPI principal y contingencia edge server-side identificada.
- Estudio estadístico reproducible con inputs hasheados, entorno fijado y artefacto firmado por checksum.

### Limitations

- La referencia 2027 traslada explícitamente reglas revisadas de ejercicios anteriores y conserva incertidumbre alta.
- No hay fidelidad foral para Navarra o País Vasco.
- Fixtures territoriales y escenarios de comparación son sintéticos DEMO.
- Los benchmarks agregados oficiales permanecen no evaluados hasta disponer de artefactos alineados y revisados.
- `edge_api` es una contingencia aproximada visible y no acredita paridad fiscal universal con `python_api`.

Consulte [limitaciones](docs/methodology/limitations.md) y el metadata de cada release.
