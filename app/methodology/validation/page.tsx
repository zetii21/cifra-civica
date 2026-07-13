import type { Metadata } from "next";
import { Check, CircleDashed } from "lucide-react";
import { MethodologyNav } from "@/components/MethodologyNav";
import { Eyebrow, Notice } from "@/components/Ui";

export const metadata: Metadata = { title: "Validación" };

export default function ValidationPage() {
  const layers = [
    ["Unidades", "Límites de tramo, mínimos, redondeo y fechas", true],
    ["Propiedades", "Determinismo, reconciliación, herencia y territorios", true],
    ["API", "Contratos, errores, tamaño y redacción de logs", true],
    ["Estudio estadístico", "6 millones de evaluaciones exactas y 500.000 hogares fuera de muestra", true],
    ["Hogares dorados", "Comparación manual con Renta Web Open", false],
    ["Agregado", "Contraste alineado con EUROMOD, AEAT e INE", false],
    ["Revisión fiscal 2027", "Aprobación humana de cada territorio y propuesta", false],
  ] as const;
  return (
    <div className="shell page-shell methodology-page">
      <MethodologyNav />
      <div className="page-header"><Eyebrow>Validación por capas</Eyebrow><h1 className="page-title">Pasar una prueba no convierte una hipótesis en ley.</h1><p className="page-intro">Separamos calidad del software, revisión de fuentes, hogares contrastados y validación agregada.</p></div>
      <div className="validation-list">{layers.map(([title, text, complete]) => <article key={title}>{complete ? <Check aria-hidden="true" /> : <CircleDashed aria-hidden="true" />}<div><h2>{title}</h2><p>{text}</p></div><span>{complete ? "Implementado" : "Pendiente antes de producción"}</span></article>)}</div>
      <Notice tone="warning" title="Puerta de publicación">
        Ningún escenario puede llamarse “validado” sin fuentes, casos de hogar aplicables,
        conciliación, revisión humana y benchmarks dentro de tolerancias documentadas.
      </Notice>
      <div className="prose-content"><h2>Referencias de contraste</h2><p>Renta Web Open es una referencia manual; no se raspa. EUROMOD se usa bajo sus condiciones de acceso y definiciones. Las estadísticas de AEAT, INE y Seguridad Social solo se comparan cuando periodo y población están alineados.</p><h2>Privacidad como regresión</h2><p>Las pruebas fallan si un cuerpo de solicitud aparece en logs, si una URL contiene campos del hogar, si se añade seguimiento de formularios o si el servidor intenta persistir una simulación personal.</p></div>
    </div>
  );
}
