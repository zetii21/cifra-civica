import type { Metadata } from "next";
import { MethodologyNav } from "@/components/MethodologyNav";
import { Eyebrow, Notice, StatusBadge } from "@/components/Ui";

export const metadata: Metadata = { title: "Datos y procedencia" };

const sources = [
  ["AEAT", "IRPF y Renta Web Open", "Reglas y contraste", "Oficial"],
  ["INE ECV", "Condiciones de vida", "Microsimulación futura", "Acceso público anonimizado"],
  ["INE ADRH", "Atlas de renta", "Contexto territorial", "Oficial agregado"],
  ["Seguridad Social", "Cotización y pensiones", "Parámetros y contraste", "Oficial"],
  ["EUROMOD", "Modelo España", "Benchmark metodológico", "Acceso condicionado"],
];

export default function DataMethodologyPage() {
  return (
    <div className="shell page-shell methodology-page">
      <MethodologyNav />
      <div className="page-header"><Eyebrow>Inventario de datos</Eyebrow><h1 className="page-title">Oficial, simulado o no disponible.</h1><p className="page-intro">Cada capa muestra su naturaleza, periodo, cobertura, licencia y advertencias de calidad.</p></div>
      <Notice tone="warning" title="Esta demo no contiene microdatos oficiales">
        El mapa de impacto usa un conjunto sintético claramente marcado. Los conectores
        oficiales están preparados, pero una publicación real exige ingesta, licencia,
        calibración y validación separadas.
      </Notice>
      <div className="data-source-table-wrap">
        <table className="data-source-table">
          <thead><tr><th>Publicador</th><th>Fuente</th><th>Uso</th><th>Naturaleza</th></tr></thead>
          <tbody>{sources.map(([publisher, source, use, kind]) => <tr key={publisher}><th scope="row">{publisher}</th><td>{source}</td><td>{use}</td><td><StatusBadge tone={kind.includes("Oficial") ? "official" : "neutral"}>{kind}</StatusBadge></td></tr>)}</tbody>
        </table>
      </div>
      <div className="prose-content">
        <h2>Ciclo de procedencia</h2><ol><li>Instantánea raw con checksum y condiciones de reutilización.</li><li>Staging con tipos y códigos geográficos oficiales.</li><li>Curado con diccionario y controles de calidad.</li><li>Calibración contra agregados comparables.</li><li>Publicación solo de resultados agregados con umbrales.</li></ol>
        <h2>Separación estricta</h2><p>Las entradas personales nunca se unen a la capa territorial, no crean microdatos y no se distribuyen al navegador como registros. El explorador consume exclusivamente métricas agregadas.</p>
      </div>
    </div>
  );
}
