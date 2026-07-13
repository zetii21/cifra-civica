# Runbook de operaciones

## Principios

- Operar versiones, no resultados individuales.
- Observar endpoint/status/duración/versiones, no hechos del hogar.
- Fallar cerrado ante política, territorio o contrato incompatible.
- Una incidencia fiscal se trata como integridad de producto, aunque no sea ciberataque.

## Servicios

| Servicio | Health | Ready | Dependencias |
| --- | --- | --- | --- |
| Web + Worker | `GET /` | página, assets y backend esperado | FastAPI configurado o modo edge-only declarado; teselas |
| API | `GET /api/v1/health` | `GET /api/v1/ready` | registry, baseline y parámetros cargados |
| Teselas | `GET /healthz` | mismo o ready dedicado | manifest/artefacto legible |

Health confirma proceso; readiness confirma capacidad de servir la versión esperada. Ninguno devuelve secretos, rutas o datos personales.

El Worker expone `/api/v1/simulations/compare` en el mismo origen. Con `SIMULATION_API_BASE_URL`, solo reenvía a FastAPI y cualquier timeout/indisponibilidad falla cerrado. Sin el binding, ejecuta deliberadamente `edge_api`. La operadora declara el backend previsto en metadatos y comprueba `X-Cifra-Engine`; nunca trata un cambio de backend como degradación automática aceptable.

## SLIs propuestos

La operadora ratifica SLOs tras medir beta:

- disponibilidad de respuestas no 5xx por servicio;
- p50/p95/p99 de cálculo y teselas;
- tasa de `calculation_failed` y `model_unavailable`;
- respuestas y mismatch por `calculationBackend` esperado;
- carga correcta de registry y tile manifest;
- drift de benchmarks;
- frescura de source/data/geography visible;
- Core Web Vitals agregados sin identificador;
- ratio de flujos completados solo si puede medirse sin inputs/identidad.

Etiquetas permitidas: service, endpoint templated, status class, model version, calculation backend, scenario version y error category. Prohibidas: importes, edad, hogar, discapacidad, beneficio, municipio, URL de upstream y request/response.

## Alertas

| Alerta | Umbral inicial | Primera acción |
| --- | --- | --- |
| API no ready | 2 checks consecutivos | Inspeccionar carga de registry/digest |
| Backend inesperado | Cualquier `X-Cifra-Engine` distinto del metadata | Detener rollout; revisar binding/proxy, sin aceptar fallback |
| Error de cálculo | Desviación significativa sobre baseline | Comparar por model version, sin inputs |
| Latencia alta | p95 sostenido sobre timeout budget | Capacidad/dependencia; no activar body tracing |
| Registry load failed | Cualquier release/instancia | Detener rollout |
| Benchmark drift | Fuera de tolerancia aprobada | Bloquear release/retirar validación |
| Tile manifest ausente | Cualquier instancia | Volver a artefacto previo |
| Privacy canary | Cualquier match | SEV-1 y cortar logging |
| Fuente/vintage caducado | Fecha de revisión vencida | Marcar y planificar actualización |

Los umbrales numéricos de tráfico se calibran con datos operativos; no se inventan en el repositorio.

## Comprobación diaria

1. estado de despliegues y digests;
2. health/readiness;
3. errores/latencia por versión;
4. carga de registry y metadata;
5. journey sintético y `X-Cifra-Engine` esperado;
6. colas de pipeline separadas;
7. expiración de fuentes/certificados/dependencias;
8. alertas de seguridad y feedback material.

## Backend inesperado o upstream caído

1. comparar `calculationBackend` del metadata con `X-Cifra-Engine` y la etiqueta de UI;
2. verificar que `SIMULATION_API_BASE_URL` existe solo cuando el despliegue aprobado es `python_api`;
3. si el upstream configurado falla, mantener el error seguro: no retirar el binding para recuperar servicio con edge;
4. comprobar health/readiness, DNS interno, TLS y timeout del upstream sin capturar bodies;
5. restaurar la configuración/digest aprobados o declarar una release edge-only separada con sus limitaciones;
6. tratar cualquier cambio silencioso como incidente de integridad.

## API no ready

1. confirmar digest y variables de versión;
2. leer error categórico sin habilitar body logs;
3. verificar schema/checksum/compatibilidad del registro;
4. probar con fixture sintético conocido;
5. si es release nueva, detener rollout y volver al conjunto anterior;
6. si la baseline vigente es inválida, suspender cálculo y mantener metodología.

## Aumento de errores

1. segmentar solo por endpoint/status/model/scenario;
2. reproducir con golden fixtures, nunca pedir body real;
3. comprobar timeout/capacidad y cambios de dependencias;
4. distinguir invalid input esperado de fallo interno;
5. rollback o hotfix según integridad;
6. abrir informe y actualizar tests.

## Política o cifra incorrecta

1. ocultar/despublicar el escenario si es material;
2. conservar release/digest y evidencia;
3. revisión fiscal independiente;
4. estimar periodos/territorios/componentes afectados sin consultar hogares;
5. versión corregida + casos + changelog;
6. aviso público de corrección, sin minimizar ni atribuir intención.

## Teselas

1. validar manifest/checksum/geography version;
2. smoke en varios zooms/códigos;
3. comprobar que no se mezclaron vintages;
4. restaurar artefacto anterior;
5. si falla supresión, retirar capa/CDN inmediatamente e invalidar caché.

## Capacidad y DoS

Aplicar rate limit y concurrencia en perímetro, mantener timeout y límite de escenarios/cuerpo. Escalar instancias sin agregar cache personal. Degradar explorer o escenarios secundarios antes que eliminar validación.

## Jobs y datos

Un fallo de pipeline no cambia el artefacto publicado. Reintentar desde snapshot inmutable, verificar checksums y promover solo tras controles. Nunca ejecutar una descarga externa desde la API personal.

## Cambio de guardia

Registrar hora, impacto, versión/digest, acciones, owner y próxima decisión. No copiar bodies, capturas personales o credenciales al ticket. Para incidentes, seguir [incident-response.md](incident-response.md).
