import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Clock3, DatabaseZap, Eye, LockKeyhole } from "lucide-react";
import { Eyebrow, Notice } from "@/components/Ui";

export const metadata: Metadata = {
  title: "Calculadora fiscal",
  description: "Compara el impacto estimado de escenarios fiscales sobre tu hogar.",
};

export default function CalculatorStartPage() {
  return (
    <div className="shell page-shell calculator-start">
      <div className="page-header">
        <Eyebrow>Calculadora personal · 4 pasos</Eyebrow>
        <h1 className="page-title">Una estimación que enseña sus cuentas.</h1>
        <p className="page-intro">
          Necesitaremos cifras anuales aproximadas de tu hogar. No pedimos nombre, DNI,
          dirección ni preferencia política.
        </p>
      </div>
      <div className="calculator-start-grid">
        <div className="content-card content-card-padding start-panel">
          <span className="start-index">Antes de empezar</span>
          <h2>Ten a mano cuatro datos</h2>
          <ul className="start-checklist">
            <li><Clock3 aria-hidden="true" /><div><strong>5–7 minutos</strong><span>Puedes usar cifras aproximadas.</span></div></li>
            <li><DatabaseZap aria-hidden="true" /><div><strong>Ingresos anuales brutos</strong><span>Trabajo, autónomos, pensiones y prestaciones.</span></div></li>
            <li><Eye aria-hidden="true" /><div><strong>Composición del hogar</strong><span>Personas adultas y dependientes por edad.</span></div></li>
            <li><LockKeyhole aria-hidden="true" /><div><strong>Sin cuenta</strong><span>La estimación se calcula sin crear un perfil.</span></div></li>
          </ul>
          <Link className="button" href="/calculator/household">
            Empezar <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>
        <aside className="start-aside">
          <Notice tone="warning" title="Referencia 2027 en preparación">
            La normativa 2027 todavía no está disponible. Este corte usa parámetros
            revisados de 2025–2026 y muestra una incertidumbre alta.
          </Notice>
          <div className="aside-card">
            <h2>Qué no hacemos</h2>
            <ul>
              <li>No presentamos una declaración de la renta.</li>
              <li>No recomendamos partidos.</li>
              <li>No inferimos opiniones políticas.</li>
              <li>No enviamos tus cifras a analítica.</li>
            </ul>
            <Link href="/privacy">Leer la política de privacidad</Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
