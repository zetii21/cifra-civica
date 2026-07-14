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
- «¿Y un hogar como el tuyo?»: consulta por perfil aproximado (comunidad × banda de renta × tipo de familia × edad) con la media del segmento sintético, verificada contra la distribución del motor.
- Comparador de paquetes (`/laboratorio/comparador`): hasta tres paquetes lado a lado con trato visual idéntico, orden de catálogo y hueco declarado para los programas electorales de 2027 con fuentes.
- Modo directo (`/laboratorio/directo`): coste o recaudación de una promesa en segundos y fact-card PNG para debates.
- Widget embebible para medios (`/widget/{paquete}`): solo agregados públicos, sin cookies, único origen autorizado a ser enmarcado (CSP `frame-ancestors *` solo en esa ruta) y fragmento de inserción copiable.
- Páginas por comunidad (`/laboratorio/{comunidad}`): ficha fiscal con su escala de IRPF, gasto de referencia localizado y el laboratorio preseleccionado en su ámbito.
- Refinamiento del estudio nacional: bandas de sensibilidad de elasticidades (0,5×–1,5×), análisis de convergencia de la malla de cuantiles (K = 11–151), invariante exacta de aditividad entre territorios (171 pares), picos de recaudación por instrumento en mallas de 201 puntos y frontera de cierre del déficit ordenada por menor coste para los deciles bajos; 20 escenarios dorados de equivalencia entre motores (antes 12).
- Iteración UX 1 del laboratorio: marcador fijo al hacer scroll con indicador de déficit antes→después, arranque guiado en tres chips, bandeja de cambios activos con deshacer individual, anatomía de palanca con entrada numérica exacta y reset por palanca, contadores por acordeón, mapa apto para daltonismo (color + rayado, tooltip al toque, rango del escenario) y pase tipográfico de accesibilidad; en móvil los resultados preceden a los controles.
- Iteración UX 2: modo oscuro completo mediante variables semánticas y `prefers-color-scheme` (con `color-scheme` y `theme-color` adaptativos), celebración del reto con título conseguido y tarjeta del logro, cifras del marcador interpoladas (respetando `prefers-reduced-motion`), gestión de foco y anuncio `aria-live` en la bandeja de cambios, y estado vacío orientativo sobre el mapa.
- Iteración UX 3: selector manual de tema (automático → claro → oscuro) sin parpadeo al cargar y con la preferencia guardada solo en el dispositivo (mismo patrón IndexedDB aprobado; sin JavaScript se mantiene el modo del sistema), tabla de comunidades ordenable por cualquier columna (`aria-sort`) con mini-barras divergentes del impacto por hogar, bandeja de cambios convertida en hoja inferior con cierre propio en pantallas pequeñas, renderizado diferido de tarjetas bajo el pliegue (`content-visibility`) y escala de iconografía unificada en cuatro tamaños.

### Limitations

- La referencia 2027 traslada explícitamente reglas revisadas de ejercicios anteriores y conserva incertidumbre alta.
- No hay fidelidad foral para Navarra o País Vasco.
- El laboratorio nacional usa agregados aproximados de 2024, elasticidades acotadas y escalas forales aproximadas señaladas; no es una liquidación oficial.
- Fixtures territoriales y escenarios de comparación son sintéticos DEMO.
- Los benchmarks agregados oficiales permanecen no evaluados hasta disponer de artefactos alineados y revisados.
- `edge_api` es una contingencia aproximada visible y no acredita paridad fiscal universal con `python_api`.

Consulte [limitaciones](docs/methodology/limitations.md) y el metadata de cada release.
