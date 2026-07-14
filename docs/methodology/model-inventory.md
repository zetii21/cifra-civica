# Inventario y gobierno de modelos

## Qué cuenta como modelo

El cálculo fiscal es un sistema determinista de reglas jurídicas y parámetros fechados. Su tamaño se informa mediante conteos auditables de artefactos ejecutables, no mediante “parámetros” de redes neuronales.

Una afirmación de 50–100 mil millones de parámetros describiría el número de pesos de un modelo de lenguaje grande, no cobertura tributaria. Cifra Cívica no necesita ni afirma tal cifra. Inflar el recuento sería engañoso y haría el cálculo menos auditable.

## Inventario inicial

| Elemento | Rol | Runtime numérico | Estado |
| --- | --- | --- | --- |
| Grafo determinista Python | Fórmulas, dependencias, redondeo y traza | Sí, `python_api` | Motor fiscal principal MVP |
| Motor de contingencia Worker | Aproximación server-side para despliegue sin upstream | Sí, `edge_api` | Inventario/evidencia separados |
| Registro versionado | Parámetros fechados y overrides | Sí | Fuente ejecutable |
| Renta Web Open (AEAT) | Referencia manual de casos permitidos | No | Validación externa candidata |
| EUROMOD España | Benchmark metodológico/agregado según acceso | No | Validación externa candidata |
| OpenFisca | Patrón de variables/periodos y posible adaptador futuro | No | Referencia arquitectónica |
| Pipelines AEAT/INE/SS | Ingesta, armonización y calibración | No en petición personal | Adaptadores por fuente |
| Manifiesto de espacio de estados | Combinaciones discretizadas de cálculo/validación | No; es un conteo | Cobertura estructurada |
| Laboratorio estadístico | Barrido sintético, sensibilidad y surrogates diagnósticos | No | Desarrollo/validación |
| Modelos de lenguaje | Ningún rol en aritmética | No | Fuera del motor |

No se describe un referente externo como “integrado” hasta que exista adaptador, versión, licencia, test y release metadata.

## Conteos exactos por release

El build de release debe generar, desde artefactos y no a mano, un inventario correspondiente al `calculationBackend` seleccionado:

```json
{
  "namedVariables": 0,
  "executableFormulas": 0,
  "datedParameterValues": 0,
  "publishedBaselines": 0,
  "publishedScenarios": 0,
  "publishedSyntheticScenarios": 0,
  "sourceRecords": 0,
  "goldenCases": 0,
  "aggregateBenchmarks": 0,
  "addressableValidationStates": 61980085440,
  "supportedTaxYears": [],
  "supportedTerritories": []
}
```

Los ceros son el esquema ilustrativo, no una afirmación de la release. El CI compara el inventario generado con el registro y bloquea conteos manuales, ausentes o inconsistentes. Un metadata `edge_api` no copia el inventario ni los 61.980 millones de estados de `python_api`: hasta que exista un manifiesto de cobertura edge separado declara `addressableValidationStates: 0`, `validationSummary.status: not_assessed` y una limitación explícita. Su `sourceCommit`, model version y digest del Worker identifican el catálogo y código realmente activos.

El manifiesto de desarrollo actual de `python_api`, generado el 2026-07-13, informa:

| Conteo | Valor |
| --- | ---: |
| Variables nombradas | 30 |
| Fórmulas ejecutables | 14 |
| Valores de parámetro fechados/overrides | 449 |
| Parameter sets | 1 |
| Baselines publicadas | 1 |
| Escenarios publicados | 2 |
| Escenarios sintéticos publicados | 2 |
| Registros de fuente | 5 |
| Casos dorados formales | 0 |
| Benchmarks agregados formales | 0 |
| Funciones de test Python | 70 |

La autoridad es `services/simulation-api/model-manifest.json`, no esta tabla. Los ceros de golden cases/benchmarks son deliberados: tests ordinarios o un barrido sintético no se renombran como evidencia oficial.

## Espacio de estados 50–100 mil millones

Para `python_api`, `model-manifest/coverage.json` declara **61.980.085.440** estados de cálculo o validación estructurada bajo una discretización explícita:

```text
19 resultados territoriales
× 461 perfiles de hogar válidos
× 360 perfiles de ingresos
× 504 perfiles de modificadores fiscales
× 3 bundles de escenarios
× 13 valores de meses trabajados
= 61.980.085.440
```

`scripts/validate-coverage.mjs` recalcula la dimensión de hogar, el producto y el rango declarado. Este número no se atribuye a `edge_api`. Para el backend Python:

- no son pesos de IA ni parámetros legales;
- no son personas, registros, peticiones o resultados precalculados;
- no afirma que cada estado tenga un caso dorado o fidelidad normativa;
- mide estados direccionables bajo esa discretización, no exactitud;
- cambia de versión si cambia una dimensión o gate.

La cobertura validada real se informa aparte mediante casos, territorios y benchmarks. Nunca se usa el número grande como sustituto de evidencia.

## Laboratorio estadístico

`model-lab/` genera hogares completamente sintéticos con semilla, ejecuta el motor exacto de `python_api` y compara modelos Ridge, Extra Trees e HistGradientBoosting como diagnóstico de sensibilidad/latencia. `make model-study` lanza la ejecución completa declarada de dos millones de hogares; el informe registra número de evaluaciones, input digest, features, targets, errores, invariantes y versiones. El laboratorio no ejecuta ni valida `edge_api`.

El surrogate seleccionado:

- no participa en `POST /simulations/compare`;
- no sustituye el motor ni se publica como cálculo;
- no demuestra validez legal;
- no se entrena con usuarios;
- no debe deserializarse en runtime o desde una fuente no verificada.

Un R² alto no compensa MAE, errores de cola o discontinuidades fiscales. Los resultados `python_api` siguen usando el grafo exacto; una release edge-only muestra su condición aproximada y no hereda esta evidencia.

### Definiciones

- **Variable**: nodo nombrado distinto del grafo.
- **Fórmula ejecutable**: implementación fechada distinta; aliases no suman.
- **Valor de parámetro**: valor atómico con intervalo efectivo; una tabla cuenta sus celdas atómicas documentadas.
- **Escenario publicado**: entrada que supera reglas de publicación; draft no suma.
- **Fuente**: registro único con URL/snapshot/checksum, no cada enlace repetido.
- **Caso dorado**: fixture versionado con expected y revisión.
- **Benchmark**: comparación agregada definida y ejecutable, no una gráfica.
- **Estado direccionable**: una combinación válida de categorías discretizadas del manifiesto; no se almacena ni ejecuta por adelantado.

## Gobierno

- Toda fórmula y parámetro tiene owner, vigencia, fuente y tests.
- Los conteos no miden calidad; se publican junto con cobertura y validación.
- Un parámetro sin fuente no se promociona.
- Una dependencia de IA futura se inventaría con proveedor, versión, datos, propósito y evaluación, pero permanecería fuera de la ruta numérica.
- Cambiar motor o backend exige ADR, inventario/evidencia propios, equivalencia por casos si se afirma y nueva model version.

## Laboratorio fiscal nacional y su recuento ejecutado

El laboratorio de `/laboratorio` es un segundo sistema determinista, separado del cálculo personal: trabaja únicamente con agregados públicos (población, deciles de renta, recaudación y gasto de referencia) y nunca recibe datos de un hogar concreto. Su tamaño se informa con dos números distintos y no intercambiables:

1. **Estados direccionables del motor personal** (`model-manifest/coverage.json`): 61.980.085.440, sin cambios.
2. **Aplicaciones de parámetro-caso ejecutadas** (`model-manifest/national-coverage.json`): el número exacto de celdas (unidad sintética × parámetro fiscal) que el estudio de referencia del laboratorio calculó de verdad, acumulado desde las formas reales de los arrays en cada operación vectorizada. El estudio (`model-lab/run_national_study.py`) exige un mínimo de 200.000 millones y su validador (`scripts/validate-national-study.mjs`) verifica la firma de entradas, la equivalencia entre el motor TypeScript y el reimplementado en NumPy, las invariantes y la igualdad entre manifiesto e informe.

Las mismas salvaguardas de honestidad aplican: ninguna de las dos cifras son pesos de IA, personas, filas almacenadas ni evidencia normativa. Medir trabajo ejecutado no sustituye a los casos dorados ni a los benchmarks oficiales; solo describe la profundidad del barrido determinista comprometido en el repositorio.

Los paquetes de gobierno del laboratorio (`lib/fiscal-lab/presets.ts`) no son escenarios del registro de políticas personal: son conjuntos de palancas agregadas con sus reglas de neutralidad documentadas en [neutralidad legal](../governance/legal-neutrality.md). Las trayectorias históricas citan las medidas aprobadas en que se basan y se etiquetan como aplicación ilustrativa; los arquetipos se etiquetan como sintéticos.
