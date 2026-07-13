# Checklist de seguridad

Marcar con evidencia por entorno. `N/A` requiere justificación y owner.

## Diseño y cambios

- [ ] Diagrama de flujo y DPIA coinciden con implementación.
- [ ] No hay nueva finalidad, cuenta, sync, tracking, encuesta o campaña.
- [ ] Campos nuevos tienen necesidad, clasificación y retención.
- [ ] Threat model revisado para nueva frontera/tercero.
- [ ] Contratos rechazan propiedades desconocidas y valores fuera de rango.
- [ ] Territorio/ejercicio/escenario incompatible falla cerrado.

## Aplicación web

- [ ] CSP sin `unsafe-eval` en producción y conexiones allowlisted.
- [ ] HSTS, nosniff, frame-ancestors, Referrer-Policy y Permissions-Policy.
- [ ] Salida codificada; HTML no confiable sanitizado.
- [ ] Ninguna entrada personal en URL, analytics, error SDK o filename.
- [ ] IndexedDB desactivada por defecto, visible y borrable.
- [ ] Exportación previsualizada y CSV protegido contra fórmulas.
- [ ] Dependencias de mapa se cargan solo en explorer.
- [ ] El bundle del navegador no contiene ni ejecuta el motor fiscal.

## API y motor

- [ ] Solo POST para simulación; Content-Type y tamaño limitados.
- [ ] Timeout, escenarios máximos y rate limit.
- [ ] Logging allowlist probado con canarios.
- [ ] Excepciones no devuelven stack, ruta, fórmula interna ni input.
- [ ] `Cache-Control: no-store` en respuestas personales.
- [ ] Sin tablas, ficheros, colas o caché de hogares.
- [ ] Trazas de desarrollo deshabilitadas/saneadas en producción.
- [ ] Registro montado read-only y manifest verificado.
- [ ] Determinismo, reconciliación y redondeo probados.
- [ ] `X-Cifra-Engine`, etiqueta UI y metadata declaran el mismo backend.
- [ ] Upstream configurado y caído falla cerrado, sin cambio a `edge_api`.
- [ ] Edge-only tiene model version, advertencia e incertidumbre propias.

## Datos y teselas

- [ ] Fuente/licencia/checksum/lineage completos.
- [ ] No hay microdatos o material restringido en Git/imagen.
- [ ] Supresión y derivabilidad revisadas.
- [ ] DEMO visible en dataset, manifest, API y UI.
- [ ] Servicio sirve tipos y CORS esperados, sin directory listing.
- [ ] Artefacto inmutable por version/hash.

## Infraestructura

- [ ] TLS moderno y redirect HTTPS.
- [ ] Non-root, read-only, cap drop, no-new-privileges.
- [ ] Egress mínimo; API no alcanza URLs arbitrarias.
- [ ] Secretos en gestor, no env dump/imagen/Git.
- [ ] DB/objeto privado sin acceso público y roles mínimos.
- [ ] WAF/proxy/CDN body logging y caching revisados.
- [ ] CORS contiene solo orígenes necesarios.
- [ ] `SIMULATION_API_BASE_URL` es interna, fija por despliegue y no acepta input del usuario.
- [ ] Backups y logs tienen TTL de la matriz.
- [ ] Health separado de readiness y sin secretos.

## Supply chain y CI

- [ ] Lockfiles revisados; audit sin vulnerabilidad explotable alta/crítica.
- [ ] Actions fijadas a versión/commit y permisos mínimos.
- [ ] Secret scan y SBOM para imágenes.
- [ ] Imágenes escaneadas y base soportada.
- [ ] Build reproducible; metadatos/checksums/provenance adjuntos.
- [ ] Rama y entornos protegidos; deploy requiere aprobación.
- [ ] Rollback probado con artefactos compatibles.

## Release

- [ ] Tests unit/API/E2E/a11y/privacy/geo pasan.
- [ ] Casos dorados y benchmark según estado.
- [ ] Políticas, fuentes y metodología cumplen gates.
- [ ] Inventario y conteos de modelo generados.
- [ ] DPIA/terceros/retención sin pendiente bloqueante.
- [ ] Limitaciones y changelog públicos.
- [ ] Contacto privado de seguridad habilitado.
- [ ] Simulacro de incidente/rollback vigente.
