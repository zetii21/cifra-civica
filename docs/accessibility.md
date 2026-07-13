# Accesibilidad

Objetivo: WCAG 2.2 nivel AA en journeys públicos. La automatización ayuda, pero no certifica conformidad.

## Diseño

- español claro y preparado para i18n;
- encabezados, landmarks y orden de lectura semánticos;
- teclado completo, foco visible y retorno de foco predecible;
- targets y spacing adecuados en móvil;
- zoom/reflow sin pérdida a 400 % donde aplique;
- errores asociados al campo, resumen navegable y sugerencia de corrección;
- estado no indicado solo por color/icono;
- movimiento reducido y sin parpadeo;
- timeout evitable; el formulario no depende de sesión de servidor.

## Formularios

Cada control tiene label persistente, ayuda vinculada y motivo del dato. Se distingue cero de desconocido. Las cantidades anuncian unidad y periodo; el formato visual español no cambia el valor subyacente. Al avanzar, se enfoca el título o primer error. Atrás conserva estado en el navegador.

Discapacidad, prestaciones y otros campos sensibles usan lenguaje no estigmatizante y opción desconocida cuando el modelo lo permite.

## Resultados

- baseline y escenarios tienen títulos, no solo colores;
- tablas accesibles conservan importes y cambios;
- cambios usan texto “aumento/disminución/sin cambio”;
- supuestos/limitaciones no viven solo en tooltip;
- anuncios live son breves; no recitan toda la tabla;
- impresión y export mantienen títulos/versiones/disclaimer;
- símbolos monetarios no sustituyen labels.

## Gráficos y mapa

El mapa no es la única vía. Proporcionar búsqueda, tabla/resumen del lugar, leyenda textual, fuente, vintage, clasificación y supresión. Navegación de mapa por teclado si es operable; de lo contrario marcarlo como visual complementario y ofrecer controles equivalentes.

Cada gráfico tiene título, descripción, unidad, tabla o resumen de valores importantes y patrón/label además de color. No animar al cargar con movimiento reducido.

## Matriz de pruebas

| Prueba | Frecuencia |
| --- | --- |
| axe sobre rutas clave | Cada PR |
| Flujo teclado completo | Cada release |
| Lector de pantalla (VoiceOver + Safari; NVDA + Firefox/Chrome) | Cada release mayor |
| Zoom/reflow y móvil | Cada release |
| Contraste de temas/estados/gráficos | Cada cambio visual |
| Form errors y focus | Cada cambio de schema |
| Print/download | Cada release |
| Tabla alternativa/map fallback | Cada cambio geográfico |

Bloquean release: control inaccesible, foco perdido, error no anunciado, texto insuficiente, contraste AA material, flujo solo ratón/color o mapa sin alternativa para una función esencial.

## Declaración pública

`/accessibility` debe indicar estándar/alcance, fecha y método de evaluación, limitaciones conocidas, formatos alternativos y canal de feedback accesible. No declarar conformidad total mientras existan defectos AA conocidos sin explicar.

## Feedback

Aceptar descripción del problema, ruta, tecnología asistiva/navegador opcionales y formato deseado. No pedir datos fiscales para reproducir; usar fixtures sintéticos.
