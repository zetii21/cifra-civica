"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Download,
  FileJson,
  Info,
  Printer,
  ShieldAlert,
} from "lucide-react";
import { useCalculator } from "@/app/providers";
import { Notice, StatusBadge } from "@/components/Ui";
import { formatCents } from "@/lib/format";
import type { ScenarioResult, SimulationComparison } from "@/lib/domain";

function deltaClass(amount: number): string {
  return amount > 0 ? "delta-positive" : amount < 0 ? "delta-negative" : "delta-neutral";
}

function downloadFile(filename: string, contents: string, type: string) {
  const blob = new Blob([contents], { type });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(href);
}

function safeExport(result: SimulationComparison) {
  return {
    taxYear: result.taxYear,
    modelVersion: result.modelVersion,
    calculationTimestamp: result.calculationTimestamp,
    inputCompleteness: result.inputCompleteness,
    territorialSupport: result.territorialSupport,
    filingModeUsed: result.filingModeUsed,
    calculationBackend: result.calculationBackend,
    dataRetention: result.dataRetention,
    scenarios: result.scenarioResults.map((scenario) => ({
      id: scenario.scenarioId,
      name: scenario.scenarioName,
      policyVersion: scenario.policyVersion,
      validationStatus: scenario.validationStatus,
      annual: scenario.annual,
      monthlyEquivalent: scenario.monthlyEquivalent,
      changeFromBaseline: scenario.changeFromBaseline,
      uncertainty: scenario.uncertainty,
    })),
  };
}

function ResultCard({ scenario, isBaseline }: { scenario: ScenarioResult; isBaseline: boolean }) {
  const change = scenario.changeFromBaseline.totalDisposableIncome;
  const components = [
    ["Ingresos brutos", scenario.annual.grossHouseholdIncome],
    ["Cotizaciones", -scenario.annual.socialSecurityContributions],
    ["IRPF estatal", -scenario.annual.stateIrpfBeforeCredits],
    ["IRPF autonómico", -scenario.annual.autonomousIrpfBeforeCredits],
    ["Deducciones y créditos", scenario.annual.deductionsAndCredits],
    ["Ayudas en efectivo", scenario.annual.cashBenefits],
    ["Renta disponible", scenario.annual.estimatedDisposableIncome],
  ] as const;

  return (
    <article className={`result-scenario-card ${isBaseline ? "baseline-card" : ""}`}>
      <div className="result-card-heading">
        <div>
          <StatusBadge tone={scenario.scenarioId.includes("demo") ? "demo" : "warning"}>
            {isBaseline ? "REFERENCIA" : "DEMO SINTÉTICA"}
          </StatusBadge>
          <h2>{scenario.scenarioName}</h2>
        </div>
        <span className="confidence-chip"><ShieldAlert size={15} aria-hidden="true" /> Incertidumbre alta</span>
      </div>

      <div className="result-number-block">
        <div>
          <span>Renta disponible estimada</span>
          <strong>{formatCents(scenario.annual.estimatedDisposableIncome)}</strong>
          <small>{formatCents(scenario.monthlyEquivalent.estimatedDisposableIncome)} / mes</small>
        </div>
        <div className={deltaClass(change)}>
          <span>{isBaseline ? "Punto de partida" : "Cambio frente a referencia"}</span>
          <strong>{isBaseline ? "—" : `${change >= 0 ? "+" : ""}${formatCents(change)}`}</strong>
          <small>{isBaseline ? "" : `${change >= 0 ? "+" : ""}${formatCents(scenario.monthlyEquivalent.changeFromBaseline)} / mes`}</small>
        </div>
      </div>

      <div className="component-table-wrap">
        <table className="component-table">
          <caption>Desglose anual de {scenario.scenarioName}</caption>
          <tbody>
            {components.map(([label, amount], index) => (
              <tr key={label} className={index === components.length - 1 ? "total-row" : ""}>
                <th scope="row">{label}</th>
                <td>{formatCents(amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!isBaseline ? (
        <div className="reconciliation">
          <h3>Cómo se reconcilia el cambio</h3>
          <div className="waterfall" aria-hidden="true">
            {[
              scenario.changeFromBaseline.socialSecurityContributions,
              scenario.changeFromBaseline.stateIrpf,
              scenario.changeFromBaseline.autonomousIrpf,
              scenario.changeFromBaseline.benefits,
            ].map((amount, index) => (
              <span
                key={index}
                className={deltaClass(amount)}
                style={{ height: `${Math.max(12, Math.min(72, Math.abs(amount / 10000)))}px` }}
              />
            ))}
          </div>
          <table className="reconcile-table">
            <thead><tr><th>Componente</th><th>Cambio</th></tr></thead>
            <tbody>
              <tr><th scope="row">Cotizaciones</th><td>{formatCents(scenario.changeFromBaseline.socialSecurityContributions)}</td></tr>
              <tr><th scope="row">IRPF estatal</th><td>{formatCents(scenario.changeFromBaseline.stateIrpf)}</td></tr>
              <tr><th scope="row">IRPF autonómico</th><td>{formatCents(scenario.changeFromBaseline.autonomousIrpf)}</td></tr>
              <tr><th scope="row">Créditos y ayudas</th><td>{formatCents(scenario.changeFromBaseline.benefits)}</td></tr>
              <tr className="total-row"><th scope="row">Total</th><td>{formatCents(change)}</td></tr>
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="result-details">
        <details>
          <summary>Cómo se calcula</summary>
          <div>
            <p>
              El motor suma ingresos sujetos y exentos, estima cotizaciones, separa base
              general y del ahorro, aplica mínimos y calcula por separado las cuotas estatal
              y autonómica. Después resta impuestos y cotizaciones de los ingresos.
            </p>
            <p>Modalidad y redondeo se conservan en el registro del modelo.</p>
          </div>
        </details>
        <details>
          <summary>Supuestos utilizados ({scenario.assumptions.length})</summary>
          <ul>{scenario.assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}</ul>
        </details>
        <details>
          <summary>Limitaciones ({scenario.warnings.length})</summary>
          <ul>{scenario.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
        </details>
        <details>
          <summary>Fuentes y versión</summary>
          <div>
            <p>Política {scenario.policyVersion} · validación {scenario.validationStatus}</p>
            <ul>
              {scenario.sourceReferences.map((source) => (
                <li key={source.id}>
                  <a href={source.href} rel="noreferrer" target={source.href.startsWith("http") ? "_blank" : undefined}>
                    {source.title}
                  </a>{" "}({source.publisher}, revisado {source.reviewedAt})
                </li>
              ))}
            </ul>
          </div>
        </details>
      </div>
    </article>
  );
}

export default function ResultsPage() {
  const { result, resetCalculator } = useCalculator();

  if (!result) {
    return (
      <div className="shell page-shell empty-results">
        <Info size={34} aria-hidden="true" />
        <h1 className="page-title">Todavía no hay un resultado.</h1>
        <p>Completa los cuatro pasos para crear una comparación en memoria.</p>
        <Link className="button" href="/calculator">
          Abrir calculadora <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </div>
    );
  }

  return (
    <div className="results-page">
      <div className="results-hero">
        <div className="shell">
          <Link className="back-link no-print" href="/calculator/scenarios"><ArrowLeft size={16} aria-hidden="true" /> Editar comparación</Link>
          <div className="results-title-row">
            <div>
              <p className="eyebrow">Tu comparación · estimación informativa</p>
              <h1>El resultado, con todas sus piezas.</h1>
            </div>
            <div className="result-meta-grid">
              <span><b>Ejercicio</b>2027</span>
              <span><b>Declaración</b>{result.filingModeUsed === "joint" ? "Conjunta" : "Individual"}</span>
              <span><b>Modelo</b>{result.modelVersion}</span>
              <span>
                <b>Motor</b>
                {result.calculationBackend === "python_api"
                  ? "API fiscal Python"
                  : "API edge de contingencia"}
              </span>
              <span><b>Retención</b>No almacenado</span>
            </div>
          </div>
          <Notice tone="warning" title="Referencia de pre-lanzamiento">
            {result.globalWarnings.join(" ")}
          </Notice>
        </div>
      </div>

      <div className="shell results-content">
        <div className="result-actions no-print">
          <button
            type="button"
            onClick={() =>
              downloadFile(
                "cifra-civica-resumen.json",
                JSON.stringify(safeExport(result), null, 2),
                "application/json",
              )
            }
          ><FileJson size={17} aria-hidden="true" /> Descargar JSON</button>
          <button
            type="button"
            onClick={() => {
              const rows = [
                "escenario,version,renta_disponible_anual,cambio_anual,cambio_mensual",
                ...result.scenarioResults.map((scenario) =>
                  [
                    JSON.stringify(scenario.scenarioName),
                    scenario.policyVersion,
                    (scenario.annual.estimatedDisposableIncome / 100).toFixed(2),
                    (scenario.changeFromBaseline.totalDisposableIncome / 100).toFixed(2),
                    (scenario.monthlyEquivalent.changeFromBaseline / 100).toFixed(2),
                  ].join(","),
                ),
              ];
              downloadFile("cifra-civica-resumen.csv", rows.join("\n"), "text/csv;charset=utf-8");
            }}
          ><Download size={17} aria-hidden="true" /> Descargar CSV</button>
          <button type="button" onClick={() => window.print()}><Printer size={17} aria-hidden="true" /> Imprimir</button>
        </div>

        <div className="result-scenario-list">
          {result.scenarioResults.map((scenario, index) => (
            <ResultCard key={scenario.scenarioId} scenario={scenario} isBaseline={index === 0} />
          ))}
        </div>

        <section className="result-governance">
          <div>
            <CheckCircle2 aria-hidden="true" />
            <h2>La misma entrada produce el mismo resultado.</h2>
            <p>El cálculo es determinista. Un modelo de lenguaje no genera ni modifica ninguna cifra.</p>
          </div>
          <dl>
            <div><dt>ID de cálculo</dt><dd>{result.requestId}</dd></div>
            <div><dt>Fecha UTC</dt><dd>{new Date(result.calculationTimestamp).toLocaleString("es-ES")}</dd></div>
            <div><dt>Completitud</dt><dd>{result.inputCompleteness}</dd></div>
            <div><dt>Cobertura</dt><dd>{result.territorialSupport}</dd></div>
          </dl>
        </section>

        <div className="results-bottom-actions no-print">
          <button className="button button-danger" type="button" onClick={resetCalculator}>
            Borrar y empezar de nuevo
          </button>
          <Link className="button button-quiet" href="/methodology/limitations">Revisar limitaciones</Link>
        </div>
      </div>
    </div>
  );
}
