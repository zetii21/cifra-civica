import type { Metadata } from "next";
import coverage from "@/model-manifest/coverage.json";
import { MethodologyNav } from "@/components/MethodologyNav";
import { Eyebrow, Notice } from "@/components/Ui";

export const metadata: Metadata = { title: "Modelo de cálculo" };

export default function ModelMethodologyPage() {
  const dimensions = Object.entries(coverage.dimensions);
  return (
    <div className="shell page-shell methodology-page">
      <MethodologyNav />
      <div className="page-header">
        <Eyebrow>Motor Python · determinista</Eyebrow>
        <h1 className="page-title">61.980.085.440 estados auditables.</h1>
        <p className="page-intro">La cifra mide el espacio combinatorio discretizado que el motor Python puede calcular o rechazar de forma estructurada. No son registros de personas, pesos de una IA ni evidencia transferible al motor edge de contingencia.</p>
      </div>
      <div className="formula-card">
        <span>Fórmula de cobertura</span>
        <strong>{coverage.formula}</strong>
        <b>= {coverage.declaredStateCount.toLocaleString("es-ES")}</b>
      </div>
      <div className="dimension-grid">
        {dimensions.map(([name, dimension]) => (
          <article key={name}>
            <span>{name}</span>
            <strong>{dimension.count.toLocaleString("es-ES")}</strong>
            <p>{dimension.description}</p>
          </article>
        ))}
      </div>
      <Notice tone="info" title="Qué significa “parámetro” aquí">
        Los parámetros legales reales se cuentan por separado en el registro de políticas.
        Esta métrica grande describe combinaciones de estados de entrada y resultado. El
        validador vuelve a calcularla en cada integración continua y falla si el manifiesto
        no coincide con el modelo publicado.
      </Notice>
      <div className="prose-content">
        <h2>Grafo de variables</h2>
        <p>Ingresos brutos → cotizaciones → bases general y del ahorro → mínimos personales y familiares → cuotas estatal y autonómica → deducciones/créditos → renta disponible.</p>
        <h2>Modelos incluidos</h2>
        <ul>
          <li>Declaración individual y conjunta con comparación cuando existe elegibilidad.</li>
          <li>IRPF estatal general y del ahorro.</li>
          <li>Arquitectura autonómica separada; proxy explícito mientras termina la validación territorial.</li>
          <li>Cotización de asalariados y aproximación declarada para autónomos.</li>
          <li>Pensiones, desempleo, prestaciones observables y créditos de escenario.</li>
          <li>Agregación ponderada, distribución, desigualdad, pobreza, incertidumbre y supresión.</li>
        </ul>
        <h2>Referencias externas</h2>
        <p>AEAT Renta Web Open se usa para casos manuales; EUROMOD para contraste agregado; OpenFisca aporta el patrón de variables, parámetros fechados y pruebas. Ninguno se presenta como integrado en producción si no lo está.</p>
      </div>
    </div>
  );
}
