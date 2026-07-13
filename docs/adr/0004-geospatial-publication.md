# ADR-0004: Publicación geográfica mediante artefactos

- Estado: aceptada
- Fecha: 2026-07-13
- Propietarios: geografía, datos y privacidad

## Contexto

La cartografía necesita rendimiento, cacheabilidad y controles de divulgación. Servir geometrías nacionales completas o calcular celdas pequeñas durante la navegación expone precisión aparente y riesgo de reidentificación.

## Decisión

Generar offline agregados divulgables, un manifiesto y teselas MVT versionadas. El servicio público solo lee esos artefactos. Toda métrica declara tipo, vintage, cobertura, incertidumbre y estado de supresión. Los fixtures sintéticos se marcan y se presentan con watermark DEMO.

No se une una petición personal con una geografía publicada. Los códigos territoriales en métricas operativas se evitan por su cardinalidad; las consultas públicas se observan solo de forma agregada y opcional.

## Consecuencias

- Navegación rápida y caché inmutable por versión.
- Correcciones producen una nueva versión, no mutación silenciosa.
- Los datos deben reconstruirse para cambiar umbral o geometría.
- Una celda suprimida permanece sin valor; el cliente no intenta reconstruirla.
