import type { Metadata } from "next";
import { MethodologyNav } from "@/components/MethodologyNav";
import { Eyebrow, StatusBadge } from "@/components/Ui";

export const metadata: Metadata = { title: "Limitaciones" };

export default function LimitationsPage() {
  const territories = [
    ["Territorio común", "Parcial", "Arquitectura operativa; escalas autonómicas pendientes de revisión completa"],
    ["Canarias", "Parcial", "Impuestos directos en arquitectura; IGIC y consumo excluidos"],
    ["Navarra", "No compatible", "No se aplican reglas comunes al régimen foral"],
    ["País Vasco", "No compatible", "No se aplican reglas comunes a las haciendas forales"],
    ["Ceuta y Melilla", "No compatible", "Tratamiento especial pendiente de validación"],
  ];
  return (
    <div className="shell page-shell methodology-page">
      <MethodologyNav />
      <div className="page-header"><Eyebrow>Alcance del MVP</Eyebrow><h1 className="page-title">Lo que el modelo no sabe también se publica.</h1><p className="page-intro">No rellenamos lagunas con una cifra silenciosa. Un territorio o figura sin fidelidad suficiente devuelve una limitación explícita.</p></div>
      <div className="coverage-table-wrap"><table className="coverage-table"><thead><tr><th>Ámbito</th><th>Estado</th><th>Comportamiento</th></tr></thead><tbody>{territories.map(([name, status, behavior]) => <tr key={name}><th scope="row">{name}</th><td><StatusBadge tone={status === "Parcial" ? "warning" : "neutral"}>{status}</StatusBadge></td><td>{behavior}</td></tr>)}</tbody></table></div>
      <div className="prose-content"><h2>Fuera del MVP</h2><ul><li>IVA, IGIC, impuestos especiales e incidencia del consumo.</li><li>Patrimonio, sucesiones y donaciones.</li><li>Deducciones que exigen documentos o hechos no preguntados.</li><li>Reconstrucción histórica de derechos contributivos.</li><li>Todas las reglas forales de Navarra y País Vasco.</li><li>Predicción de conducta, empleo, precios o respuesta macroeconómica.</li></ul><h2>Precisión</h2><p>Las cantidades no son una autoliquidación. Un proxy autonómico, una cifra aproximada o un escenario ambiguo eleva la incertidumbre. Antes de 2027 deben revisarse todas las fechas efectivas y fuentes.</p></div>
    </div>
  );
}
