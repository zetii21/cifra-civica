# Infraestructura

Esta carpeta contiene scaffolding reproducible y sin secretos:

- `docker/`: imágenes no root para web, API y teselas;
- `deployment/`: contrato de metadatos de release.

Docker Compose en la raíz es el entorno local de referencia. La infraestructura productiva del proveedor debe añadirse como código tras decidir operadora, región, DNS, WAF/CDN, gestor de secretos y almacenamiento de artefactos.

## Invariantes productivos

- TLS y URLs HTTPS;
- filesystem read-only y usuario no root;
- registro/teselas por digest, sin escritura desde runtime;
- cuerpos personales excluidos de logs, caché, APM y backups;
- API sin egress arbitrario;
- CDN solo para assets/teselas, nunca simulaciones;
- synthetic scenarios/data deshabilitados;
- traces de cálculo deshabilitadas;
- TTL según la matriz de retención;
- identidad federada de CI y aprobación de entorno;
- rollback del conjunto compatible completo.
- backend/configuración fijados en metadata; un upstream caído no cambia a edge.

No copie `.env` a una imagen. Los valores sensibles se inyectan desde el gestor del entorno y no aparecen en output de plan o logs.
