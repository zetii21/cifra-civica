# Matriz de retención

Los periodos son máximos de diseño para el MVP y requieren ratificación de la operadora. Si un proveedor no puede cumplirlos, no se despliega sin una excepción documentada y una DPIA actualizada.

| Categoría | Ubicación | Retención | Borrado | Base/propósito por confirmar | Backup |
| --- | --- | --- | --- | --- | --- |
| Formulario no guardado | Memoria del navegador | Hasta cerrar/recargar flujo | Automático o “Empezar de nuevo” | Ejecutar solicitud | No |
| Guardado local opt-in | IndexedDB del dispositivo | Hasta borrado de la persona; recordar periódicamente | “Borrar mis datos locales” | Conveniencia solicitada | Solo backup personal del dispositivo |
| Body de simulación | Memoria Worker + backend seleccionado | Duración de petición, objetivo <10 s | Liberar al responder/fallar | Ejecutar solicitud | Prohibido |
| Respuesta personal | Memoria backend/Worker/navegador | Servidor: petición; navegador: sesión | Igual; exportación controlada por persona | Devolver estimación | Prohibido en servidor |
| Request ID | Log técnico | 14 días máximo | Rotación automática | Fiabilidad/seguridad | Backups expiran en ≤14 días adicionales |
| Endpoint/status/duración/versiones | Log técnico | 14 días | Rotación | Operación/seguridad | ≤14 días adicionales |
| Identificador técnico de rate limit | Memoria edge | Ventana ≤15 minutos | TTL automático | Disponibilidad | No |
| Métricas agregadas operativas | Sistema de métricas | 90 días; sin ubicación/hogar/high-cardinality | Downsampling/TTL | Fiabilidad | Según TTL |
| Evidencia de incidente | Almacén restringido | 180 días tras cierre o más si obligación documentada | Revisión y borrado seguro | Seguridad/obligación | Cifrado; mismo calendario |
| Feedback/corrección | Tracker aprobado | 12 meses tras cierre salvo registro público no personal | Revisión semestral | Responder/mejorar | Según proveedor |
| Export JSON/CSV/PDF | Dispositivo | Control de la persona | Usuario/SO | Acción explícita | Fuera del control servidor |
| Política/fuente/metodología | Git/artefacto público | Indefinida/versionada | No se reescribe; se archiva | Transparencia/reproducibilidad | Sí |
| Snapshots oficiales | Almacén de pipeline | Según licencia y necesidad; revisión anual | Lifecycle policy | Reproducibilidad | Según licencia |
| Microdatos restringidos | Entorno analítico separado | Contrato/licencia | Destrucción certificada | Calibración aprobada | Solo si contrato permite |
| Analítica publicitaria/session replay | — | No se recopila | — | Fuera de propósito | — |
| Opinión política/afinidad | — | No se recopila ni infiere | — | Prohibido | — |

## Verificación

- Configurar TTL en infraestructura, no solo en esta tabla.
- Probar que errores, tracing y WAF no crean copias paralelas.
- Inventariar backups y colas; “borrado” incluye réplicas tras su ventana.
- Revisar trimestralmente volúmenes y campos de logs.
- Documentar legal hold de forma excepcional, acotada y autorizada.
