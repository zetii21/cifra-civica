import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Eyebrow, Notice, StatusBadge } from "@/components/Ui";
import { FiscalLabClient } from "@/components/FiscalLabClient";
import {
  baselineSchedules,
  COMMUNITIES,
  IRPF_TARGET_MEUR,
  SPENDING_PROGRAMS,
} from "@/lib/fiscal-lab";
import {
  allCommunitySlugs,
  communityBySlug,
  slugOf,
} from "@/lib/fiscal-lab/community-pages";

export const dynamicParams = false;

export function generateStaticParams(): Array<{ slug: string }> {
  return allCommunitySlugs().map((slug) => ({ slug }));
}

const integerFormat = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 });
const decimalFormat = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 });

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const community = communityBySlug(slug);
  if (!community) return { title: "Laboratorio fiscal" };
  return {
    title: `Laboratorio fiscal de ${community.name}`,
    description: `Escala autonómica del IRPF, tributos propios y gasto público de referencia de ${community.name}, con palancas ajustables e impacto simulado por renta, familia y edad.`,
  };
}

export default async function CommunityLabPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const community = communityBySlug(slug);
  if (!community) notFound();

  const schedules = baselineSchedules();
  const schedule =
    community.regime === "foral"
      ? schedules.foralGeneral[community.code]
      : schedules.autonomousGeneral[community.code] ?? schedules.stateGeneral;
  const scheduleKind =
    community.regime === "foral"
      ? "Escala foral aproximada (cuota íntegra completa)"
      : schedules.autonomousGeneral[community.code]
        ? "Escala autonómica vigente (registro de políticas, 2025)"
        : "Escala complementaria estatal (sin tarifa propia)";

  const irpfReference = IRPF_TARGET_MEUR[community.code];
  const regionalSpending = SPENDING_PROGRAMS.filter(
    (program) => program.regionalShare > 0.3,
  ).map((program) => ({
    name: program.shortName,
    amount: program.baselineMEur * program.regionalWeights[community.code],
  }));

  return (
    <div className="lab-page">
      <div className="shell lab-header">
        <div>
          <Eyebrow>Laboratorio fiscal · {community.name}</Eyebrow>
          <h1 className="page-title">{`${community.name}, palanca a palanca.`}</h1>
        </div>
        <div className="lab-header-side">
          <p>
            La ficha fiscal de la comunidad y el laboratorio completo con sus palancas
            preseleccionadas: IRPF {community.regime === "foral" ? "foral" : "autonómico"},
            tributos propios y gasto gestionado.{" "}
            <Link href="/laboratorio">
              <ArrowLeft size={14} aria-hidden="true" /> Laboratorio de toda España
            </Link>
          </p>
          <div className="lab-header-badges">
            <StatusBadge tone={community.regime === "foral" ? "warning" : "official"}>
              {community.regime === "foral"
                ? "Régimen foral"
                : community.regime === "ciudad_autonoma"
                  ? "Ciudad autónoma"
                  : "Régimen común"}
            </StatusBadge>
            <StatusBadge tone="demo">Referencia aproximada 2024</StatusBadge>
          </div>
        </div>
      </div>

      <div className="shell community-facts">
        <div className="community-fact-grid">
          <article>
            <span>Población</span>
            <strong>{integerFormat.format(community.populationThousands * 1000)}</strong>
          </article>
          <article>
            <span>Hogares</span>
            <strong>{integerFormat.format(community.householdsThousands * 1000)}</strong>
          </article>
          <article>
            <span>PIB regional</span>
            <strong>{integerFormat.format(community.gdpMEur)} M€</strong>
          </article>
          <article>
            <span>IRPF de referencia</span>
            <strong>{integerFormat.format(irpfReference)} M€/año</strong>
          </article>
        </div>

        <div className="community-panels">
          <section className="community-panel">
            <h2>{scheduleKind}</h2>
            <div className="table-scroll">
              <table className="map-data-table">
                <caption>
                  Tramos de la base general aplicables en {community.name}
                  {community.regime === "foral" ? " (aproximación señalada)" : ""}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Desde</th>
                    <th scope="col">Tipo marginal</th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.map((bracket) => (
                    <tr key={bracket.thresholdEur}>
                      <th scope="row">{integerFormat.format(bracket.thresholdEur)} €</th>
                      <td>{decimalFormat.format(bracket.ratePercent)} %</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="community-panel">
            <h2>Gasto de referencia con ejecución autonómica</h2>
            <div className="table-scroll">
              <table className="map-data-table">
                <caption>
                  Parte aproximada de cada programa localizada en {community.name}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Programa</th>
                    <th scope="col">Referencia anual</th>
                  </tr>
                </thead>
                <tbody>
                  {regionalSpending.map((entry) => (
                    <tr key={entry.name}>
                      <th scope="row">{entry.name}</th>
                      <td>{integerFormat.format(Math.round(entry.amount))} M€</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {community.regime === "foral" ? (
          <Notice tone="warning" title="Hacienda foral">
            {community.name} recauda sus propios impuestos concertados. La escala mostrada
            es una aproximación revisada y señalada; ninguna regla de territorio común se
            aplica por sustitución.
          </Notice>
        ) : null}
      </div>

      <div className="shell">
        <FiscalLabClient initialScope={community.code} />
      </div>

      <div className="shell community-links">
        <h2>Todas las comunidades</h2>
        <nav aria-label="Laboratorios por comunidad">
          {COMMUNITIES.map((entry) => (
            <Link
              key={entry.code}
              href={`/laboratorio/${slugOf(entry.code)}`}
              aria-current={entry.code === community.code ? "page" : undefined}
            >
              {entry.name}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
