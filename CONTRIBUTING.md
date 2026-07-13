# Contribuir a Cifra Cívica

Gracias por ayudar a construir una herramienta cívica verificable. Toda contribución debe preservar neutralidad política, privacidad, trazabilidad y precisión honesta.

## Antes de empezar

1. Abra un issue breve para cambios de arquitectura, cobertura fiscal o fuentes.
2. No incluya datos personales, microdatos restringidos, secretos ni material sin licencia.
3. Use fixtures sintéticos claramente marcados cuando no exista una fuente oficial revisada.
4. No convierta una frase política ambigua en una única regla sin registrar interpretaciones alternativas y supuestos.

## Configuración

```bash
cp .env.example .env
make setup
make test
```

Cree una rama corta. Los commits deben explicar el motivo del cambio y no solo el archivo modificado.

## Estándares de código y contenido

- TypeScript estricto y contratos Pydantic tipados.
- Importes internos en céntimos enteros; redondeo centralizado.
- Fórmulas y parámetros fechados fuera de componentes de interfaz.
- Cambios fiscales acompañados de fuente primaria, fecha de consulta, ámbito y pruebas de frontera.
- Lenguaje público en español claro, descriptivo y sin recomendar partidos.
- Componentes interactivos navegables por teclado y con alternativa textual.
- Ningún cuerpo de cálculo, ingreso, renta, discapacidad, beneficio o composición familiar en logs.

La [guía de autoría de políticas](docs/policy-authoring.md) define el flujo editorial y las puertas de publicación.

## Pruebas

Ejecute `make ci`. Como mínimo, un cambio debe cubrir:

- pruebas unitarias y de contrato pertinentes;
- caso dorado o justificación cuando se modifica una regla validada;
- comprobación de reconciliación monetaria;
- prueba de territorio no soportado cuando proceda;
- accesibilidad y privacidad si cambia la interfaz o el flujo de datos;
- actualización de metodología, changelog y metadatos de versión.

No actualice resultados esperados solo para hacer pasar una prueba: explique y revise la diferencia.

## Pull requests

Complete la plantilla, mantenga el alcance acotado y declare:

- si cambia resultados fiscales;
- qué fuentes y revisores lo respaldan;
- si introduce un tercero o transferencia de datos;
- qué es sintético;
- qué comandos ejecutó y sus resultados;
- limitaciones o riesgos que permanecen.

Se requiere una revisión de política fiscal para reglas, de privacidad/seguridad para flujos personales y editorial para lenguaje sobre partidos o elecciones. La misma persona no debe proponer, validar y publicar por sí sola una política material.

## Conducta

Debata la evidencia y el diseño, no las preferencias políticas o características personales. No use este proyecto para persuasión dirigida, elaboración de audiencias, encuestas de intención de voto ni clasificación ideológica.
