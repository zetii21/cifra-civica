import type { Metadata } from "next";
import study from "@/model-lab/artifacts/study-report.json";
import nationalStudy from "@/model-lab/artifacts/national-study-report.json";
import { MethodologyNav } from "@/components/MethodologyNav";
import { Eyebrow, Notice, StatusBadge } from "@/components/Ui";

export const metadata: Metadata = { title: "Estudio estadístico" };

const MODEL_NAMES: Record<string, string> = {
  ridge_linear: "Ridge lineal",
  extra_trees: "Extra Trees",
  hist_gradient_boosting: "Boosting por histogramas",
};

const FEATURE_NAMES: Record<string, string> = {
  employment_income_primary_eur: "Salario principal",
  employment_income_secondary_eur: "Salario secundario",
  self_employment_income_eur: "Rendimiento de autónomos",
  pension_income_eur: "Pensiones",
  property_income_eur: "Rentas inmobiliarias",
  capital_gains_net_eur: "Plusvalías netas",
  unemployment_benefits_eur: "Prestación por desempleo",
  eligible_descendants: "Descendientes elegibles",
  adult_count: "Número de adultos",
  community_index: "Comunidad autónoma",
};

export default function StatisticalStudyPage() {
  const modelRows = Object.entries(study.modelComparison);
  const sensitivity = study.baselineDisposableIncomeSensitivity;

  return (
    <div className="shell page-shell methodology-page">
      <MethodologyNav />
      <div className="page-header">
        <Eyebrow>Estudio ejecutado · semilla {study.seed}</Eyebrow>
        <h1 className="page-title">
          {study.coverage.exactScenarioEvaluations.toLocaleString("es-ES")} pruebas fiscales exactas.
        </h1>
        <p className="page-intro">
          El estudio recorre hogares sintéticos, reserva casos nunca vistos y compara
          tres familias de modelos estadísticos. Sus aproximaciones sirven para
          sensibilidad y control del motor Python; el resultado `edge_api` se identifica
          como aproximación separada y no hereda esta validación.
        </p>
      </div>

      <div className="dimension-grid">
        <article>
          <span>Hogares sintéticos</span>
          <strong>{study.coverage.syntheticHouseholdsEvaluated.toLocaleString("es-ES")}</strong>
          <p>Generados sin microdatos personales, con semilla reproducible.</p>
        </article>
        <article>
          <span>Variables estudiadas</span>
          <strong>{study.coverage.featureCount}</strong>
          <p>Ingresos, hogar, territorio, cotización, capital y circunstancias.</p>
        </article>
        <article>
          <span>Validación fuera de muestra</span>
          <strong>{study.coverage.holdoutHouseholds.toLocaleString("es-ES")}</strong>
          <p>Hogares que no participaron en el ajuste de los modelos.</p>
        </article>
        <article>
          <span>Motor exacto</span>
          <strong>{study.exactSweep.meanExactScenarioMicroseconds.toLocaleString("es-ES")} μs</strong>
          <p>Tiempo medio por escenario en la pasada paralela de referencia.</p>
        </article>
      </div>

      <Notice tone="success" title="Invariantes superadas">
        La transferencia infantil coincidió exactamente con su regla estructural y la
        rebaja estatal no redujo renta disponible en ninguno de los dos millones de
        hogares. Incumplimientos observados: 0.
      </Notice>

      <div className="prose-content">
        <h2>Comparación fuera de muestra</h2>
        <p>
          Error al aproximar la renta disponible anual de referencia. Un error menor
          ayuda a localizar zonas difíciles del modelo, pero no autoriza a sustituir el
          cálculo normativo.
        </p>
        <div className="table-scroll">
          <table className="map-data-table">
            <caption>Rendimiento sobre {study.coverage.holdoutHouseholds.toLocaleString("es-ES")} hogares reservados</caption>
            <thead>
              <tr><th>Modelo</th><th>MAE</th><th>RMSE</th><th>Error p95</th><th>R²</th></tr>
            </thead>
            <tbody>
              {modelRows.map(([modelId, model]) => {
                const metric = model.targets.baseline_disposable_income_eur;
                return (
                  <tr key={modelId}>
                    <th scope="row">{MODEL_NAMES[modelId] ?? modelId}</th>
                    <td>{metric.maeEur.toLocaleString("es-ES")} €</td>
                    <td>{metric.rmseEur.toLocaleString("es-ES")} €</td>
                    <td>{metric.p95AbsoluteErrorEur.toLocaleString("es-ES")} €</td>
                    <td>{metric.r2.toLocaleString("es-ES", { maximumFractionDigits: 5 })}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <h2>Sensibilidad observada</h2>
        <p>
          La importancia por permutación mide cuánto empeora el modelo al desordenar una
          variable. Describe este diseño sintético; no demuestra causalidad.
        </p>
        <div className="table-scroll">
          <table className="map-data-table">
            <caption>
              Las {study.coverage.featureCount} variables, ordenadas por influencia predictiva
              sobre renta disponible
            </caption>
            <thead>
              <tr><th>Variable</th><th>Aumento del error MAE</th><th>Dirección lineal</th><th>Rango observado</th></tr>
            </thead>
            <tbody>
              {sensitivity.map((row) => (
                <tr key={row.feature}>
                  <th scope="row">{FEATURE_NAMES[row.feature] ?? row.feature.replaceAll("_", " ")}</th>
                  <td>{row.permutationMaeIncreaseEur.toLocaleString("es-ES")} €</td>
                  <td>{row.pearsonDirection > 0.02 ? "Positiva" : row.pearsonDirection < -0.02 ? "Negativa" : "No lineal / débil"}</td>
                  <td>{row.observedMin.toLocaleString("es-ES")} – {row.observedMax.toLocaleString("es-ES")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2>Estudio del laboratorio fiscal nacional</h2>
        <p>
          El laboratorio de ingresos y gasto agregados tiene su propio estudio de
          referencia. Un segundo motor, independiente y vectorizado, reproduce los{" "}
          {nationalStudy.engineEquivalence.scenarios} escenarios dorados del motor de la
          web con una desviación máxima del{" "}
          {(nationalStudy.engineEquivalence.maxRelativeGap * 100).toLocaleString("es-ES", { maximumFractionDigits: 2 })}{" "}
          %, y después recorre de forma exhaustiva cada tramo del IRPF, la escala del
          ahorro, cada tributo y cada partida de gasto, incluidas todas las
          combinaciones por pares de tramos estatales.
        </p>
        <div className="table-scroll">
          <table className="map-data-table">
            <caption>Recuento auditable del estudio nacional comprometido en el repositorio</caption>
            <thead>
              <tr><th>Magnitud</th><th>Valor</th><th>Qué es</th></tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Aplicaciones de parámetro-caso</th>
                <td>{nationalStudy.coverage.parameterCaseApplications.toLocaleString("es-ES")}</td>
                <td>Celdas (unidad sintética × parámetro fiscal) realmente calculadas</td>
              </tr>
              <tr>
                <th scope="row">Evaluaciones de variante</th>
                <td>{nationalStudy.coverage.variantEvaluations.toLocaleString("es-ES")}</td>
                <td>Configuraciones de palancas evaluadas sobre la población completa</td>
              </tr>
              <tr>
                <th scope="row">Unidades sintéticas</th>
                <td>{nationalStudy.coverage.microUnits.toLocaleString("es-ES")}</td>
                <td>Malla determinista de cuantiles: sin microdatos ni personas reales</td>
              </tr>
              <tr>
                <th scope="row">Palancas cubiertas</th>
                <td>{nationalStudy.coverage.leverCount.toLocaleString("es-ES")}</td>
                <td>Tramos de IRPF y ahorro, escalas autonómicas, tributos y partidas</td>
              </tr>
              <tr>
                <th scope="row">Violaciones de monotonía</th>
                <td>{nationalStudy.invariants.monotonicity.violations.toLocaleString("es-ES")}</td>
                <td>Sobre {nationalStudy.invariants.monotonicity.checked.toLocaleString("es-ES")} pares consecutivos comprobados</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          El recuento mide trabajo determinista ejecutado y contado desde las formas
          exactas de los arrays; no son pesos de una red neuronal, personas ni filas
          almacenadas. Cualquier cambio en el modelo del laboratorio invalida la firma
          del informe y obliga a reejecutar el estudio.
        </p>

        <h2>Velocidad y decisión de arquitectura</h2>
        <p>
          El sustituto seleccionado calcula cinco objetivos con una latencia mediana de {" "}
          {study.selectedDiagnosticModel.singlePredictionLatency.medianMilliseconds.toLocaleString("es-ES")} ms
          por hogar en Python. El motor exacto es más rápido en esta implementación y no
          introduce error estadístico; por eso responde directamente a los cambios del usuario.
        </p>
        <p>
          <StatusBadge tone="demo">ARTEFACTO DIAGNÓSTICO</StatusBadge>{" "}
          SHA-256 y versiones quedan en el informe reproducible del repositorio. Nunca se
          carga un archivo de modelo no confiable en la aplicación pública.
        </p>
      </div>

      <Notice tone="warning" title="Límite esencial">
        Los hogares del estudio son sintéticos. La importancia estadística depende del
        muestreo y la referencia legal 2027 todavía debe actualizarse cuando exista la
        normativa aplicable.
      </Notice>
    </div>
  );
}
