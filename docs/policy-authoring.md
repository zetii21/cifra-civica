# Guía de autoría de políticas

## Principio editorial

El registro convierte evidencia revisable en parámetros y fórmulas deterministas. No evalúa si una política es buena, viable o conveniente. Describe qué interpretación se modela y qué no.

## Roles y separación

| Rol | Acción |
| --- | --- |
| Autor/a | Extrae fuente, redacta interpretación y añade tests |
| Revisor/a fiscal | Contrasta norma/propuesta y vigencia |
| Revisor/a de modelo | Comprueba interacciones, unidades y trazas |
| Revisor/a editorial | Neutralidad, claridad, etiquetas y limitaciones |
| Release manager | Verifica gates y publica artefactos |

Una persona no debe ocupar en solitario autoría, revisión fiscal y publicación de un cambio material.

## Estados

Estado de política: `draft → proposed / legislated / simulated → validated → archived` según la naturaleza del escenario. No es una escalera obligatoria: `legislated` describe origen jurídico; `validated` solo se usa si además se cumplen sus gates.

Estado de validación:

1. `unreviewed`
2. `source_reviewed`
3. `household_tested`
4. `aggregate_tested`
5. `production_validated`

No se salta evidencia. `aggregate_tested` exige alineación de periodo, definición, población y tolerancia.

## Flujo

1. **Crear ID estable**: slug descriptivo sin eslogan; nunca reutilizar el de otra interpretación.
2. **Registrar fuentes**: primaria cuando exista, snapshot/checksum, fecha, fragmento corto o localizador, licencia y estado.
3. **Extraer hechos**: separar valores explícitos de inferencias.
4. **Resolver cobertura**: ejercicio, fechas efectivas, territorio, régimen, población y baseline.
5. **Documentar ambigüedad**: lista material; crear variantes si más de una lectura es razonable.
6. **Sobrescribir mínimamente**: parámetros primero; fórmula solo si cambia la estructura.
7. **Probar**: fronteras, caso cero, caso afectado, no afectado, herencia, vigencia y reconciliación.
8. **Revisar**: fiscal, modelo y editorial.
9. **Validar registro**: `make policy-validate`.
10. **Sincronizar edge**: generar o verificar la proyección server-side; nunca copiar a mano una política sin gate.
11. **Publicar**: metodología humana, changelog y release metadata.

## Proyección para `edge_api`

El registro JSON es la autoridad editorial y fiscal. `lib/policy-catalog.ts` es una proyección ejecutable para la contingencia edge, no un segundo registro independiente. El build debe generarla o bloquear si divergen al menos:

- IDs/slugs, tax year, policy version, status, validation status y flag DEMO;
- baseline heredada, overrides ejecutables y unidades;
- IDs/títulos/URLs/fecha de fuentes;
- assumptions, limitations, nombres y descripciones públicas.

Una diferencia intencionada se modela como versión/limitación edge explícita, con revisión y test; no se resuelve dejando dos textos incompatibles. `make policy-validate` debe incluir este gate antes de publicar `edge_api`. La release acredita la proyección mediante source commit y digest del Worker y no atribuye al edge la validación de `python_api`.

## Campos obligatorios

Cada entrada declara:

```yaml
id: id-estable
slug: slug-publico
publicName: Nombre descriptivo
shortDescription: Resumen neutral
sponsorOrOrigin: origen
taxYear: YYYY
status: draft
validationStatus: unreviewed
territorialScope: []
fiscalRegimeScope: []
effectiveFrom: YYYY-MM-DD
effectiveTo: null
supersedes: null
inheritedBaseline: baseline-id
legalOrProposalSources: [source-id]
interpretationNotes: []
assumptions: []
parameterOverrides: {}
formulaOverrides: {}
knownLimitations: []
testCaseIds: []
aggregateBenchmarkIds: []
reviewedBy: []
lastReviewedAt: null
modelCompatibility: "version-range"
publicChangelog: []
```

El esquema versionado es la autoridad sobre tipos. El ejemplo no justifica valores vacíos en publicación.

## Fuentes

- Baseline legislada: norma primaria aplicable y material oficial de interpretación cuando ayude.
- Propuesta: documento original estable; una noticia solo como contexto.
- Declaración oral: registrar fecha, contexto y transcripción verificable; normalmente insuficiente para un modelo único.
- Enlaces: almacenar URL canónica y snapshot legalmente permitido; detectar rotura sin sustituir.

No copie extensamente contenido protegido. Guarde localizadores y una paráfrasis revisable.

## Ambigüedad y supuestos

Un supuesto contiene ID, cuestión, interpretación elegida, alternativas, impacto potencial, evidencia, autor, revisión y fecha de expiración/revisión. Si cambia el total materialmente, aparece de forma prominente en resultados.

Ejemplo conceptual: “reducir el impuesto para familias” no define familia, impuesto, cuantía, límite, fecha ni interacción. Debe permanecer no calculable o convertirse en variantes explícitas; no se rellena con una cifra conveniente.

## Reglas técnicas

- Dinero en céntimos; tipos o proporciones con unidad explícita.
- Intervalos efectivos sin solapamiento.
- Separar bases general/ahorro y cuotas estatal/autonómica.
- No duplicar toda la baseline.
- Sin parámetros fiscales en UI o route handlers.
- Redondeo en utilidades centrales y probado.
- Fórmulas puras, con rule IDs y dependencias.
- Un cambio retroactivo crea versión y changelog.

## Casos requeridos

- justo por debajo, en y por encima de cada frontera;
- cero y máximos/caps;
- hogar afectado y control no afectado;
- territorio soportado y no soportado;
- comienzo y fin de vigencia;
- escenario vacío igual a baseline;
- reconciliación exacta;
- interacción con otra regla material;
- error seguro si falta un hecho.

Un caso dorado registra fuente, revisión manual, valores intermedios, tolerancia justificada y diferencia conocida. Nunca se scrapea un simulador oficial sin permiso claro.

## Puertas de publicación

Se bloquea si:

- falta fuente o página metodológica;
- existe ambigüedad material no advertida;
- hay fechas solapadas o baseline incompatible;
- falla un caso dorado de un estado validado;
- el nombre sugiere respaldo, beneficio o perjuicio;
- un fixture DEMO carece de etiqueta;
- el escenario sintético llega a producción sin override explícito;
- no se actualizan versión y changelog.
- el catálogo edge diverge del registro o carece de evidencia de sincronización.

## Correcciones

No se reescribe en silencio una release. Se detiene el escenario si el riesgo es material, se crea una corrección versionada, se reejecutan casos y se publica alcance/fechas sin atribuir intención. Consulte [correcciones](feedback-corrections.md).
