import { notFound } from "next/navigation";
import coverage from "@/model-manifest/coverage.json";
import { SCENARIOS } from "@/lib/policy-catalog";

export const dynamic = "force-dynamic";

export default function ModelDiagnosticsPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div className="shell page-shell">
      <div className="page-header">
        <p className="eyebrow">Solo desarrollo · sin solicitudes personales</p>
        <h1 className="page-title">Diagnóstico del modelo</h1>
        <p className="page-intro">Metadatos de compilación, políticas y servicios públicos. Esta ruta no lee cuerpos de cálculo.</p>
      </div>
      <div className="dimension-grid">
        <article><span>Versión modelo web</span><strong>0.1.0</strong><p>Grafo determinista TypeScript.</p></article>
        <article><span>Políticas instaladas</span><strong>{SCENARIOS.length}</strong><p>{SCENARIOS.map((scenario) => scenario.policyVersion).join(", ")}</p></article>
        <article><span>Espacio de estados</span><strong>{coverage.declaredStateCount.toLocaleString("es-ES")}</strong><p>Manifiesto {coverage.metricVersion}</p></article>
        <article><span>Fecha de parámetros</span><strong>2025–26</strong><p>Referencia 2027 pendiente.</p></article>
        <article><span>Tile service</span><strong>:3102</strong><p>demo-es-2027.1 · comprobar /health.</p></article>
        <article><span>Datos personales</span><strong>0</strong><p>No se muestran, registran ni persisten.</p></article>
      </div>
    </div>
  );
}
