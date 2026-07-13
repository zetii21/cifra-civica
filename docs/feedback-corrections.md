# Feedback y correcciones

## Canales

- Defecto público sin datos sensibles: issue con plantilla.
- Vulnerabilidad o fuga: canal privado de [SECURITY.md](../SECURITY.md).
- Disputa de fuente/regla: issue de corrección con localizador y evidencia primaria.
- Accesibilidad: canal público o privado accesible, sin exigir cuenta cuando se publique el servicio.

No adjunte declaración, salario, NIF, domicilio, captura del formulario o resultado personal. El equipo no necesita esos datos; reproducirá con fixture sintético.

## Formato de corrección

- ruta/escenario/model version/policy version;
- ejercicio y territorio sin identificar hogar;
- componente o texto cuestionado;
- resultado esperado expresado como regla, no caso real;
- fuente primaria, sección y fecha;
- por qué es material;
- contacto opcional.

## Triage

| Tipo | Objetivo inicial | Acción |
| --- | --- | --- |
| Privacidad/seguridad | Inmediato según incident runbook | Canal privado, contención |
| Régimen incorrecto/reconciliación | 1 día laborable | Retirar si material |
| Fuente o parámetro material | 3 días laborables | Revisión fiscal independiente |
| Accesibilidad bloqueante | 3 días laborables | Workaround y prioridad alta |
| Copy/UX | 10 días laborables | Backlog transparente |

Son objetivos internos, no garantía. La severidad no depende del sponsor político.

## Investigación

1. confirmar versiones y evidencia sin solicitar payload;
2. reproducir con caso mínimo sintético;
3. comparar norma/propuesta, interpretación y fórmula;
4. revisar alcance temporal/territorial;
5. decidir: correcto, limitación, ambigüedad, bug o fuente desactualizada;
6. obtener revisión separada.

## Publicación

Una corrección material:

- crea nueva versión de política/modelo/datos según corresponda;
- conserva changelog y release afectada;
- añade test regresión;
- actualiza metodología/limitaciones;
- indica periodo y escenarios afectados;
- no reescribe en silencio ni imputa intención;
- notifica en `/updates` y página del escenario.

Si no se puede resolver, marcar `disputed`/no evaluado en documentación o retirar el escenario según schema; no mantener una cifra por continuidad visual.
