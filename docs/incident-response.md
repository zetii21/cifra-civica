# Respuesta a incidentes

## Activación

Activar ante fuga potencial, regla/atribución adulterada, backend de cálculo inesperado, cálculo territorial engañoso, datos suprimidos expuestos, compromiso de dependencia/secreto, acceso no autorizado o indisponibilidad material.

## Severidad

| Nivel | Ejemplo | Objetivo |
| --- | --- | --- |
| SEV-1 | Entrada personal expuesta; registry comprometido; supresión rota | Contención inmediata y mando único |
| SEV-2 | Cálculos materiales incorrectos; caída amplia; secreto con alcance limitado | Mitigar con urgencia |
| SEV-3 | Degradación acotada o defecto sin impacto material | Corregir planificadamente |
| SEV-4 | Observación/near miss | Aprender y prevenir |

## Roles

- Incident commander: decisiones/ritmo.
- Tech lead: contención y recuperación.
- Privacy/security: evidencia, alcance y obligaciones.
- Fiscal/data lead: integridad de política/modelo.
- Communications: avisos neutrales.
- Scribe: timeline sin datos sensibles.

Una persona puede cubrir varios roles al inicio, pero la decisión de cerrar un SEV-1 requiere revisión.

## Primeros pasos

1. declarar incidente, severidad provisional y canal privado;
2. detener fuga/rollout/capa/escenario; preservar servicio seguro cuando sea posible;
3. congelar digests, commits y configuración relevante;
4. revocar/rotar secretos si existe sospecha;
5. verificar si logging, caché, terceros o backups contienen cuerpos;
6. asignar asesoría para plazos regulatorios inmediatamente;
7. comunicar internamente hechos confirmados, hipótesis y próxima actualización.

No copie payloads reales a chat, issue o postmortem. Preserve evidencia mínima con acceso/retención específicos.

## Playbooks

### Entrada personal en logs

- deshabilitar sink/ingesta y acceso no esencial;
- evitar que la búsqueda replique el dato;
- identificar ventana, campos, destinatarios y backups;
- purgar de forma verificable según asesoría;
- rotar credenciales expuestas;
- ejecutar canary tras corrección;
- evaluar notificaciones regulatorias/personas sin esperar al postmortem.

### Política o motor adulterado

- retirar escenario/API afectado;
- comparar commit, firma, digest y branch audit;
- bloquear credenciales/actor de publicación;
- reconstruir desde fuente y artefacto verificados;
- recalcular golden cases/benchmarks;
- publicar corrección y versiones afectadas.

### Datos de mapa no divulgables

- retirar layer y purgar CDN;
- conservar manifest/checksum con acceso restringido;
- revisar celdas derivables y descargas;
- regenerar desde etapa previa con nueva versión.

### Backend inesperado o downgrade

- detener rollout y conservar cabecera, metadata, digest y configuración sin cuerpos;
- comparar `SIMULATION_API_BASE_URL`, `X-Cifra-Engine`, model version y etiqueta visible;
- comprobar si hubo cambio de configuración, proxy o supply chain;
- restaurar el conjunto aprobado; no retirar un upstream fallido para activar edge;
- delimitar versiones/periodo de resultados servidos por el backend no declarado;
- repetir contrato, casos fiscales y E2E antes de reabrir.

### Dependencia comprometida

- identificar runtime/build-only y versiones;
- bloquear builds y rotar secretos accesibles;
- sustituir/reconstruir con base limpia;
- generar SBOM/diff y revisar comportamiento/red.

## Recuperación

Restaurar un conjunto compatible por digest, ejecutar smoke sintético, privacidad, integridad y accesibilidad esenciales, y observar métricas seguras. No reabrir una política hasta revisión fiscal si el incidente afecta resultados.

## Comunicaciones

Indicar qué ocurrió, periodo, servicio/versiones, impacto conocido, qué hizo el equipo y qué debe hacer la persona. Diferenciar investigación de hecho confirmado. No publicar datos, exploits activos o atribución especulativa. Un error político se corrige con el mismo tono con independencia del sponsor.

## Postmortem

En cinco días laborables como objetivo interno para SEV-1/2, documentar timeline, impacto, causa técnica/organizativa, detección, respuesta, factores, qué funcionó, acciones con owner/fecha y evidencia de cierre. Publicar una versión segura cuando interese al público.

## Simulacros

Semestrales y antes del lanzamiento electoral:

- body en logs;
- policy registry alterado;
- tesela sin supresión;
- caída por tráfico;
- backend distinto al declarado o intento de fallback;
- secreto de deploy comprometido.
