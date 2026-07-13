# Política de seguridad

## Versiones soportadas

| Versión | Soporte |
| --- | --- |
| Última versión publicada | Correcciones de seguridad |
| Rama principal sin publicar | Mejor esfuerzo |
| Versiones anteriores | Sin soporte salvo aviso |

## Notificación privada

Use **Private vulnerability reporting** en la pestaña Security del repositorio de GitHub. Si todavía no está habilitado, contacte de forma privada con la persona propietaria del repositorio y solicite un canal seguro antes de compartir detalles. No abra un issue público.

Incluya una descripción, impacto, versión o commit, pasos mínimos de reproducción y una corrección sugerida si la conoce. Elimine de la evidencia salarios, domicilios, discapacidad, prestaciones, identificadores, tokens y cualquier cuerpo de simulación real.

Objetivos de respuesta, no garantías contractuales:

- acuse inicial en 3 días laborables;
- evaluación y severidad en 7 días laborables;
- plan de mitigación para incidencias críticas en 10 días laborables;
- publicación coordinada una vez que exista una corrección desplegada.

## Alcance prioritario

- exposición o persistencia de entradas fiscales;
- datos personales en logs, analítica, URLs, exportaciones o cachés;
- ejecución remota, inyección, SSRF, XSS o evasión de validación;
- acceso a secretos, artefactos restringidos o pipelines de publicación;
- manipulación no autorizada de políticas, fuentes o metadatos de versión;
- resultados que aplican silenciosamente un régimen territorial incorrecto;
- dependencias o contenedores vulnerables con una ruta explotable.

No son vulnerabilidades por sí solas las diferencias fiscales ya declaradas como limitaciones, el uso de fixtures DEMO visibles o la falta de soporte de un territorio correctamente bloqueado.

## Tratamiento

El equipo registra el incidente sin copiar datos sensibles, preserva evidencia mínima, revoca credenciales cuando corresponda y sigue [la respuesta a incidentes](docs/incident-response.md). Los cambios urgentes mantienen revisión independiente y una nota de versión; la urgencia no autoriza ocultar una modificación de modelo.
