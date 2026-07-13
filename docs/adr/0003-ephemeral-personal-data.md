# ADR-0003: Cálculo personal efímero

- Estado: aceptada
- Fecha: 2026-07-13
- Propietarios: privacidad, seguridad y producto

## Contexto

Ingresos, discapacidad, prestaciones y composición familiar pueden generar riesgo alto al combinarse. El propósito es devolver un cálculo solicitado, no crear un historial ni inferir opinión política.

## Decisión

No exigir cuenta ni persistir peticiones o respuestas personales. El API calcula en memoria, devuelve un request ID aleatorio no derivado de la entrada y descarta referencias al cuerpo. Se prohíben cuerpos en logs, cachés, trazas, URLs, analítica y sistemas de error.

El guardado local está desactivado por defecto y solo se activa mediante una acción explícita en el dispositivo, con borrado accesible. Compartir requiere previsualizar un resumen redondeado y excluye detalles sensibles por defecto.

## Consecuencias

- No existe recuperación entre dispositivos ni soporte basado en historiales reales.
- La depuración usa casos sintéticos reproducibles y métricas técnicas.
- Backups y solicitudes de borrado no contienen simulaciones del servidor.
- Cualquier cuenta o sincronización futura requiere un ADR y una DPIA nuevos.
