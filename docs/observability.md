# Observabilidad segura

## Eventos estructurados

Ejemplo permitido:

```json
{
  "timestamp": "ISO-8601",
  "level": "INFO",
  "service": "web-worker",
  "requestId": "random",
  "endpoint": "/api/v1/simulations/compare",
  "statusCode": 200,
  "durationMs": 0,
  "calculationBackend": "python_api",
  "modelVersion": "version",
  "scenarioIds": ["public-id"],
  "errorCategory": null
}
```

El cero es ilustrativo. El logger usa allowlist; no serializa excepciones con locals, Request/Response ni modelos Pydantic. `calculationBackend` es la categoría de baja cardinalidad `python_api` o `edge_api`, nunca una URL de upstream.

## Métricas

- `http_requests_total{service,route,status_class}`
- `http_request_duration_seconds{service,route}`
- `simulation_duration_seconds{model_version,scenario_count}`
- `simulation_errors_total{model_version,error_category}`
- `simulation_backend_responses_total{calculation_backend,status_class}`
- `simulation_backend_mismatch_total{expected_backend,observed_backend}`
- `policy_registry_load{version,status}`
- `benchmark_deviation{benchmark_id,model_version}` solo resultados públicos;
- `tile_requests_total{layer,z_band,status_class}`
- `data_vintage_age_days{dataset_id}`

No usar request ID como label. `scenario_count` es 1–4, no IDs del hogar. Los geography codes no son labels operativas.

## Dashboard

Panel 1: disponibilidad/latencia/error por servicio, release y backend previsto.

Panel 2: cálculo por model version/backend, duración, mismatch y categorías seguras.

Panel 3: registry/policy load, benchmarks y expiración de fuentes.

Panel 4: teselas por layer/zoom band, errores y manifest version.

Panel 5: privacidad: resultado del canary, schema del logger, TTL y terceros (estado, no payload).

## Trazas

Desactivadas para cuerpos/variables personales. Si se usa tracing distribuido, propaga únicamente un trace ID aleatorio, nombre de ruta templado, status y tiempos. Deshabilitar captura de headers, query, body y locals. Sampling nunca depende de contenido fiscal.

## Validación

En staging completo, una petición con canarios sintéticos debe recorrer navegador, Worker y FastAPI, devolver `X-Cifra-Engine: python_api` y mostrar `python_api`. Buscar esos tokens en logs, métricas, traces, errores y proveedores; cualquier aparición bloquea producción. El test no almacena el body como artefacto CI.

El modo edge-only se prueba por separado y debe devolver `edge_api`, su model version y advertencia. Un canario con upstream configurado pero inalcanzable debe terminar en error seguro y producir cero respuestas `edge_api`; cualquier cambio automático de backend bloquea producción.
