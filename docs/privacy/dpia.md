# Evaluación de impacto de privacidad (DPIA-style)

Estado: borrador de ingeniería; requiere aprobación de la entidad operadora y asesoría española antes del lanzamiento.

## Necesidad de evaluación

El servicio combina ingresos, prestaciones, hogar, residencia y una banda amplia opcional de discapacidad. Aunque sea efímero, el tratamiento puede ser de alta sensibilidad y ocurre en un contexto electoral. La ausencia de persistencia reduce el riesgo, no elimina la obligación de evaluar el tratamiento.

## Descripción

| Elemento | Diseño |
| --- | --- |
| Finalidad | Estimación fiscal solicitada y contexto agregado separado |
| Personas | Público residente/relacionado con España; no orientado a menores |
| Datos | Hechos fiscales/hogar manuales; datos técnicos mínimos |
| Frecuencia | Una petición por comparación |
| Decisiones | Ninguna automatizada con efectos jurídicos |
| Destinatarios | Usuario; Worker y proveedor/API del backend seleccionado bajo contrato |
| Retención | Cuerpo/respuesta: ninguna en servidor |
| Transferencias | Por determinar según hosting; deben documentarse antes de launch |
| Política | No se recoge ni infiere opinión política |

## Necesidad y proporcionalidad

- Los campos se justifican por una variable soportada; los avanzados usan divulgación progresiva.
- No se solicita nombre, NIF, dirección, fecha de nacimiento, email, cuenta bancaria o afiliación.
- Municipio es opcional y solo aporta contexto.
- Discapacidad usa bandas amplias y `unknown`; se evita diagnóstico/documentación.
- El propósito se satisface sin cuenta ni historial.
- Fixtures sintéticos sustituyen datos reales en soporte y pruebas.
- Resultados y exportaciones se controlan en el dispositivo.

Pendiente jurídico bloqueante: la operadora debe documentar base del artículo 6 aplicable y analizar si la entrada de discapacidad constituye datos de salud/categoría especial y qué condición del artículo 9 sería válida. No se debe “resolver” mediante una casilla genérica sin revisión de necesidad, granularidad y libertad del consentimiento.

## Riesgos y medidas

Escala: probabilidad e impacto 1 (bajo) a 4 (muy alto). Residual es una estimación de diseño y debe reevaluarse con infraestructura real.

| Riesgo | Inicial P×I | Medidas | Residual P×I | Owner |
| --- | ---: | --- | ---: | --- |
| Body en logs/proxy/APM | 3×4 | logging allowlist, access log sin query, tests canario, no body capture | 1×4 | Plataforma |
| Cambio silencioso de backend por caída | 2×4 | selección por despliegue, Python falla cerrado, etiqueta/backend version en respuesta | 1×3 | Plataforma/fiscal |
| XSS lee estado/IndexedDB | 3×4 | CSP, sin scripts terceros, encoding, dependencias, local save opt-in | 2×4 | Web/security |
| Perfil o inferencia política | 2×4 | propósito prohibido, sin respuestas históricas/cuentas/analytics, revisión editorial | 1×4 | Producto/privacy |
| Proveedor usa entradas | 2×4 | contratos, región/transferencia revisada, zero-retention config, due diligence | 1×4 | Operadora |
| Exportación revela discapacidad/prestación | 3×3 | exclusión default, preview, confirmación, test | 1×3 | Web |
| Enlace/URL filtra hogar | 3×4 | POST only, URL regression tests, referrer policy | 1×4 | Web/API |
| Cache compartida devuelve respuesta | 2×4 | no-store, sin CDN de POST, pruebas cache | 1×4 | Plataforma |
| Reidentificación en área pequeña | 3×4 | pipeline separado, supresión, no joins personales, revisión derivabilidad | 2×3 | Datos/privacy |
| Acceso interno indebido | 2×4 | no DB de cuerpos, least privilege, logs mínimos, auditoría | 1×3 | Security |
| Persistencia accidental en error/backup | 3×4 | sin store, tmpfs/read-only, redacción, prueba fallo | 1×4 | API/platform |
| Guardado local en dispositivo compartido | 3×3 | off por defecto, aviso y borrado, sin sync | 2×3 | Producto |
| Uso secundario en campañas | 2×4 | sin API de exportación, términos, sin campañas/ads, monitoreo de integraciones | 1×4 | Governance |

El impacto residual 4 permanece alto para una fuga individual; la estrategia reduce probabilidad y superficie, no minimiza su gravedad.

## Consulta y pruebas

Antes de producción:

- prueba con usuarios sobre comprensión de privacidad/guardado/exportación;
- revisión por fiscal, seguridad, DPO/asesoría y accesibilidad;
- inspección de configuración de proxy, CDN, WAF, APM y soporte;
- test dinámico que busque canarios en logs y terceros;
- verificación de localización/transferencias y subencargados;
- simulacro de incidente y borrado local.

## Decisiones bloqueantes

- identidad/contacto del responsable no publicados;
- base jurídica/categoría especial sin dictamen;
- proveedor o transferencia no inventariados;
- captura de cuerpos habilitada;
- CSP o no-store ausentes;
- script tercero no revisado;
- campos enviados a analítica;
- guardado local activado por defecto;
- umbral de divulgación no aprobado.

## Revisión

Reabrir por nuevo campo, cuenta, sync, IA, analítica, proveedor, uso electoral, país de hosting, fuente microdata, enlace compartible o incidente. Mantener versión, fecha, aprobadores y diferencias.
