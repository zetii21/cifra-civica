# Laboratorio estadístico

## Pregunta

El laboratorio pregunta cómo se comporta el **motor exacto de `python_api`** sobre un espacio sintético amplio y hasta qué punto modelos estadísticos pueden aproximarlo para diagnóstico. No prueba `edge_api`, no pregunta cómo se distribuyen los hogares reales de España ni valida por sí solo la ley codificada.

## Diseño reproducible

- semilla por defecto: `20270713`;
- referencia: 2.000.000 de hogares sintéticos × 3 políticas = 6.000.000 evaluaciones exactas;
- muestra de entrenamiento: 400.000;
- holdout no usado en fit: 500.000;
- resto: barrido exacto e invariantes;
- 30 features y 5 targets declarados en código/reporte;
- input digest SHA-256 y versiones en `study-report.json`;
- generación en shards con RNG derivado de semilla e índice.

El muestreo aleatorio separa train/holdout después de generar. No hay datos de usuarios, microdatos administrativos o pesos poblacionales.

## Resultado de referencia

La corrida de referencia de `python_api` terminó con estado `reference` y estos resultados verificables:

- 2.000.000 hogares y 6.000.000 evaluaciones exactas completadas;
- cero violaciones en las dos invariantes declaradas;
- 87,34 s de barrido, 22.900 hogares/s y 116,45 μs medios por evaluación de escenario;
- digest de entrada `54d490e0a17b08009f64e7cc664ef774abdf5b0745f9d191ec446be54a447c7e`;
- SHA-256 del reporte `c9ad6524954e7a56dd686d28c81ed51d20e57543015bf2f896751e0420abbc95`;
- SHA-256 del surrogate diagnóstico `84ab38000e3715479f11f26156ddec392743bbc6bfc04a5713dfd22aa7a67620`.

El reporte completo está en `model-lab/artifacts/study-report.json`. Esos hashes fijan esta corrida; cualquier regeneración legítima producirá artefactos y hashes nuevos que deben revisarse juntos.

## Modelos

| Modelo | Función |
| --- | --- |
| Ridge + escalado | Baseline lineal interpretable |
| Extra Trees | Aproximación no lineal por árboles |
| HistGradientBoosting | Aproximación no lineal por target y modelo diagnóstico seleccionado |

Los targets son renta disponible, IRPF y cotizaciones de baseline, más cambios de los dos escenarios DEMO. El oracle es el motor determinista versionado; un surrogate aprende su comportamiento y sus errores.

## Métricas

Por target se reportan MAE, RMSE, percentiles 95/99 y máximo del error absoluto, R², tiempo de fit y latencia batch. Para el modelo seleccionado se mide latencia single y sensibilidad por permutación en holdout, con dirección de correlación como contexto.

R² no se usa como único criterio: importes fiscales exigen colas y error absoluto. Ningún umbral convierte automáticamente un surrogate en publicable.

## Invariantes del barrido

La ejecución cuenta violaciones de propiedades expresamente válidas para los fixtures actuales, incluida no negatividad del efecto de la reducción estatal DEMO y transferencia sintética exacta por descendiente elegible. No se añade monotonicidad general de impuestos/prestaciones porque existen caps y cliffs legítimos.

Los invariantes prueban consistencia con el código, no corrección normativa. Casos dorados y benchmarks oficiales siguen siendo gates separados.

## Límites

- Distribuciones sintéticas heurísticas, no representativas.
- Baseline 2027 trasladada y de incertidumbre alta.
- Dos políticas son DEMO, no programas reales.
- Un error pequeño frente al motor podría conservar un error del motor.
- Random holdout no es stress test dirigido de cada frontera legal.
- Sensibilidad no es causalidad ni impacto poblacional.
- El modelo puede degradarse al cambiar policy/model version.
- La evidencia y los hashes no se pueden atribuir a `edge_api`, que requiere inventario y validación separados.

## Seguridad y privacidad

`model-lab/work/` es scratch ignorado. El joblib es deserialización basada en pickle: solo se genera/usa offline, se verifica por digest y nunca se carga en web/API. Un artefacto no confiable puede ejecutar código y debe rechazarse.

## Gate

La release:

- conserva el reporte con estado `reference` como evidencia de validación, no como motor de producción;
- muestra `authoritativeForPublicResults: false`;
- verifica seed, digest, conteos e invariantes;
- no copia joblib a imágenes runtime;
- reejecuta ante cambio de motor, parámetros, generator o librería;
- conserva el motor exacto para cada resultado `python_api`;
- impide que una release `edge_api` reutilice esta corrida como validación de su aritmética.

Ejecutar:

```bash
make model-study
```

Una corrida pequeña requiere `--allow-small-report` y no puede presentarse como referencia.
