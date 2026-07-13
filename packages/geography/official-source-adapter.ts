import type { GeographyLevel, SuppressionStatus } from "./types";

export type OfficialSourceCategory =
  | "manual_tax_regression"
  | "tax_aggregate"
  | "income_context"
  | "public_use_microdata"
  | "official_geography"
  | "social_security_aggregate"
  | "legal_rules"
  | "benchmark_model";

export type IngestionPermission =
  | "manual_reference_only"
  | "public_snapshot"
  | "approved_research_snapshot"
  | "future_extension";

export interface OfficialSourceProfile {
  readonly id: string;
  readonly name: string;
  readonly publisher: string;
  readonly category: OfficialSourceCategory;
  readonly sourceReference: string;
  readonly ingestionPermission: IngestionPermission;
  readonly purpose: string;
  readonly finestExpectedGeography: GeographyLevel | "household_public_use" | "individual_test_case";
  readonly automationNotes: string;
  readonly restrictedDataMayNotBeCommitted: boolean;
}

export const OFFICIAL_SOURCE_PROFILES: readonly OfficialSourceProfile[] = [
  {
    id: "aeat-renta-web-open",
    name: "Renta Web Open",
    publisher: "Agencia Estatal de Administración Tributaria",
    category: "manual_tax_regression",
    sourceReference: "https://sede.agenciatributaria.gob.es/Sede/ayuda/consultas-informaticas/renta-ayuda-tecnica/renta-web-open.html",
    ingestionPermission: "manual_reference_only",
    purpose: "Referencia manual para casos de regresión de IRPF; no es una fuente de datos agregados.",
    finestExpectedGeography: "individual_test_case",
    automationNotes: "No raspar ni automatizar sin permiso expreso y revisión de condiciones.",
    restrictedDataMayNotBeCommitted: true,
  },
  {
    id: "aeat-irpf-declarations",
    name: "Estadística de los declarantes del IRPF",
    publisher: "Agencia Estatal de Administración Tributaria",
    category: "tax_aggregate",
    sourceReference: "https://sede.agenciatributaria.gob.es/Sede/datosabiertos/catalogo/hacienda/Estadistica_de_los_declarantes_del_IRPF.shtml",
    ingestionPermission: "public_snapshot",
    purpose: "Validación agregada de bases, cuotas y componentes de renta.",
    finestExpectedGeography: "province",
    automationNotes: "Importar únicamente publicaciones reutilizables y conservar sus umbrales editoriales.",
    restrictedDataMayNotBeCommitted: true,
  },
  {
    id: "aeat-irpf-municipalities",
    name: "Estadística del IRPF por municipios",
    publisher: "Agencia Estatal de Administración Tributaria",
    category: "tax_aggregate",
    sourceReference: "https://sede.agenciatributaria.gob.es/Sede/datosabiertos/catalogo/hacienda/Estadistica_de_los_declarantes_del_IRPF_por_municipios.shtml",
    ingestionPermission: "public_snapshot",
    purpose: "Contexto y calibración municipal en territorio fiscal común.",
    finestExpectedGeography: "municipality",
    automationNotes: "Mantener exclusiones territoriales y umbrales de publicación de AEAT.",
    restrictedDataMayNotBeCommitted: true,
  },
  {
    id: "aeat-irpf-postcodes",
    name: "Estadística del IRPF por código postal",
    publisher: "Agencia Estatal de Administración Tributaria",
    category: "tax_aggregate",
    sourceReference: "https://sede.agenciatributaria.gob.es/AEAT/Contenidos_Comunes/La_Agencia_Tributaria/Estadisticas/Publicaciones/sites/irpfCodPostal/2023/docs/irpfCodPostal/markoff_metod_irpfcodpost2023.pdf",
    ingestionPermission: "public_snapshot",
    purpose: "Capa urbana opcional para grandes municipios cuando geometría y reutilización lo permitan.",
    finestExpectedGeography: "postcode",
    automationNotes: "Preservar secreto estadístico, filas Resto y mínimo de declaraciones indicado por AEAT.",
    restrictedDataMayNotBeCommitted: true,
  },
  {
    id: "ine-ecv",
    name: "Encuesta de Condiciones de Vida",
    publisher: "Instituto Nacional de Estadística",
    category: "public_use_microdata",
    sourceReference: "https://www.ine.es/daco/daco42/condivi/ecv_metodo.pdf",
    ingestionPermission: "approved_research_snapshot",
    purpose: "Fundamento de muestra armonizada de hogares y validación distributiva.",
    finestExpectedGeography: "household_public_use",
    automationNotes: "No publicar registros de encuesta ni incluir microdatos descargados en Git.",
    restrictedDataMayNotBeCommitted: true,
  },
  {
    id: "ine-epf",
    name: "Encuesta de Presupuestos Familiares",
    publisher: "Instituto Nacional de Estadística",
    category: "public_use_microdata",
    sourceReference: "https://www.ine.es/dyngs/INEbase/es/operacion.htm?c=Estadistica_C&cid=1254736176806&idp=1254735976608&menu=resultados",
    ingestionPermission: "future_extension",
    purpose: "Extensión futura para incidencia del consumo, IVA e impuestos especiales.",
    finestExpectedGeography: "household_public_use",
    automationNotes: "Fuera del MVP; no inferir consumo detallado a partir de la fixture DEMO.",
    restrictedDataMayNotBeCommitted: true,
  },
  {
    id: "ine-adrh",
    name: "Atlas de Distribución de Renta de los Hogares",
    publisher: "Instituto Nacional de Estadística",
    category: "income_context",
    sourceReference: "https://www.ine.es/metodologia/metodologia_adrh.pdf",
    ingestionPermission: "public_snapshot",
    purpose: "Contexto territorial oficial de renta y desigualdad.",
    finestExpectedGeography: "census_section",
    automationNotes: "Respetar no disponible, confidencialidad, vintage y definición de cada indicador.",
    restrictedDataMayNotBeCommitted: true,
  },
  {
    id: "ine-geography",
    name: "Relación de municipios y cartografía censal",
    publisher: "Instituto Nacional de Estadística",
    category: "official_geography",
    sourceReference: "https://www.ine.es/daco/daco42/codmun/codmunmapa.htm",
    ingestionPermission: "public_snapshot",
    purpose: "Códigos y límites oficiales de comunidades, provincias, municipios, distritos y secciones.",
    finestExpectedGeography: "census_section",
    automationNotes: "Unir siempre por códigos oficiales y registrar cambios de límites/códigos.",
    restrictedDataMayNotBeCommitted: false,
  },
  {
    id: "seguridad-social-statistics",
    name: "Estadísticas de la Seguridad Social",
    publisher: "Ministerio de Inclusión, Seguridad Social y Migraciones",
    category: "social_security_aggregate",
    sourceReference: "https://w6.seg-social.es/PXWeb/pxweb/es/",
    ingestionPermission: "public_snapshot",
    purpose: "Contexto de afiliación, contribuciones y pensiones y benchmark agregado.",
    finestExpectedGeography: "municipality",
    automationNotes: "Alinear periodo y definición antes de declarar una validación.",
    restrictedDataMayNotBeCommitted: true,
  },
  {
    id: "hacienda-rules",
    name: "Tributación autonómica",
    publisher: "Ministerio de Hacienda",
    category: "legal_rules",
    sourceReference: "https://www.hacienda.gob.es/es-ES/Areas%20Tematicas/Financiacion%20Autonomica/Paginas/Libro%20electronico.aspx",
    ingestionPermission: "manual_reference_only",
    purpose: "Inventario jurídico estatal y autonómico revisado por especialistas.",
    finestExpectedGeography: "autonomous_community",
    automationNotes: "Las reglas requieren interpretación, revisión fiscal y casos de prueba; no convertir PDF automáticamente en ley validada.",
    restrictedDataMayNotBeCommitted: false,
  },
  {
    id: "euromod-spain",
    name: "EUROMOD Spain",
    publisher: "European Commission Joint Research Centre",
    category: "benchmark_model",
    sourceReference: "https://euromod-web.jrc.ec.europa.eu/resources/country-reports",
    ingestionPermission: "approved_research_snapshot",
    purpose: "Benchmark metodológico y distributivo agregado.",
    finestExpectedGeography: "country",
    automationNotes: "Documentar versión, acceso, cobertura territorial y diferencias de definición.",
    restrictedDataMayNotBeCommitted: true,
  },
  ...[
    ["navarra-rules", "Normativa tributaria de Navarra", "https://www.navarra.es/es/web/normativa-hacienda/normativa", "Comunidad Foral de Navarra"],
    ["basque-rules", "Normativa tributaria foral vasca", "https://www.euskadi.eus/gobierno-vasco/hacienda-finanzas/", "País Vasco"],
    ["canary-rules", "Normativa tributaria canaria", "https://www3.gobiernodecanarias.org/tributos/", "Canarias"],
  ].map(([id, name, sourceReference, territory]) => ({
    id,
    name,
    publisher: territory,
    category: "legal_rules" as const,
    sourceReference,
    ingestionPermission: "future_extension" as const,
    purpose: `Extensión territorial futura para ${territory}; fuera de la cobertura fiscal completa del MVP.`,
    finestExpectedGeography: "autonomous_community" as const,
    automationNotes: "No aplicar reglas de territorio común como sustituto silencioso.",
    restrictedDataMayNotBeCommitted: false,
  })),
] as const;

export interface RawOfficialSnapshot {
  readonly sourceId: string;
  readonly originalFilename: string;
  readonly contentType: string;
  readonly bytes: Uint8Array;
  readonly accessDate: string;
  readonly publicationDate: string | null;
  readonly dataPeriod: string;
  readonly licenceOrReuseConditions: string;
  readonly approvedForProcessing: boolean;
  readonly containsRestrictedMicrodata: boolean;
}

export interface NormalizedOfficialRecord {
  readonly officialGeographyCode: string;
  readonly geographyLevel: GeographyLevel;
  readonly values: Readonly<Record<string, number | string | null>>;
  readonly publisherSuppressionStatus: SuppressionStatus;
  readonly sourceRowReference: string;
}

export interface AdapterResult<T> {
  readonly records: readonly T[];
  readonly warnings: readonly string[];
  readonly rejectedRows: number;
}

export interface OfficialSourceAdapter<T = NormalizedOfficialRecord> {
  readonly profile: OfficialSourceProfile;
  ingest(snapshot: RawOfficialSnapshot): AdapterResult<T>;
}

export class IngestionNotPermittedError extends Error {
  constructor(sourceId: string, permission: IngestionPermission) {
    super(`Automated ingestion is not permitted for ${sourceId} (${permission})`);
    this.name = "IngestionNotPermittedError";
  }
}

export function assertSnapshotMayBeProcessed(
  profile: OfficialSourceProfile,
  snapshot: RawOfficialSnapshot,
): void {
  if (snapshot.sourceId !== profile.id) {
    throw new Error(`Snapshot source ${snapshot.sourceId} does not match adapter ${profile.id}`);
  }
  if (profile.ingestionPermission === "manual_reference_only" || profile.ingestionPermission === "future_extension") {
    throw new IngestionNotPermittedError(profile.id, profile.ingestionPermission);
  }
  if (!snapshot.approvedForProcessing) {
    throw new Error(`Snapshot ${snapshot.originalFilename} has not been approved for processing`);
  }
  if (snapshot.containsRestrictedMicrodata) {
    throw new Error("Restricted microdata cannot enter the public geography pipeline");
  }
}

/** RFC-4180-style parser used by source-specific adapters after a snapshot is approved. */
export function parseDelimitedText(text: string, delimiter = ";"): readonly (readonly string[])[] {
  if (delimiter.length !== 1) throw new Error("Delimiter must be one character");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      row.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }
  if (quoted) throw new Error("Unclosed quoted field in delimited snapshot");
  row.push(field);
  if (row.some((value) => value !== "")) rows.push(row);
  return rows;
}

export interface DelimitedAdapterConfig {
  readonly delimiter?: string;
  readonly geographyCodeColumn: string;
  readonly geographyLevel: GeographyLevel;
  readonly valueColumns: Readonly<Record<string, string>>;
  readonly suppressedTokens?: readonly string[];
}

function parseOfficialValue(value: string, suppressedTokens: ReadonlySet<string>): number | string | null {
  const trimmed = value.trim();
  if (trimmed === "" || suppressedTokens.has(trimmed.toLocaleUpperCase("es-ES"))) return null;
  const normalizedNumber = trimmed
    .replace(/\s/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  const numeric = Number(normalizedNumber);
  return Number.isFinite(numeric) ? numeric : trimmed;
}

export function createDelimitedOfficialAdapter(
  profile: OfficialSourceProfile,
  config: DelimitedAdapterConfig,
): OfficialSourceAdapter {
  return {
    profile,
    ingest(snapshot) {
      assertSnapshotMayBeProcessed(profile, snapshot);
      const text = new TextDecoder("utf-8", { fatal: true }).decode(snapshot.bytes).replace(/^\uFEFF/, "");
      const rows = parseDelimitedText(text, config.delimiter ?? ";");
      if (rows.length === 0) return { records: [], warnings: ["El fichero no contiene filas."], rejectedRows: 0 };
      const header = rows[0].map((column) => column.trim());
      const codeIndex = header.indexOf(config.geographyCodeColumn);
      if (codeIndex < 0) throw new Error(`Missing geography column ${config.geographyCodeColumn}`);
      const valueIndexes = Object.entries(config.valueColumns).map(([metricId, column]) => {
        const index = header.indexOf(column);
        if (index < 0) throw new Error(`Missing value column ${column}`);
        return { metricId, index };
      });
      const suppressedTokens = new Set((config.suppressedTokens ?? ["..", "NA", "N/A", "SECRETO"]).map((token) => token.toLocaleUpperCase("es-ES")));
      const records: NormalizedOfficialRecord[] = [];
      let rejectedRows = 0;

      for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
        const row = rows[rowIndex];
        const code = row[codeIndex]?.trim();
        if (!code) {
          rejectedRows += 1;
          continue;
        }
        const values = Object.fromEntries(valueIndexes.map(({ metricId, index }) => [
          metricId,
          parseOfficialValue(row[index] ?? "", suppressedTokens),
        ]));
        const publisherSuppressed = Object.values(values).some((value) => value === null);
        records.push({
          officialGeographyCode: code,
          geographyLevel: config.geographyLevel,
          values,
          publisherSuppressionStatus: publisherSuppressed ? "suppressed" : "published",
          sourceRowReference: `${snapshot.originalFilename}:${rowIndex + 1}`,
        });
      }
      return {
        records,
        warnings: rejectedRows > 0 ? [`${rejectedRows} fila(s) sin código geográfico se rechazaron.`] : [],
        rejectedRows,
      };
    },
  };
}

export function officialSourceProfile(sourceId: string): OfficialSourceProfile {
  const profile = OFFICIAL_SOURCE_PROFILES.find((candidate) => candidate.id === sourceId);
  if (!profile) throw new Error(`Unknown official source profile: ${sourceId}`);
  return profile;
}
