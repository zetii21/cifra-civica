# Metodología del modelo

## Propósito

El modelo estima cómo cambia la renta disponible anual y mensual de un hogar al comparar una baseline con hasta tres escenarios compatibles. No prepara una declaración, no determina una obligación oficial y no recomienda una opción electoral.

La unidad personal procede exclusivamente de información que introduce la persona. La capa territorial procede de estadísticas o simulaciones agregadas y no completa, corrige ni enriquece el hogar personal.

## Conceptos

- **Baseline**: conjunto versionado de reglas de referencia para un ejercicio y régimen.
- **Escenario**: hereda una baseline y modifica únicamente parámetros o fórmulas declaradas.
- **Modelo**: implementación de variables, dependencias, periodos y redondeo.
- **Política**: evidencia, interpretación, supuestos, valores y estado editorial.
- **Dato oficial**: observación publicada por una autoridad bajo sus definiciones.
- **Estimación modelada**: salida del motor; nunca se presenta como observación administrativa.

Un escenario `proposed` puede estar muy probado y seguir sin ser ley; un escenario `legislated` puede estar todavía `unreviewed` en el modelo. Estado político-jurídico y estado de validación no se confunden.

## Entrada y normalización

El contrato valida tipos, enumeraciones, rangos, territorio y compatibilidad temporal. El dinero se recibe y calcula en céntimos enteros. Los identificadores locales de personas son aleatorios y solo ayudan a reconciliar el formulario; no son identidades reales.

La normalización:

1. rechaza valores imposibles o fuera de límites de seguridad;
2. distingue cero, desconocido y ausente;
3. asigna cada concepto a una persona u hogar;
4. resuelve el régimen territorial antes del cálculo;
5. registra cualquier aproximación visible;
6. aumenta incertidumbre si falta un hecho material.

No se deriva una edad, discapacidad, tipo de familia, municipio o preferencia de voto a partir de otras señales.

## Grafo de cálculo

Las variables son funciones puras de entradas, parámetros fechados y otras variables. El evaluador detecta dependencias circulares, impide parámetros fuera de vigencia y conserva una traza segura en desarrollo. Las trazas de producción no incluyen rutas internas ni el cuerpo original.

FastAPI (`python_api`) contiene el motor fiscal principal. Para entornos sin ese upstream existe una contingencia aproximada en el Worker (`edge_api`), con model version, advertencia e incertidumbre propias. Esta contingencia conserva el contrato externo y las identidades de reconciliación, pero sus pruebas de contrato no demuestran equivalencia fiscal universal con el motor Python. El backend se fija al desplegar; un fallo de FastAPI no provoca un cambio automático a edge. El navegador no contiene ni ejecuta un tercer motor.

El orden conceptual, no una sustitución de las fórmulas estatutarias, es:

1. clasificar rentas observables;
2. calcular cotizaciones soportadas;
3. formar bases general y del ahorro por separado;
4. aplicar mínimos y reducciones que estén codificados y sean observables;
5. conservar las cuotas estatal y autonómica;
6. aplicar deducciones y créditos soportados;
7. incorporar prestaciones monetarias soportadas;
8. comparar individual/conjunta cuando las reglas lo permiten;
9. reconciliar renta disponible y diferencias;
10. adjuntar fuentes, supuestos, advertencias y cobertura.

El resultado debe demostrar la identidad:

```text
suma de cambios de componentes = cambio total de renta disponible
```

dentro de la regla de redondeo declarada. Cada componente indica si pensiones o prestaciones ya forman parte de una categoría de ingreso para evitar doble conteo.

## Declaración individual y conjunta

Cuando el contrato y las reglas validadas permiten ambas opciones, el motor calcula alternativas con la misma entrada y comunica la de mayor renta disponible estimada si la preferencia es `calculate_best`. Esto es una comparación del modelo, no una elección oficial. Si faltan hechos necesarios, no selecciona silenciosamente una modalidad.

## Territorialidad

El régimen se decide antes de ejecutar reglas:

- territorio común: solo comunidades y ejercicios con módulos validados;
- Navarra y País Vasco: estado explícito no soportado hasta disponer de fidelidad foral;
- Canarias: una cobertura de IRPF no implica IGIC o incidencia de consumo;
- Ceuta y Melilla: parcial o no soportado hasta validar tratamientos especiales.

El municipio se usa para contexto territorial, no para inventar una deducción.

## Escenarios incompletos

Una frase programática no es una especificación calculable. Cuando hay varias lecturas razonables se crean variantes separadas (por ejemplo, estrecha, central y amplia) con fuente y supuesto propios. Una ambigüedad material sin resolver bloquea publicación o produce una advertencia prominente; nunca se oculta en un tooltip.

## Incertidumbre

La respuesta usa `low`, `medium`, `high` o `not_assessed` y enumera motivos. Son categorías de comunicación, no probabilidades.

Factores típicos:

- regla estatutaria completa frente a aproximación;
- dato exacto frente a estimado/desconocido;
- propuesta explícita frente a interpretación;
- cobertura completa frente a módulo omitido;
- calibración alineada o pendiente;
- tamaño/calidad de una estimación territorial.

Solo se muestran intervalos numéricos cuando existe un método documentado para construirlos. La precisión de visualización no excede la evidencia.

## Explicaciones

Las explicaciones numéricas usan plantillas deterministas vinculadas a variables y rule IDs. Se ordenan por materialidad absoluta sin calificativos de “ganador” o “perdedor”. Una eventual función generativa puede resumir documentación no numérica únicamente tras evaluación separada y nunca modifica importes, estados o fuentes.

## Versionado y reproducibilidad

Cada respuesta incluye ejercicio, model version, policy version, timestamp, soporte territorial, estado de validación, fuentes y `dataRetention: not_stored`. La capa web añade `calculationBackend`, derivado de la cabecera fijada por el Worker del mismo origen, a la representación de resultado. El commit del registro pertenece a los metadatos de release, no al body personal; en edge identifica el registro inventariado, aunque el catálogo Worker activo se acredita por source commit y digest propios. Los artefactos de release conservan backend, checksums y versiones; reconstruir una salida requiere el mismo backend, configuración, versiones e input normalizado.

## Revisión

La metodología se revisa cuando cambia una fórmula, parámetro, cobertura, contrato o fuente. Consulte [validación](../validation/validation-plan.md), [fuentes](data-sources.md) y [limitaciones](limitations.md).
