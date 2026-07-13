# ADR-0002: Grafo determinista compatible con OpenFisca

- Estado: aceptada
- Fecha: 2026-07-13
- Propietarios: ingeniería fiscal y microsimulación

## Contexto

OpenFisca Core ofrece entidades, periodos y resolución de variables, pero integrarlo en el MVP estrecho exige adaptar esas abstracciones antes de disponer de cobertura estatutaria validada. El contrato del producto requiere céntimos enteros, herencia JSON de escenarios y trazas controladas.

## Decisión

Implementar un grafo compatible conceptualmente con OpenFisca mediante:

- variables con nombres de dominio;
- funciones puras y fechadas;
- parámetros fechados fuera de las fórmulas;
- resolución explícita de dependencias;
- herencia baseline/escenario;
- redondeo centralizado y trazabilidad determinista.

OpenFisca Core no es dependencia inicial. La API de variables y parámetros será la frontera sustituible una vez que exista un corpus suficiente de casos dorados.

## Consecuencias

- Menos integración y dependencias en el MVP.
- Contrato de enteros y trazas directamente auditable.
- El equipo debe construir validación temporal, detección de ciclos y semántica de entidades.
- No puede afirmarse compatibilidad numérica con EUROMOD u OpenFisca sin benchmark.
- Migrar exige demostrar equivalencia de resultados y metadatos, no solo de totales.

## Criterio de revisión

Reconsiderar al ampliar periodos históricos, entidades complejas o cobertura de beneficios cuando el coste del grafo propio supere la adaptación. Ninguna migración cambia una política publicada sin nueva versión de modelo.
