# Limitaciones conocidas

Este documento debe publicarse con cada release. “No soportado” es una protección, no un error que deba ocultarse.

## Naturaleza de la estimación

- No es Renta Web, una declaración ni un cálculo oficial.
- No sustituye asesoramiento fiscal o jurídico.
- Trabaja con hechos simplificados que introduce la persona, no con expedientes administrativos.
- Un cambio de renta disponible modelada no captura preferencias, calidad de servicios públicos ni efectos macroeconómicos.
- Los equivalentes mensuales dividen o presentan un promedio anual; no predicen la tesorería exacta de cada mes.

## Cobertura territorial

- Navarra: IRPF foral completo fuera del MVP; no recibe reglas comunes.
- País Vasco: regímenes forales completos fuera del MVP; no reciben reglas comunes.
- Canarias: la eventual cobertura de impuestos directos no incluye automáticamente IGIC ni incidencia de consumo.
- Ceuta y Melilla: tratamiento parcial/no soportado hasta revisión de especialidades.
- Municipio: se usa para contexto; no activa deducciones locales sin regla y hechos suficientes.

## Cobertura fiscal

Quedan fuera o se muestran como aproximación explícita:

- IVA, IGIC, impuestos especiales e incidencia detallada de consumo;
- patrimonio, sucesiones y donaciones;
- todas las deducciones regionales de nicho;
- hechos que requieren documentos no solicitados;
- reconstrucción histórica de derechos contributivos;
- reglas forales completas;
- efectos dinámicos de empleo, precios, migración o comportamiento;
- beneficios en especie y valor individual de servicios públicos.

El trabajo autónomo puede requerir una aproximación cuando no se recopilan bases o hechos suficientes. Las prestaciones y pensiones solo se modelan cuando sus variables observables y reglas están documentadas.

## Propuestas electorales

Una propuesta puede carecer de umbral, fecha, interacción, financiación o ámbito. El simulador no completa esos huecos como hechos. Las variantes interpretativas llevan supuestos y no deben resumirse como “la política del partido” sin matiz.

El sistema no estima intención de voto, no clasifica ideología, no recomienda partido y no publica encuestas de respuestas.

## Datos agregados y mapas

- Estadística oficial y estimación modelada no son intercambiables.
- Declarantes, hogares, personas y unidades fiscales son poblaciones distintas.
- Encuestas tienen error muestral, no respuesta, desfase y variables aproximadas.
- Calibrar un total no valida toda la distribución.
- Los límites y códigos geográficos cambian entre vintages.
- Áreas pequeñas pueden estar suprimidas o no alcanzar calidad suficiente.
- El color del mapa no implica precisión por debajo del valor y estado mostrados.
- Fixtures DEMO no describen España y deben llevar watermark.

## Validación

La cobertura de pruebas demuestra comportamiento frente a evidencia seleccionada, no corrección universal. Un estado `household_tested` no implica benchmark agregado; `aggregate_tested` no demuestra cada hogar.

## Tecnología y acceso

La disponibilidad de fuentes, licencias, endpoints y geometrías puede cambiar. Las releases usan snapshots y checksums para reproducir lo que fue revisado. Un enlace roto no se sustituye silenciosamente.

El despliegue completo usa el motor fiscal principal de FastAPI (`python_api`). Un despliegue sin upstream puede usar una API de contingencia server-side (`edge_api`): es aproximada, lleva una model version y advertencia propias y no acredita paridad fiscal universal con FastAPI. El backend se muestra en resultados y metadatos; un upstream configurado que falla devuelve error y no cambia silenciosamente de motor. Ningún cálculo fiscal se ejecuta en el navegador.

## Pendientes de una release

Cada release rellena además:

| Campo | Valor |
| --- | --- |
| Versión del modelo | metadatos de release |
| Backend de cálculo | `python_api` / `edge_api` en metadatos y UI |
| Ejercicios soportados | registro publicado |
| Comunidades validadas | matriz de validación |
| Desviaciones de casos dorados | resumen de validación |
| Benchmarks agregados | aprobado / fallido / no evaluado |
| Fuentes con revisión pendiente | inventario de release |
| Incidencias abiertas materiales | changelog y tracker |
