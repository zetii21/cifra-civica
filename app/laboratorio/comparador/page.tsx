import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Eyebrow } from "@/components/Ui";
import { ComparadorClient } from "@/components/ComparadorClient";

export const metadata: Metadata = {
  title: "Comparador de paquetes de gobierno",
  description:
    "Compara lado a lado el efecto fiscal simulado de trayectorias de gobierno documentadas y arquetipos de política: ingresos, gasto, déficit y quién gana o pierde.",
};

export default function ComparadorPage() {
  return (
    <div className="lab-page">
      <div className="shell lab-header">
        <div>
          <Eyebrow>Comparador · agregados públicos</Eyebrow>
          <h1 className="page-title">Compara paquetes, no eslóganes.</h1>
        </div>
        <div className="lab-header-side">
          <p>
            Hasta tres paquetes lado a lado con el mismo trato visual: ingresos, gasto,
            déficit resultante y el impacto por decil de renta y territorio. Cifra Cívica
            nunca ordena por «mejor» ni recomienda voto.{" "}
            <Link href="/laboratorio">
              <ArrowLeft size={14} aria-hidden="true" /> Volver al laboratorio
            </Link>
          </p>
        </div>
      </div>
      <div className="shell">
        <ComparadorClient />
      </div>
    </div>
  );
}
