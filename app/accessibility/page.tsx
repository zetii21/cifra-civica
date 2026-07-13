import type { Metadata } from "next";
import { GovernancePage } from "@/components/GovernancePage";

export const metadata: Metadata = { title: "Accesibilidad" };

export default function AccessibilityPage() {
  return <GovernancePage eyebrow="Accesibilidad" title="Una cifra pública debe poder leerse de más de una forma." intro="El objetivo del MVP es WCAG 2.2 AA, navegación por teclado, textos claros y alternativas tabulares para gráficos."><h2>Incluido</h2><ul><li>Enlace para saltar al contenido y orden de foco lógico.</li><li>Etiquetas y ayudas asociadas a controles.</li><li>Errores y avisos que no dependen solo del color.</li><li>Tablas equivalentes para comparaciones y cascadas.</li><li>Escalas de color accesibles, estados de no datos y patrones de incertidumbre.</li><li>Respeto de movimiento reducido y vista de impresión.</li></ul><h2>Compatibilidad objetivo</h2><p>Versiones actuales de navegadores modernos, zoom al 200 %, teclado, VoiceOver y NVDA en combinaciones documentadas.</p><h2>Problemas</h2><p>La ruta de feedback permite comunicar una barrera sin compartir datos fiscales. Las incidencias de acceso tienen prioridad de corrección.</p></GovernancePage>;
}
