# Guía de despliegue

## Artefactos

Una release produce por el mismo commit:

- imagen/build web + Worker;
- para `python_api`, imagen API + registro de políticas compatible;
- para `edge_api`, bundle Worker + catálogo edge sincronizado e inventariado;
- imagen/artefacto de teselas;
- release metadata e inventario exacto;
- SBOM, checksums y resumen de validación.

No se reconstruye un artefacto para promoción: el digest probado se mueve de staging a producción. La unidad promovida es el conjunto de digests más backend/configuración y metadatos aprobados; no se cambia un binding después de validar como si fuera el mismo despliegue.

## Entornos

| Entorno | Datos | Escenarios DEMO | Acceso |
| --- | --- | --- | --- |
| Local | Fixtures exclusivamente | Sí, visible | Desarrollador |
| CI | Fixtures deterministas | Sí | Jobs efímeros |
| Staging | Públicos/fixtures autorizados | Sí, watermark | Equipo/revisión |
| Producción | Solo artefactos aprobados | No por defecto | Público |

Staging no acepta datos personales reales. Producción no habilita trazas de cálculo.

## Local con Docker

```bash
cp .env.example .env
docker compose build
docker compose up
```

Verifique:

```bash
curl --fail http://localhost:3000/
curl --fail http://localhost:8000/api/v1/health
curl --fail http://localhost:8000/api/v1/ready
curl --fail http://localhost:3102/healthz
```

Compose aplica usuarios no root, filesystem read-only, capacidades eliminadas y tmpfs. Es una referencia local; producción debe expresar controles equivalentes como infraestructura versionada.

## Variables

La [.env.example](../.env.example) documenta valores no secretos. Producción debe fijar:

- `APP_ENV=production`;
- URL interna del API para el proxy web cuando el backend aprobado sea `python_api`; su ausencia solo es válida para una release declarada `edge_api`;
- orígenes CORS exactos;
- límites de request y cálculo;
- `ENABLE_CALCULATION_TRACE=false`;
- `ENABLE_SYNTHETIC_SCENARIOS=false`;
- versiones inmutables y build date.

No guardar claves en `.env` de servidores o GitHub. Usar gestor de secretos e identidad federada/OIDC. Una variable desconocida o requerida ausente debe impedir el arranque.

El navegador usa rutas del mismo origen para el API y las teselas públicas. `SIMULATION_API_BASE_URL` se resuelve en runtime únicamente dentro del proceso web y nunca se incorpora al bundle cliente. Así, las URL de entorno no obligan a reconstruir la imagen y el mismo digest probado puede promocionarse.

La selección del backend es configuración de despliegue, no fallback por petición:

- con `SIMULATION_API_BASE_URL`, el Worker usa exclusivamente FastAPI; una URL inválida, timeout o indisponibilidad devuelve un error seguro y **no** cambia a edge;
- sin `SIMULATION_API_BASE_URL`, el despliegue es deliberadamente edge-only y ejecuta la contingencia aproximada en el servidor Worker;
- ambos modos responden por la ruta del mismo origen y declaran `X-Cifra-Engine: python_api` o `edge_api`; la interfaz muestra ese estado;
- ningún modo ejecuta aritmética fiscal en el bundle del navegador.

El despliegue completo de producción electoral debe preferir `python_api`, que concentra la implementación fiscal principal y su validación. Un despliegue `edge_api` publica su model version propia, incertidumbre alta y la limitación de que no acredita paridad fiscal universal con FastAPI.

## Preflight de producción

```bash
make ci
APP_ENV=production ENABLE_SYNTHETIC_SCENARIOS=false make release-check
docker compose build
```

Además:

- revisión fiscal/editorial/QA firmada;
- DPIA, responsable, base jurídica, terceros y transferencias aprobados;
- fuentes/licencias y snapshots disponibles;
- Private vulnerability reporting habilitado;
- DNS/TLS/CSP/CORS/no-store y body logging probados;
- `calculationBackend` de los metadatos, `X-Cifra-Engine` y la etiqueta visible coinciden con el backend previsto;
- con upstream configurado, una caída devuelve error y nunca cambia silenciosamente a `edge_api`;
- retención/alertas/rollback configurados;
- teselas DEMO ausentes o inequívocamente separadas.

## Red

Solo web, API y teselas reciben tráfico público necesario. Pipelines, registro, objetos fuente y bases analíticas permanecen privados. La API no necesita egress arbitrario; las fuentes se descargan en jobs allowlisted separados.

El CDN puede cachear assets y teselas por digest. No cachea POST ni respuestas personales. El WAF/proxy no registra cuerpos, query strings completas o headers de entrada no allowlisted.

## Cabeceras mínimas

- Content-Security-Policy con `default-src 'self'` y directivas específicas;
- Strict-Transport-Security tras validar HTTPS;
- X-Content-Type-Options: nosniff;
- Referrer-Policy: no-referrer o strict-origin según revisión;
- Permissions-Policy deshabilitando sensores innecesarios;
- frame-ancestors en CSP;
- `Cache-Control: no-store` para simulación.

Pruebe las cabeceras en el edge real, no solo en la app.

## Estrategia de publicación

1. congelar commit/registro/datos/geografía;
2. ejecutar CI y generar metadatos/checksums/SBOM;
3. desplegar los digests en staging;
4. smoke funcional, accesibilidad, privacidad y reconciliación;
5. aprobación humana;
6. desplegar API/registro compatibles y después web/Worker para `python_api`, o el Worker/catálogo edge inventariado para `edge_api`; desplegar teselas compatibles en ambos;
7. verificar health, readiness y journey canario sintético;
8. publicar changelog, metodología y limitaciones;
9. observar error/latencia sin inputs.

## Rollback

Conservar al menos el último conjunto compatible de digests, configuración y metadata. Si falla integridad fiscal o privacidad, retirar escenario o tráfico primero; después restaurar **el conjunto completo** por digest: web/Worker + API + registro + teselas para `python_api`, o web/Worker + catálogo edge + teselas para `edge_api`. No mezclar una web nueva con contrato/backend antiguo ni retirar el binding para cambiar de modo durante un rollback.

No hacer rollback a una política jurídicamente incorrecta solo porque el binario funciona: mostrar `model_unavailable` o suspender el escenario hasta una release revisada.

## Migraciones

El cálculo personal no tiene DB. Una futura migración analítica usa backup, plan forward/backward, rol mínimo y verificación de que no existe tabla de peticiones/respuestas. `make migration-check` detecta drift cuando el esquema persistente deja de estar vacío.
