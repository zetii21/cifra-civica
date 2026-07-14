import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, ExternalLink, GitCompareArrows } from "lucide-react";
import { Notice, StatusBadge } from "@/components/Ui";
import { SCENARIOS, getScenario } from "@/lib/policy-catalog";

export function generateStaticParams() {
  return SCENARIOS.map((scenario) => ({ scenarioSlug: scenario.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ scenarioSlug: string }>;
}): Promise<Metadata> {
  const scenario = getScenario((await params).scenarioSlug);
  return scenario
    ? { title: scenario.publicName, description: scenario.shortDescription }
    : { title: "Escenario no encontrado" };
}

export default async function ScenarioDetailPage({
  params,
}: {
  params: Promise<{ scenarioSlug: string }>;
}) {
  const scenario = getScenario((await params).scenarioSlug);
  if (!scenario) notFound();
  const overrideEntries = Object.entries(scenario.overrides);

  return (
    <div className="shell page-shell scenario-detail">
      <Link className="back-link dark-back" href="/scenarios"><ArrowLeft size={17} aria-hidden="true" /> Todos los escenarios</Link>
      <div className="scenario-detail-header">
        <div>
          <StatusBadge tone={scenario.synthetic ? "demo" : "warning"}>
            {scenario.synthetic ? "DEMO — NO ES PROPUESTA OFICIAL" : "REFERENCIA EN REVISIÓN"}
          </StatusBadge>
          <h1 className="page-title">{scenario.publicName}</h1>
          <p className="page-intro">{scenario.shortDescription}</p>
        </div>
        <dl className="scenario-summary-box">
          <div><dt>Ejercicio</dt><dd>{scenario.taxYear}</dd></div>
          <div><dt>Estado</dt><dd>{scenario.status}</dd></div>
          <div><dt>Validación</dt><dd>{scenario.validationStatus}</dd></div>
          <div><dt>Versión</dt><dd>{scenario.policyVersion}</dd></div>
          <div><dt>Territorio</dt><dd>Régimen común (parcial)</dd></div>
          <div><dt>Última revisión</dt><dd>{scenario.sources[0]?.reviewedAt}</dd></div>
        </dl>
      </div>

      {scenario.synthetic ? (
        <Notice tone="warning" title="Escenario exclusivamente sintético">
          Sirve para probar el motor, la interfaz y la reconciliación. No se atribuye a
          ningún partido, candidatura o institución.
        </Notice>
      ) : null}

      <div className="scenario-detail-grid">
        <div className="scenario-main stack-lg">
          <section className="content-card content-card-padding">
            <p className="eyebrow">Interpretación</p>
            <h2>Qué representa</h2>
            <p>{scenario.shortDescription}</p>
            <p>
              Hereda el motor de referencia <code>{scenario.inheritedBaseline ?? "base técnica"}</code>.
              Ningún valor vive en la interfaz: el registro declara los cambios y el motor
              resuelve las fórmulas deterministas.
            </p>
          </section>
          <section className="content-card content-card-padding">
            <div className="section-icon-title"><GitCompareArrows aria-hidden="true" /><div><p className="eyebrow">Diferencia paramétrica</p><h2>Cambios frente a referencia</h2></div></div>
            {overrideEntries.length ? (
              <table className="parameter-table">
                <thead><tr><th>Parámetro</th><th>Operación</th><th>Valor</th></tr></thead>
                <tbody>
                  {overrideEntries.map(([name, value]) => (
                    <tr key={name}><th scope="row"><code>{name}</code></th><td>Sustituir / ajustar</td><td>{String(value)}</td></tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="muted">La referencia no sobrescribe parámetros; define el punto de partida.</p>}
          </section>
          <section className="content-card content-card-padding">
            <p className="eyebrow">Decisiones de modelado</p>
            <h2>Supuestos</h2>
            <ol className="numbered-list">{scenario.assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}</ol>
          </section>
          <section className="content-card content-card-padding">
            <p className="eyebrow">Proveniencia</p>
            <h2>Fuentes registradas</h2>
            <div className="source-list">
              {scenario.sources.map((source) => (
                <a href={source.href} key={source.id} rel="noreferrer" target={source.href.startsWith("http") ? "_blank" : undefined}>
                  <span><strong>{source.title}</strong><small>{source.publisher} · revisado {source.reviewedAt}</small></span>
                  <ExternalLink size={17} aria-hidden="true" />
                </a>
              ))}
            </div>
          </section>
        </div>
        <aside className="scenario-aside stack">
          <div className="aside-card validation-box">
            <CheckCircle2 aria-hidden="true" />
            <h2>Cobertura de prueba</h2>
            <ul>
              <li>Esquema validado</li>
              <li>Herencia comprobada</li>
              <li>Casos de hogar ejecutados</li>
              <li>Reconciliación monetaria</li>
            </ul>
            <p>Estado: {scenario.validationStatus}</p>
          </div>
          <div className="aside-card">
            <h2>Limitaciones conocidas</h2>
            <ul>{scenario.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul>
          </div>
          <Link className="button" href="/calculator/household">
            Probar en calculadora <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </aside>
      </div>
    </div>
  );
}
