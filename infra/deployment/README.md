# Contrato de despliegue

Cada plataforma debe producir un JSON que cumpla `release-metadata.schema.json` y asociarlo a los digests promovidos. El job de release:

1. genera el inventario del motor desde código/registro;
2. ejecuta validación y resume passed/failed/not assessed;
3. obtiene commits/versiones de datos y geografía;
4. calcula SHA-256 de imágenes/artefactos;
5. valida el JSON;
6. publica JSON, SBOM y changelog junto a la release;
7. declara `calculationBackend` y verifica que coincide con `X-Cifra-Engine` y la UI;
8. inyecta las mismas versiones en health/metodología.

Staging y producción consumen el mismo digest. Solo cambian configuración y secretos aprobados. Consulte [la guía de despliegue](../../docs/deployment.md).
