import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Eyebrow } from "@/components/Ui";
import { ExplorerClient } from "@/components/ExplorerClient";

export const metadata: Metadata = { title: "Explorador territorial" };

export default function ExplorerPage() {
  return (
    <div className="explorer-page">
      <div className="shell explorer-header">
        <div><Eyebrow>Explorador territorial · muestra sintética</Eyebrow><h1 className="page-title">Contexto, impacto e incertidumbre en el mismo mapa.</h1></div>
        <p>El mapa usa límites estadísticos oficiales generalizados (NUTS-2, © EuroGeographics) con métricas DEMO reproducibles; nunca microdatos del hogar. Las palancas reales de ingresos y gasto viven en el laboratorio fiscal. <Link href="/methodology/data">Ver datos y procedencia <ArrowRight size={15} aria-hidden="true" /></Link></p>
      </div>
      <div className="shell"><ExplorerClient /></div>
    </div>
  );
}
