# Inventario de terceros y dependencias

El lockfile, los requirements y el SBOM de cada imagen son la lista exacta por release. Esta tabla documenta propósito y flujo; se actualiza al añadir o retirar un tercero.

## Runtime

| Tercero/componente | Propósito | Datos potencialmente recibidos | Postura |
| --- | --- | --- | --- |
| Node.js / React / vinext | Runtime e interfaz | Procesa estado en navegador; Worker recibe bodies y tráfico técnico | Versiones fijadas; sin telemetría; body no persistido |
| Cloudflare tooling/runtime opcional | Build/runtime compatible con Worker | Si se despliega en Cloudflare, el proveedor de borde procesa tráfico y bodies cifrados en tránsito | Despliegue condicionado a DPA, región/transferencias y body logging off |
| FastAPI / Starlette / Uvicorn / Pydantic | Contrato API y cálculo | Body personal en memoria | Access log de body/query off; dependencias fijadas |
| Motores propios Python/edge | Reglas deterministas | Entrada normalizada en memoria del backend seleccionado | Sin red de usuario; edge identificado como aproximado y sin fallback automático |
| MapLibre/deck.gl u otra librería de mapa instalada | Render local | Métricas/teselas públicas | Sin token/telemetría; teselas propias |
| Tile service propio | Teselas públicas | Ruta de tesela y datos técnicos | Sin inputs personales |
| NumPy / SciPy / scikit-learn / joblib | Laboratorio estadístico offline | Hogares sintéticos generados localmente | Fuera del runtime; no cargar joblib no confiable |
| Tailwind / CSS tooling | Build y estilos | Ninguno en runtime externo | Compilado local |
| Drizzle/D1 starter | Persistencia técnica opcional | **No** hogares/resultados | No activar tabla personal; revisar antes de uso |

No se cargan Google Fonts, CDN JS, mapas con tokens, advertising, social widgets, session replay o error SDK de terceros por defecto.

## Desarrollo y CI

| Tercero | Propósito | Datos | Control |
| --- | --- | --- | --- |
| GitHub | Git, issues, PR, Actions, releases | Código, fixtures sintéticos, identidad de contributors; nunca simulaciones reales | 2FA, branch/environment protection, private advisories |
| npm registry | Dependencias Node | Metadata de descarga | Lockfile, audit, provenance |
| Python Package Index | Dependencias Python | Metadata de descarga | Requirements fijados, pip-audit/hash cuando se adopte |
| Docker Hub official images | Bases Node/Python | Metadata de pull | Digest/SBOM/scanner en release |

Las Actions de GitHub se restringen a checkout/setup/cache/upload oficiales necesarios y permisos read-only salvo job de release.

## Fuentes de datos

AEAT, INE, Seguridad Social, Ministerio de Hacienda, organismos autonómicos y EUROMOD son publishers o referencias, no receptores de peticiones personales. Los adaptadores descargan datasets en jobs separados y respetan términos; el API no les consulta con datos del hogar.

## Alta de un tercero

Antes de merge:

1. justificar necesidad y alternativa propia;
2. mapear campos, endpoints, subencargados, ubicación y retención;
3. comprobar licencia, seguridad, DPA y transferencias;
4. impedir body/form capture y entrenamiento;
5. actualizar CSP, DPIA, threat model, retención y tests;
6. fijar versión y añadir SBOM;
7. obtener revisión privacy/security.

Un script añadido por marketing no es un cambio menor y bloquea release hasta revisión.

## Reconciliación de release

Adjuntar:

```bash
npm ls --all
python -m pip freeze
docker sbom <imagen>   # o herramienta equivalente
```

Comparar con esta tabla y explicar cualquier dependencia runtime nueva o red saliente.

Las excepciones activas y su caducidad están en [dependency-exceptions.md](dependency-exceptions.md).
