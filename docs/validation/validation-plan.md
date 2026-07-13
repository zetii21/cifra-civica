# Plan de validación

## Objetivo

La validación responde qué se comprobó, con qué evidencia, en qué versión y con qué tolerancia. No convierte cobertura parcial en exactitud general.

## Capas

| Capa | Evidencia | Gate |
| --- | --- | --- |
| Esquema | JSON Schema/Pydantic/Zod, enumeraciones, límites | Todo input inválido falla de forma segura |
| Unidad de regla | Fronteras, caps, fechas, redondeo | Fórmula/parámetro afectado cubierto |
| Propiedades | Determinismo, finitud, herencia, reconciliación | Ninguna violación |
| Caso dorado | Ejemplo manual oficial permitido | Diferencia dentro de tolerancia documentada |
| API | Contrato, errores, tamaño, concurrencia | Sin stack/body/persistencia |
| Worker/routing | Proxy fijo, edge-only, cabeceras, timeout | Backend previsto visible; sin cambio silencioso |
| UI/E2E | Navegador→Worker→FastAPI, navegación, exportación | Journey principal pasa como `python_api` |
| Accesibilidad | axe + teclado + revisión manual | Sin violaciones bloqueantes |
| Privacidad | logs, URLs, storage, terceros | Ninguna fuga |
| Agregado | AEAT/INE/SS/EUROMOD alineado | Desviación aprobada y explicada |
| Geografía | códigos, joins, supresión, MVT | Sin geometrías/celdas inválidas |
| Operación | contenedor, health/readiness, rollback | Artefacto desplegable |

El barrido masivo y los surrogates se rigen por el [laboratorio estadístico](statistical-lab.md); no sustituyen casos dorados ni benchmarks oficiales.

## Backend y enrutamiento

La validación separa dos perfiles:

- `python_api`: E2E del despliegue completo debe recorrer navegador→Worker del mismo origen→FastAPI y demostrar la cabecera `X-Cifra-Engine: python_api` y la etiqueta visible;
- `edge_api`: pruebas unitarias verifican contrato estricto, límites de tamaño, métodos/content type, `no-store`, errores seguros, reconciliación y advertencia/model version propias. Esto no se publica como paridad fiscal universal.

Pruebas negativas obligatorias comprueban que un upstream configurado pero inválido, lento o caído devuelve error seguro sin ejecutar edge; que la ausencia deliberada del binding selecciona edge-only; y que los chunks del navegador no contienen el motor fiscal. El mismo input y las mismas versiones son deterministas dentro de un backend, pero no se presupone igualdad entre backends distintos.

## Unitarias de reglas

Cubrir bandas, mínimos personales/familiares, conjunta, parámetros autonómicos soportados, elegibilidad/caps, cotizaciones, cero, múltiples rentas, pensiones, desempleo, redondeo, transiciones, herencia e incompatibilidades.

No afirmar monotonicidad simple cuando retiros de prestaciones o créditos crean saltos legítimos. Las propiedades válidas son:

- nunca NaN/infinito;
- misma entrada + mismas versiones = misma salida;
- escenario vacío = baseline;
- componentes reconcilian;
- territorio no soportado nunca devuelve `supported`;
- parámetros caducados no se aplican;
- toda política publicada tiene procedencia.

## Casos dorados

Formato mínimo:

| Campo | Contenido |
| --- | --- |
| Case ID / versión | Identificador inmutable |
| Ejercicio y territorio | Periodo/regla exactos |
| Hechos del hogar | Fixture sintético derivado, sin persona real |
| Intermedios esperados | Variables relevantes |
| Resultado esperado | Componentes y total |
| Fuente y fecha | Referencia comprobable |
| Método de revisión | Manual/doble revisión |
| Tolerancia | Por componente y motivo |
| Diferencias conocidas | Explicación, no ocultación |
| Reviewer | Rol o identidad de repositorio |

Actualizar una norma no muta el caso anterior: crea versión.

## Benchmark agregado

Antes de comparar:

1. alinear periodo fiscal y fecha de ingreso;
2. alinear población (personas, hogares, declaraciones o unidades fiscales);
3. alinear territorio y cobertura de rentas;
4. aplicar pesos y filtros documentados;
5. definir métrica/tolerancia antes de observar el resultado;
6. explicar residuos por cobertura, datos o modelo.

Se registran totales, distribución/deciles cuando proceda, tasa de cobertura, desviaciones y responsables. Sin dataset licenciado disponible, el estado es `not_assessed`, no passed.

## Geografía y divulgación

- unicidad y versión de códigos;
- CRS y geometrías válidas;
- tasa de join y lista de no emparejados;
- ausencia de propiedades personales;
- supresión y celdas derivables;
- watermark de DEMO;
- manifiesto/teselas con checksum;
- smoke test por nivel y zoom.

## Privacidad

Pruebas canario usan nombres de campos y números inequívocamente sintéticos, ejecutan una simulación y capturan logs, errores, URL, headers, storage y requests a terceros. Fallan si aparece un cuerpo, renta, municipio+importe, discapacidad, prestación o exportación no confirmada.

## Accesibilidad

Automatizar axe, labels, asociación de errores y smoke por teclado. Revisar manualmente orden de foco, lector de pantalla, tablas/gráficos alternativos, zoom/reflow, contraste, movimiento reducido y mapa no esencial. Consulte [accesibilidad](../accessibility.md).

## Severidad y decisión

| Severidad | Ejemplo | Release |
| --- | --- | --- |
| Bloqueante | fuga, régimen incorrecto, total no reconcilia, fuente ausente | Bloqueada |
| Alta | caso dorado material, recorrido inaccesible, política mal etiquetada | Bloqueada |
| Media | explicación secundaria o cobertura no material documentada | Requiere aceptación y limitación |
| Baja | copy/estética sin cambio semántico | Puede diferirse |

La aceptación de una desviación indica owner, motivo, alcance, expiración y issue; no puede dispensar una fuga o cálculo territorial engañoso.

## Informe de release

Publicar:

- matriz versión × ejercicio × territorio × componente;
- casos ejecutados/pasados/fallidos;
- benchmark y tolerancias;
- auditoría de accesibilidad/privacidad;
- artefactos/checksums;
- desviaciones y limitaciones;
- backend, model version, inventario y evidencia de validación separados;
- firmas de revisión fiscal, QA y release.
