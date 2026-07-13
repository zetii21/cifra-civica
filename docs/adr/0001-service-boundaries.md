# ADR-0001: Fronteras de servicios

- Estado: aceptada
- Fecha: 2026-07-13
- Propietarios: ingeniería y seguridad

## Contexto

La interfaz, el cálculo personal y las capas geográficas tienen perfiles distintos de ejecución, privacidad y caché. Un único proceso facilitaría que una optimización de mapa o una capa de persistencia alcanzase accidentalmente entradas fiscales.

## Decisión

Mantener una web Next/React, una API FastAPI sin estado, un motor/registro determinista y un servicio de teselas basado en artefactos publicados. Los pipelines se ejecutan fuera de la ruta de petición. Los contratos públicos se versionan bajo `/api/v1`.

## Consecuencias

- La web puede desplegarse sin librerías fiscales o geoespaciales pesadas.
- La API escala horizontalmente y se reinicia sin perder datos personales.
- Las teselas admiten caché pública; las simulaciones usan `no-store`.
- Existen tres artefactos y checks de compatibilidad adicionales.
- Docker Compose reproduce las fronteras localmente.

## Alternativas descartadas

- **Todo en Next**: mezcla parámetros fiscales y ciclo de frontend, y dificulta pruebas Python de reglas.
- **Microservicio por impuesto**: coordinación y observabilidad desproporcionadas para el MVP.
- **Persistir peticiones para depurar**: contradice minimización; se usan fixtures sintéticos y request IDs.
