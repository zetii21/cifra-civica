import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Eyebrow } from "@/components/Ui";
import { DirectoClient } from "@/components/DirectoClient";

export const metadata: Metadata = {
  title: "Modo directo",
  description:
    "Dimensiona en segundos cuánto cuesta o recauda una promesa anunciada en un debate: una palanca, una magnitud y una fact-card lista para compartir.",
};

export default function DirectoPage() {
  return (
    <div className="lab-page">
      <div className="shell lab-header">
        <div>
          <Eyebrow>Modo directo · debates y ruedas de prensa</Eyebrow>
          <h1 className="page-title">El coste de una promesa, en 30 segundos.</h1>
        </div>
        <div className="lab-header-side">
          <p>
            Elige la palanca que toca la propuesta, fija la magnitud anunciada y descarga la
            fact-card con el efecto en ingresos, déficit y hogares. Misma vara de medir para
            todos los partidos.{" "}
            <Link href="/laboratorio">
              <ArrowLeft size={14} aria-hidden="true" /> Volver al laboratorio
            </Link>
          </p>
        </div>
      </div>
      <div className="shell">
        <DirectoClient />
      </div>
    </div>
  );
}
