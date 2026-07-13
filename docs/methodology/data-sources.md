# Fuentes, datos y procedencia

## Regla de admisión

Un enlace no convierte un dato en apto para producción. Antes de usar una fuente se registra:

- organismo y título;
- URL canónica y fecha de acceso;
- periodo de referencia y publicación;
- definición de población y variables;
- licencia/condiciones de reutilización;
- formato, tamaño y mecanismo de descarga;
- checksum del snapshot original;
- transformaciones reproducibles;
- umbrales de secreto o supresión;
- responsable y fecha de revisión.

Si la redistribución no está permitida, Git conserva el adaptador, metadatos y checksum, no el archivo.

## Inventario inicial de fuentes candidatas

Estas fuentes oficiales y de referencia proceden de la investigación del proyecto. Su estado inicial es **candidata**: cada snapshot necesita registro y revisión antes de alimentar una política publicada.

| Dominio | Fuente candidata | Uso permitido previsto | Riesgo/validación |
| --- | --- | --- | --- |
| IRPF de referencia | [AEAT Renta Web Open](https://sede.agenciatributaria.gob.es/Sede/ayuda/consultas-informaticas/renta-ayuda-tecnica/renta-web-open.html) | Comprobación manual de casos donde sus condiciones lo permitan | No automatizar/scrapear sin permiso y términos claros |
| IRPF agregado | [AEAT Estadística de declarantes](https://sede.agenciatributaria.gob.es/Sede/datosabiertos/catalogo/hacienda/Estadistica_de_los_declarantes_del_IRPF.shtml) | Benchmark agregado | Declarantes no equivalen a todos los hogares |
| IRPF municipal | [AEAT IRPF por municipios](https://sede.agenciatributaria.gob.es/Sede/datosabiertos/catalogo/hacienda/Estadistica_de_los_declarantes_del_IRPF_por_municipios.shtml) | Contexto oficial | Umbrales y cobertura territorial |
| Ingresos territoriales | [INE Atlas de Distribución de Renta de los Hogares](https://www.ine.es/dyngs/INEbase/es/operacion.htm?c=Estadistica_C&cid=1254736176806&idp=1254735976608&menu=resultados) | Contexto municipio/distrito/sección | No confundir renta oficial con impacto simulado |
| Hogares y renta | [INE Encuesta de Condiciones de Vida](https://www.ine.es/dynt3/metadatos/RespuestaPrint.htm?oper=155) | Microsimulación/calibración con acceso y licencia adecuados | Muestra, pesos, anonimización y desfase temporal |
| Consumo | [INE Encuesta de Presupuestos Familiares](https://www.ine.es/dyngs/IOE/operacion.htm?numinv=30458) | Extensión futura de incidencia indirecta | Fuera del cálculo directo MVP |
| Cotizaciones/prestaciones | [Seguridad Social PXWeb](https://w6.seg-social.es/PXWeb/pxweb/es/) | Benchmark agregado | Definiciones y periodos deben alinearse |
| Microsimulación | [EUROMOD country reports](https://euromod-web.jrc.ec.europa.eu/resources/country-reports) | Comparación metodológica/agregada según acceso | Diferencias de población y reglas documentadas |
| Tributación autonómica | [Ministerio de Hacienda: libro electrónico](https://www.hacienda.gob.es/es-ES/Areas%20Tematicas/Financiacion%20Autonomica/Paginas/Libro%20electronico.aspx) | Fuente normativa secundaria/índice | Confirmar en norma primaria aplicable |
| Foral Navarra | [Normativa de Hacienda de Navarra](https://www.navarra.es/es/web/normativa-hacienda/normativa) | Extensión futura | No aplicar territorio común mientras no esté validado |
| Límites geográficos | [INE Datos abiertos](https://www.ine.es/dyngs/DAB/index.htm?cid=1389) | Geometrías y nomenclátores | Versionar códigos, CRS, fecha y licencia |

Las normas primarias aplicables (BOE y boletines autonómicos) prevalecen para parámetros legales. Una noticia, discurso, manifiesto o nota de partido puede documentar una propuesta, pero no una baseline legislada.

## Estados del pipeline

| Estado | Contenido | Publicable |
| --- | --- | --- |
| `raw` | Snapshot inmutable, sin modificar | No |
| `staging` | Parseo y tipos con errores visibles | No |
| `curated` | Definiciones armonizadas y controles | No por defecto |
| `calibrated` | Ajustes/ponderación con diagnóstico | Solo como modelado |
| `published` | Agregado, suprimido, versionado y documentado | Sí |

No se sobrescribe un snapshot. La corrección genera nueva versión y conserva lineage.

## Registro mínimo de dataset

```yaml
id: identificador-estable
publisher: organismo
title: titulo
source_url: https://fuente.example
accessed_at: YYYY-MM-DD
reference_period: descripcion
license: identificador-o-texto
redistribution: allowed | metadata_only | unknown
sha256: checksum
classification: official | modelled | calibrated | synthetic_demo
geography_version: version-o-no_aplica
transform_version: commit
review_status: pending | source_reviewed | approved
known_limitations: []
```

## Separación y divulgación

Los pipelines nunca leen peticiones personales. Antes de publicación se aplican las reglas de la fuente, mínimos de calidad, supresión y revisión de celdas derivables. No se rellenan celdas suprimidas por interpolación visual. Los mapas muestran `sin dato / suprimido` distinto de cero.

## Fixtures

Un fixture sin base oficial es determinista, pequeño, no parecido a una persona real y lleva `synthetic_demo` en contenido, manifiesto y UI. Producción bloquea estos artefactos salvo override explícito, registrado y visible para un entorno de demostración.
