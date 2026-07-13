import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Eyebrow, StatusBadge } from "@/components/Ui";
import { FiscalLabClient } from "@/components/FiscalLabClient";

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
              Cómo se calcula y valida <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </p>
          <div className="lab-header-badges">
            <StatusBadge tone="official">Solo estadísticas agregadas</StatusBadge>
            <StatusBadge tone="demo">Referencia aproximada 2024</StatusBadge>
          </div>
        </div>
      </div>
      <div className="shell">
        <FiscalLabClient />
      </div>
    </div>
  );
}
