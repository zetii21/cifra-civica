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
- Laboratorio fiscal nacional (`/laboratorio`): tipos editables de IRPF por tramos (estatal, autonómico y foral aproximado), ahorro y plusvalías, IVA, carburantes, tabaco, alcohol, electricidad, juego, loterías, patrimonio, sucesiones, ITP-AJD, sociedades y cotizaciones; partidas de gasto ajustables (pensiones, sanidad, educación, defensa, carreteras y más) a escala estatal o por comunidad.
- Impacto distributivo instantáneo por decil de renta, tipo de familia, edad y comunidad, con grupos más y menos afectados.
- Mapa SVG interactivo de España con las 17 comunidades y 2 ciudades autónomas (GISCO NUTS-2 2024, © EuroGeographics), accesible por teclado, usado por el laboratorio y el explorador; sustituye a las teselas DEMO rectangulares.
- Estudio nacional de referencia con doble motor (TypeScript ↔ NumPy), barridos exhaustivos de palancas y recuento auditable de más de 200.000 millones de aplicaciones de parámetro-caso, validado en CI (`scripts/validate-national-study.mjs` y `model-manifest/national-coverage.json`).
- Paquetes de gobierno comparables en el laboratorio: trayectorias documentadas (PSOE 2018–2024 y PP 2011–2016, mapeadas desde medidas del BOE y etiquetadas como aplicación ilustrativa) y arquetipos sintéticos, con fichas homogéneas sin logotipos y reglas de neutralidad codificadas.
- Estudio nacional ampliado: nueve familias de barridos (pares de tramos, cruces autonómico × estatal, tríos de palancas, paquetes gasto × IRPF) con superficies por decil y por comunidad en cada punto de malla; 1.142.095.215.544 aplicaciones de parámetro-caso ejecutadas y contadas de forma auditable en 45.449 evaluaciones de variante.
- Reto de equilibrio presupuestario y tarjeta-resumen PNG generada íntegramente en el navegador (sin datos personales ni URLs).

### Limitations

- La referencia 2027 traslada explícitamente reglas revisadas de ejercicios anteriores y conserva incertidumbre alta.
- No hay fidelidad foral para Navarra o País Vasco.
- El laboratorio nacional usa agregados aproximados de 2024, elasticidades acotadas y escalas forales aproximadas señaladas; no es una liquidación oficial.
- Fixtures territoriales y escenarios de comparación son sintéticos DEMO.
- Los benchmarks agregados oficiales permanecen no evaluados hasta disponer de artefactos alineados y revisados.
- `edge_api` es una contingencia aproximada visible y no acredita paridad fiscal universal con `python_api`.

Consulte [limitaciones](docs/methodology/limitations.md) y el metadata de cada release.
