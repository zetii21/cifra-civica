# Diccionario de datos

## Convenciones

- JSON usa `camelCase`; Python puede mapear internamente sin cambiar el contrato.
- Dinero: entero de céntimos de euro, salvo que se marque otra unidad.
- Fechas: ISO 8601; ejercicios: entero de cuatro dígitos.
- `null` significa conocido como no aplicable o ausente según el campo; `unknown` es un valor de enumeración cuando la incertidumbre es material.
- IDs de persona/dependiente son UUID locales no identificativos.
- Retención de todos los campos de entrada personal en servidor: **ninguna**.

## Clasificación

| Clase | Ejemplos | Tratamiento |
| --- | --- | --- |
| P0 pública | políticas, fuentes, teselas divulgables | Cacheable tras publicar |
| P1 operativa | request ID aleatorio, estado, duración, versiones | Log permitido con baja cardinalidad |
| P2 personal fiscal | ingresos, renta, pensión, prestaciones, hogar | Memoria de petición; prohibido log/cache/DB |
| P3 especialmente sensible/contextual | discapacidad; combinación municipio + fiscalidad | Minimizar; exportación excluida por defecto |
| R restringida | microdatos licenciados, secretos | Pipeline privado; nunca repositorio o servicio web |

## `HouseholdInput`

| Campo | Tipo / valores | Requerido | Clase | Regla principal |
| --- | --- | --- | --- | --- |
| `taxYear` | integer | sí | P2 | Debe existir baseline compatible |
| `locale` | string, defecto `es-ES` | sí | P1 | Lista permitida |
| `residence.autonomousCommunityCode` | código oficial versionado | sí | P2 | Resuelve régimen antes del cálculo |
| `residence.municipalityCode` | código oficial o null | no | P3 | Contexto; nunca en logs con importes |
| `residence.fiscalRegime` | `common` / `foral_navarre` / `foral_basque` / `unknown` | sí | P2 | Denegar si no soportado |
| `filingPreference` | `calculate_best` / `individual` / `joint` | sí | P2 | Compatibilidad del hogar |
| `maritalStatus` | enumeración contractual | sí | P2 | No inferir |
| `singleParentHousehold` | boolean | sí | P2 | Confirmación expresa |
| `adults` | `PersonInput[]` | sí | P2/P3 | Al menos composición soportada |
| `dependants` | `DependantInput[]` | sí | P2/P3 | Puede estar vacío |
| `housing` | `HousingInput` | sí | P2 | Desglose progresivo |
| `householdBenefits` | array | sí | P3 | Puede estar vacío |
| `broadCapitalIncome` | `CapitalIncomeInput` | sí | P2 | Bases separadas |
| `userConfirmedAssumptions` | string IDs | sí | P2 | Solo IDs predefinidos, no texto libre |

## `PersonInput`

| Campo | Tipo / valores | Unidad | Clase | Validación |
| --- | --- | --- | --- | --- |
| `id` | UUID local | — | P2 | No reutilizar como identidad |
| `age` | integer | años | P2 | Rango humano razonable |
| `relationshipToHousehold` | enumeración | — | P2 | Una persona primaria |
| `employmentStatus` | enumeración | — | P2 | Coherente con rentas, o advertir |
| `annualGrossEmploymentIncome` | integer ≥ 0 | céntimos/año | P2 | Límite antierror |
| `annualSelfEmploymentNetIncome` | integer, rango contractual | céntimos/año | P2 | Negativo solo si contrato/regla lo admite |
| `annualUnemploymentBenefits` | integer ≥ 0 | céntimos/año | P3 | No inferir elegibilidad |
| `annualPensionIncome` | integer ≥ 0 | céntimos/año | P3 | No reconstruir historia |
| `annualOtherTaxableBenefits` | integer ≥ 0 | céntimos/año | P3 | Cobertura documentada |
| `annualExemptIncome` | integer ≥ 0 o null | céntimos/año | P2 | Opcional |
| `disabilityBand` | `none` / bandas amplias / `unknown` | — | P3 | No diagnóstico o porcentaje inferido |
| `socialSecurityCategory` | enumeración | — | P2 | Aproximación visible si `unknown` |
| `monthsWorked` | integer 0…12 | meses | P2 | Coherencia sin corregir silenciosamente |
| `multipleJobs` | boolean | — | P2 | Confirmación |
| `contributionBaseOverride` | integer ≥ 0 o null | céntimos/año | P2 | Entrada avanzada y explicada |
| `dataQuality` | `exact` / `estimated` / `unknown` | — | P1 | Propaga incertidumbre |

## Dependientes, vivienda y capital

| Objeto.campo | Tipo / unidad | Clase | Nota |
| --- | --- | --- | --- |
| `DependantInput.age` | integer, años | P2 | Fronteras de edad probadas |
| `relationship` | child/descendant/ascendant/other | P2 | No inferir |
| `disabilityBand` | banda amplia | P3 | Sensible |
| `sharedCustody` | boolean | P2 | Hecho confirmado |
| `dependentForTaxPurposes` | boolean/unknown | P2 | `unknown` genera supuesto o bloqueo |
| `HousingInput.tenure` | enumeración | P2 | Sin valor del inmueble |
| `annualRent` | céntimos/año o null | P2 | Solo si relevante |
| `mortgageExists` | boolean | P2 | No solicita saldo por defecto |
| `mortgageStartYear` | integer o null | P2 | Requerido solo por regla soportada |
| `primaryResidence` | boolean | P2 | Hecho confirmado |
| `protectedHousing` | boolean/unknown/null | P2 | Entrada avanzada |
| `CapitalIncomeInput.annualInterest` | céntimos/año | P2 | Generalmente no negativo |
| `annualDividends` | céntimos/año | P2 | No negativo |
| `annualPropertyIncome` | céntimos/año | P2 | Rango contractual |
| `annualCapitalGains` | céntimos/año | P2 | No negativo |
| `annualCapitalLosses` | céntimos/año | P2 | Pérdida como magnitud no negativa o contrato explícito |
| `valuesAreEstimated` | boolean | P1 | Eleva incertidumbre |

## `SimulationComparison`

| Campo | Tipo | Clase | Semántica |
| --- | --- | --- | --- |
| `requestId` | UUID/ID aleatorio | P1 | No derivado del hogar |
| `taxYear` | integer | P1 | Ejercicio aplicado |
| `modelVersion` | semver/ID inmutable | P0 | Motor y fórmulas |
| `calculationBackend` | `python_api` / `edge_api` | P0 | Campo de presentación derivado de `X-Cifra-Engine`; identifica el motor ejecutado |
| `calculationTimestamp` | datetime UTC | P1 | Momento, no historial |
| `inputCompleteness` | complete/estimated/incomplete | P1 | Calidad global |
| `territorialSupport` | supported/partial/unsupported | P0 | Bloqueo territorial |
| `baselineScenarioId` | string | P0 | Baseline efectiva |
| `scenarioResults` | array | P2 en tránsito | Hasta cuatro resultados |
| `globalWarnings` | array de códigos/texto seguro | P1 | Sin eco de valores |
| `provenance` | referencias | P0 | Fuentes/versiones |
| `dataRetention` | literal `not_stored` | P0 | Garantía de contrato |

El JSON canónico del API no incorpora `calculationBackend`: el Worker fija `X-Cifra-Engine` en la respuesta del mismo origen y el cliente lo añade al modelo de presentación. Solo se aceptan los valores exactos `python_api` y `edge_api`; una cabecera ausente o desconocida produce `unverified_engine` y descarta el resultado. Los intermediarios de producción no deben retirar ni reescribir la cabecera. La selección se registra también en los metadatos de despliegue.

## `ScenarioResult`

Incluye ID/nombre/estado de escenario, policy version, validation status, componentes anuales, equivalente mensual, diferencias, explicaciones, supuestos, advertencias, incertidumbre y fuentes.

Los componentes monetarios mínimos son ingresos brutos, renta exenta, cotizaciones, bases general y ahorro, mínimo personal/familiar, reducción conjunta, cuotas estatal y autonómica, deducciones/créditos, IRPF final, prestaciones, pensiones y renta disponible. El contrato del motor define inclusiones para que la reconciliación no duplique pensiones o prestaciones.

`changeFromBaseline` separa ingreso bruto, cotizaciones, IRPF estatal, IRPF autonómico, prestaciones y total. Todos los importes son nominales; los porcentajes nunca sustituyen euros.

## Datos agregados/geográficos

| Campo | Tipo | Publicación |
| --- | --- | --- |
| `geographyCode` | código oficial + versión | P0 tras control |
| `geographyLevel` | country/ccaa/municipality/district/section | P0 |
| `metricId` | ID estable | P0 |
| `metricType` | official/modelled/calibrated/synthetic_demo | P0 y visible |
| `taxYear` / `dataVintage` | año/periodo | P0 y visible |
| `scenarioId` | ID o null | P0 |
| `estimate` | número o null | Solo si divulgable |
| `unit` | euros/share/index/etc. | Obligatorio |
| `uncertainty` | estado + intervalo si válido | Obligatorio |
| `suppressionStatus` | published/suppressed/unavailable | Obligatorio |
| `sampleOrCellQuality` | banda, nunca conteo riesgoso | Según fuente |
| `sourceId` / `artifactVersion` | referencias | Obligatorio |

`null + suppressed` nunca se transforma en cero.

## Campos permitidos en logs

Timestamp, request ID, endpoint normalizado, status, duración, model version, calculation backend, scenario IDs y categoría gruesa de error. Todo lo demás se rechaza por defecto. Consulte la [matriz de retención](../privacy/retention-matrix.md).
