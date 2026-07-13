import type { Metadata } from "next";
import { GovernancePage } from "@/components/GovernancePage";

export const metadata: Metadata = { title: "Condiciones de uso" };

export default function TermsPage() {
  return <GovernancePage eyebrow="Condiciones" title="Información, no asesoramiento." intro="Cifra Cívica ayuda a explorar supuestos fiscales y no sustituye una declaración, una autoridad ni un profesional cualificado."><h2>Uso permitido</h2><p>Puedes usar la herramienta para aprender, comparar escenarios publicados y descargar tus propios resúmenes. Debes revisar fuentes y limitaciones antes de tomar decisiones.</p><h2>Sin garantía de resultado oficial</h2><p>La legislación cambia y muchos hechos fiscales requieren documentación que el formulario no recoge. Ninguna cifra constituye una liquidación o derecho reconocido.</p><h2>Neutralidad</h2><p>No uses el servicio para inferir opiniones políticas, crear audiencias, perfilar votantes o dirigir persuasión personalizada.</p><h2>Datos y reutilización</h2><p>Cada conjunto público conserva sus condiciones de origen. Los datos sintéticos están marcados DEMO y no pueden presentarse como estadísticas oficiales.</p><h2>Correcciones</h2><p>Los errores reproducibles se documentan, corrigen y publican en el historial de cambios.</p></GovernancePage>;
}
