import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, GitCompareArrows, MapPin, Zap } from "lucide-react";
import { Eyebrow, StatusBadge } from "@/components/Ui";
import { FiscalLabClient } from "@/components/FiscalLabClient";
import { COMMUNITIES } from "@/lib/fiscal-lab";
import { slugOf } from "@/lib/fiscal-lab/community-pages";

export const metadata: Metadata = {
  title: "Laboratorio fiscal de España",
  description:
    "Modifica tipos de IRPF, IVA, carburantes, juego o patrimonio y el gasto en educación, defensa o carreteras, y observa el efecto por comunidad, renta, familia y edad.",
};

export default function LaboratorioPage() {
  return (
    <div className="lab-page">
      <div className="shell lab-header">
        <div>
          <Eyebrow>Laboratorio fiscal · agregados públicos</Eyebrow>
          <h1 className="page-title">El presupuesto de España, en tus manos.</h1>
        </div>
        <div className="lab-header-side">
          <p>
            Sube o baja cada tramo del IRPF, el ahorro, los carburantes, el juego, las
            loterías o el patrimonio; mueve el gasto en educación, defensa o carreteras, en
            toda España o comunidad a comunidad, y mira al instante quién gana, quién pierde
            y qué pasa con el déficit.{" "}
            <Link href="/methodology/statistical-study">
              Cómo se calcula y valida <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </p>
          <div className="lab-header-badges">
            <StatusBadge tone="official">Solo estadísticas agregadas</StatusBadge>
            <StatusBadge tone="demo">Referencia aproximada 2024</StatusBadge>
          </div>
        </div>
      </div>
      <div className="shell lab-tools-strip" aria-label="Herramientas del laboratorio">
        <Link href="/laboratorio/comparador">
          <GitCompareArrows size={14} aria-hidden="true" /> Comparador de paquetes
        </Link>
        <Link href="/laboratorio/directo">
          <Zap size={14} aria-hidden="true" /> Modo directo (debates)
        </Link>
        <details className="lab-tools-communities">
          <summary>
            <MapPin size={14} aria-hidden="true" /> Tu comunidad
          </summary>
          <nav aria-label="Laboratorios por comunidad">
            {COMMUNITIES.map((community) => (
              <Link key={community.code} href={`/laboratorio/${slugOf(community.code)}`}>
                {community.name}
              </Link>
            ))}
          </nav>
        </details>
      </div>
      <div className="shell">
        <FiscalLabClient />
      </div>
    </div>
  );
}
