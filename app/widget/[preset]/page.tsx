import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  buildPresetSettings,
  createDefaultSettings,
  GOVERNMENT_PRESETS,
  simulateNation,
} from "@/lib/fiscal-lab";
import { WidgetMap } from "@/components/WidgetMap";
import { StatusBadge } from "@/components/Ui";

export const dynamicParams = false;

export function generateStaticParams(): Array<{ preset: string }> {
  return [
    { preset: "baseline" },
    ...GOVERNMENT_PRESETS.map((preset) => ({ preset: preset.id })),
  ];
}

const signedInteger = new Intl.NumberFormat("es-ES", {
  maximumFractionDigits: 0,
  signDisplay: "exceptZero",
});
const decimalFormat = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 });

export async function generateMetadata({
  params,
}: {
  params: Promise<{ preset: string }>;
}): Promise<Metadata> {
  const { preset: presetId } = await params;
  const preset = GOVERNMENT_PRESETS.find((entry) => entry.id === presetId);
  return {
    title: preset ? `Widget: ${preset.name}` : "Widget del laboratorio fiscal",
    robots: { index: false, follow: false },
  };
}

export default async function WidgetPage({
  params,
}: {
  params: Promise<{ preset: string }>;
}) {
  const { preset: presetId } = await params;
  const preset = GOVERNMENT_PRESETS.find((entry) => entry.id === presetId);
  if (!preset && presetId !== "baseline") notFound();

  const settings = preset ? buildPresetSettings(preset) : createDefaultSettings();
  const result = simulateNation(settings);
  const deficitShare = (result.totals.simulatedDeficitMEur / result.totals.gdpMEur) * 100;
  const mapValues = Object.fromEntries(
    result.communities.map((community) => [community.code, community.netHouseholdImpactEur]),
  );

  return (
    <div className="widget-shell">
      <div className="widget-top">
        <Link
          className="widget-brand"
          href="/laboratorio"
          target="_top"
          rel="noreferrer"
          aria-label="Abrir el laboratorio fiscal de Cifra Cívica"
        >
          <span className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          Cifra Cívica
        </Link>
        <StatusBadge tone={preset?.kind === "historical" ? "official" : "demo"}>
          {preset
            ? preset.kind === "historical"
              ? "Trayectoria documentada"
              : "Arquetipo sintético"
            : "Referencia sin cambios"}
        </StatusBadge>
      </div>
      <h1>{preset ? preset.name : "El presupuesto de España, en tus manos"}</h1>
      <div className="widget-stats">
        <div>
          <span>Ingresos</span>
          <strong className={result.totals.revenueDeltaMEur < 0 ? "lab-neg" : "lab-pos"}>
            {signedInteger.format(Math.round(result.totals.revenueDeltaMEur))} M€
          </strong>
        </div>
        <div>
          <span>Gasto</span>
          <strong className={result.totals.spendingDeltaMEur > 0 ? "lab-neg" : "lab-pos"}>
            {signedInteger.format(Math.round(result.totals.spendingDeltaMEur))} M€
          </strong>
        </div>
        <div>
          <span>Saldo</span>
          <strong className={result.totals.totalBalanceDeltaMEur < 0 ? "lab-neg" : "lab-pos"}>
            {signedInteger.format(Math.round(result.totals.totalBalanceDeltaMEur))} M€
          </strong>
        </div>
        <div>
          <span>Déficit</span>
          <strong>{decimalFormat.format(deficitShare)} % PIB</strong>
        </div>
      </div>
      <WidgetMap values={mapValues} />
      <p className="widget-footnote">
        Referencia aproximada 2024 · estimación informativa, no oficial · sin recomendación
        de voto ·{" "}
        <Link href="/laboratorio" target="_top" rel="noreferrer">
          abrir el laboratorio completo
        </Link>
      </p>
    </div>
  );
}
