# ADR-0006: Ruta same-origin y contingencia edge explícita

- Estado: aceptada
- Fecha: 2026-07-13
- Propietarios: ingeniería, fiscal, seguridad y release
- Complementa: ADR-0001, ADR-0002 y ADR-0003

## Contexto

El navegador necesita enviar un cuerpo fiscal efímero sin exponer una URL de API distinta, sin incrustar endpoints por entorno en el bundle y sin mantener un segundo motor cliente. El despliegue completo dispone de FastAPI, mientras Sites ejecuta el Worker pero no un proceso Python.

Un fallback automático después de fallar FastAPI sería peligroso: una misma versión visible podría producir resultados con dos implementaciones según una incidencia transitoria.

## Decisión

El navegador siempre llama `POST /api/v1/simulations/compare` en su propio origen. El Worker aplica método y límite de 65.536 bytes, conserva `no-store` y decide el backend **por configuración de despliegue**:

1. Con `SIMULATION_API_BASE_URL`, reenvía a esa URL interna fija. Un timeout, error de red o respuesta no disponible devuelve error seguro; nunca activa edge como fallback.
2. Sin `SIMULATION_API_BASE_URL`, el despliegue se considera edge-only y ejecuta una API de contingencia server-side con el mismo contrato externo.

La contingencia edge:

- valida un esquema cerrado y los mismos límites básicos;
- usa aritmética determinista, sin LLM;
- declara `X-Cifra-Engine: edge_api`, model version propia, incertidumbre alta y advertencia visible;
- no afirma equivalencia con el grafo Python ni hereda su estado de validación;
- no está importada por el cliente ni aparece en sus chunks;
- no se activa durante un fallo del upstream configurado.

FastAPI responde como `python_api` y sigue siendo el motor principal para validación fiscal y despliegue completo.

## Consecuencias

- El navegador, CSP y teselas permanecen same-origin.
- Una imagen web no contiene URL pública de API y puede promocionarse por digest.
- El Worker procesa el body en memoria y entra en el alcance de privacidad, límites y pruebas canario.
- Existen dos backends server-side con niveles de evidencia distintos; toda salida identifica cuál se usó.
- Cambiar de modo requiere configuración/release consciente, smoke test y revisión de copy.
- Las pruebas E2E del despliegue completo deben demostrar `python_api`; las unitarias del modo edge demuestran contrato, límites y etiquetado, no paridad fiscal universal.

## Alternativas descartadas

- **Motor fiscal en el navegador**: duplica reglas, expone umbrales en el bundle y contradice la frontera canónica.
- **URL `NEXT_PUBLIC_*` por entorno**: obliga a reconstruir la imagen y amplía CSP/CORS.
- **Fallback edge al caer FastAPI**: cambia resultados por disponibilidad y oculta el backend efectivo.
- **Sites sin cálculo**: impide una demo funcional, aunque sigue siendo preferible a edge cuando una release no pueda etiquetar honestamente sus límites.

## Criterio de revisión

Retirar la contingencia cuando Sites pueda alcanzar el motor Python canónico o cuando su coste de revisión supere su utilidad. Promover edge a motor validado exigiría ADR nuevo, registro fechado único, casos dorados, benchmarks y equivalencia por componente; compartir un contrato no basta.
