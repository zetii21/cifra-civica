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
        <p>La arquitectura cambia de comunidad a municipio, distrito o sección según zoom y calidad. Esta versión publica solo geometría y métricas DEMO; nunca microdatos del hogar. <Link href="/methodology/data">Ver datos y procedencia <ArrowRight size={15} aria-hidden="true" /></Link></p>
      </div>
      <div className="shell"><ExplorerClient /></div>
    </div>
  );
}
