# ADR-0005: Release acoplada a evidencia

- Estado: aceptada
- Fecha: 2026-07-13
- Propietarios: release, fiscal, QA y editorial

## Contexto

La versión de la aplicación no identifica por sí sola reglas, datos y geometrías. Además, los estados de una propuesta política y de su validación son dimensiones diferentes.

## Decisión

Cada release publica metadatos independientes de aplicación, modelo, commit del registro, pipeline y geografía, junto con resumen de validación y limitaciones. Los escenarios siguen un flujo editorial con revisión segregada. El CI bloquea fuentes ausentes, fechas solapadas, fixtures sintéticos en producción, contrato incompatible y documentación requerida ausente.

## Consecuencias

- Un resultado es reproducible aun cuando la interfaz evolucione.
- Una corrección de fuente o política crea versiones nuevas.
- El rollback incluye todos los artefactos compatibles.
- Las releases requieren coordinación humana además de pruebas automatizadas.
