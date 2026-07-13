# Mapa de documentación

La documentación forma parte del producto y de las puertas de publicación. Una discrepancia entre código y documentación se trata como un defecto.

| Área | Documento principal | Responsable de revisión | Revisión mínima |
| --- | --- | --- | --- |
| Arquitectura | [architecture.md](architecture.md) | Ingeniería | Cambio de frontera o dependencia |
| Decisiones | [adr/](adr/) | Ingeniería + área afectada | Antes de fusionar la decisión |
| Modelo | [methodology/model.md](methodology/model.md) | Fiscal + microsimulación | Cada versión de modelo |
| Inventario de modelos | [methodology/model-inventory.md](methodology/model-inventory.md) | Fiscal + ingeniería | Cada release |
| Fuentes | [methodology/data-sources.md](methodology/data-sources.md) | Datos + fiscal | Cada snapshot |
| Limitaciones | [methodology/limitations.md](methodology/limitations.md) | Fiscal + producto | Cada release |
| Laboratorio estadístico | [validation/statistical-lab.md](validation/statistical-lab.md) | Modelado + QA | Cambio de motor/generador |
| Diccionario | [data-dictionary/README.md](data-dictionary/README.md) | Contratos + privacidad | Cambio de esquema |
| Políticas | [policy-authoring.md](policy-authoring.md) | Fiscal + editorial | Cada escenario |
| Validación | [validation/validation-plan.md](validation/validation-plan.md) | QA + fiscal | Cada release |
| Privacidad | [privacy/README.md](privacy/README.md) | Privacidad | Cambio de flujo/tercero |
| Seguridad | [security/threat-model.md](security/threat-model.md) | Seguridad | Trimestral y tras incidente |
| Dependencias | [security/dependency-exceptions.md](security/dependency-exceptions.md) | Ingeniería + seguridad | Semanal / antes de release |
| Despliegue | [deployment.md](deployment.md) | Plataforma | Cambio de entorno |
| Operaciones | [operations.md](operations.md) | Operaciones | Cada release |
| Incidentes | [incident-response.md](incident-response.md) | Seguridad + operaciones | Simulacro semestral |
| Accesibilidad | [accessibility.md](accessibility.md) | Frontend + diseño | Cada release |
| Correcciones | [feedback-corrections.md](feedback-corrections.md) | Producto + fiscal | Cambio de proceso |
| Versiones | [release-metadata.md](release-metadata.md) | Release manager | Cada release |

## Convenciones

- `DEMO` significa sintético y no oficial.
- `No evaluado` no equivale a aprobado.
- Fechas en ISO 8601 y dinero en céntimos enteros en contratos.
- Los documentos públicos deben diferenciar ley, propuesta, interpretación y simulación.
- Los enlaces a fuentes no sustituyen un snapshot, checksum, licencia y fecha de acceso.

## Evidencia privada

No se versionan cuerpos de cálculo reales, microdatos restringidos, informes con datos personales, secretos ni capturas de usuarios. La evidencia de seguridad sensible se conserva en el canal privado de incidentes con acceso mínimo y retención limitada.
