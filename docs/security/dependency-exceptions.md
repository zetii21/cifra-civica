# Excepciones temporales de dependencias

Fecha: 2026-07-13. Expira: 2026-08-13 o antes de la primera publicación pública, lo que ocurra primero. Owner: ingeniería/security.

## Estado

`npm audit --audit-level=high` no reporta vulnerabilidades high/critical tras actualizar Next, Cloudflare Vite plugin, Vite y Wrangler. Permanecen 1 low y 7 moderate en cadenas transitivas sin actualización segura directa:

| Cadena | Alcance observado | Riesgo contextual | Medida temporal |
| --- | --- | --- | --- |
| Babel vía ESLint | Dev/lint | Lectura local mediante source map manipulado | CI usa código confiable del PR; no procesa source maps externos |
| js-yaml vía ESLint | Dev/lint | DoS con aliases YAML maliciosos | No lint de YAML no confiable; límites de CI |
| esbuild 0.18 vía drizzle-kit | Dev/migraciones | Dev server vulnerable | No ejecutar ese dev server ni exponerlo; DB no usada |
| PostCSS 8.4.31 embebido en Next | Build | Stringificación de CSS no confiable | Solo CSS versionado; sin CSS aportado por usuarios |

No se aplica `npm audit fix --force` porque propone downgrades incompatibles (incluido drizzle-kit antiguo/Next 9) que aumentarían riesgo.

## Python / Starlette

FastAPI fija actualmente Starlette `<1.0`, mientras cinco avisos de 2026 indican corrección únicamente en 1.0.1–1.3.1:

- `PYSEC-2026-161` y `PYSEC-2026-248`: reconstrucción host/path. La API no toma decisiones de autenticación, redirección o confianza a partir de `request.url`/Host.
- `PYSEC-2026-249`: límites ignorados en form-urlencoded. La API acepta contrato JSON y su middleware limita bytes antes de Pydantic; no llama `request.form()`.
- `PYSEC-2026-2281`: StaticFiles/UNC en Windows. El contenedor productivo es Linux y FastAPI no monta Starlette StaticFiles.
- `PYSEC-2026-2280`: métodos de `HTTPEndpoint`. La API usa rutas FastAPI con métodos explícitos, no subclases HTTPEndpoint.

`pip-audit` ignora **solo esos IDs** mientras las mitigaciones sigan verificadas. Caducan con esta excepción y se retiran cuando FastAPI admita una Starlette corregida. Click, python-dotenv y pytest usan fixes en Python ≥3.10; los pins condicionales mantienen únicamente compatibilidad local no productiva con Python 3.9. Producción/CI usa Python 3.12.

## Condiciones

- CI y Dependabot revisan semanalmente.
- Cualquier high/critical vuelve a bloquear.
- No introducir input no confiable en Babel/YAML/CSS/build.
- Dev servers solo en localhost/red de desarrollo.
- Retirar Drizzle/D1 si sigue sin uso al estabilizar el repositorio.
- Revalidar al aparecer versión upstream y antes del lanzamiento.

## Cierre

Actualizar lockfile con una versión compatible, ejecutar `npm audit`, build y tests completos, y eliminar la fila. Una renovación de excepción documenta nueva evidencia, alcance, owner y fecha; no es automática.
