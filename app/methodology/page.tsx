import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Braces, ChartNoAxesCombined, Database, FlaskConical, Scale } from "lucide-react";
import { Eyebrow, Notice } from "@/components/Ui";
import { MethodologyNav } from "@/components/MethodologyNav";

export const metadata: Metadata = { title: "Metodología" };

export default function MethodologyPage() {
  const sections = [
    { href: "/methodology/model", icon: Braces, title: "Motor de reglas", text: "Variables fechadas, fórmulas deterministas, parámetros versionados y herencia de escenarios." },
    { href: "/methodology/statistical-study", icon: ChartNoAxesCombined, title: "Seis millones de pruebas", text: "Muestreo reproducible, modelos comparados, sensibilidad de variables, error fuera de muestra y latencia." },
    { href: "/methodology/data", icon: Database, title: "Datos y procedencia", text: "Inventario de fuentes, fecha de acceso, cobertura, licencia, transformaciones y calidad." },
    { href: "/methodology/validation", icon: FlaskConical, title: "Pruebas y contraste", text: "Casos de hogar, propiedades, reconciliación, benchmarks y puertas de publicación." },
    { href: "/methodology/limitations", icon: Scale, title: "Alcance honesto", text: "Territorios, figuras fiscales y hechos documentales que todavía no modelamos." },
  ];
  return (
    <div className="shell page-shell methodology-page">
      <MethodologyNav />
      <div className="page-header">
        <Eyebrow>Método público · versión 0.1</Eyebrow>
        <h1 className="page-title">No basta con enseñar una cifra.</h1>
        <p className="page-intro">También publicamos de dónde sale, qué no sabe el modelo y qué debe pasar antes de considerarlo validado.</p>
      </div>
      <Notice tone="warning" title="Estado de pre-lanzamiento">
        La arquitectura está operativa, pero la referencia legal 2027 y las escalas
        autonómicas requieren revisión experta antes de un uso electoral público.
      </Notice>
      <div className="method-card-grid">
        {sections.map(({ href, icon: Icon, title, text }) => (
          <Link className="method-card" href={href} key={href}>
            <Icon aria-hidden="true" />
            <h2>{title}</h2><p>{text}</p><span>Leer sección <ArrowRight size={16} aria-hidden="true" /></span>
          </Link>
        ))}
      </div>
      <section className="method-principles">
        <div><span>01</span><h2>La ley es código versionado</h2><p>Los valores no viven en botones ni componentes visuales.</p></div>
        <div><span>02</span><h2>La incertidumbre es un resultado</h2><p>Falta de datos, proxy o ambigüedad elevan el nivel mostrado.</p></div>
        <div><span>03</span><h2>La política no es una recomendación</h2><p>El producto compara efectos económicos, no preferencias.</p></div>
      </section>
    </div>
  );
}
