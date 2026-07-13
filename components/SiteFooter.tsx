import Link from "next/link";
import { Brand } from "./SiteHeader";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <div>
          <Brand />
          <p className="footer-summary">
            Información fiscal neutral, trazable y sin perfiles políticos.
          </p>
          <p className="fine-print">
            Este simulador ofrece una estimación informativa. No es una declaración
            tributaria, asesoramiento legal ni un cálculo oficial de una autoridad pública.
          </p>
        </div>
        <div>
          <h2>Producto</h2>
          <Link href="/calculator">Calculadora</Link>
          <Link href="/scenarios">Escenarios</Link>
          <Link href="/explorer">Explorador</Link>
          <Link href="/updates">Actualizaciones</Link>
        </div>
        <div>
          <h2>Transparencia</h2>
          <Link href="/methodology">Metodología</Link>
          <Link href="/methodology/data">Fuentes de datos</Link>
          <Link href="/methodology/limitations">Limitaciones</Link>
          <Link href="/feedback">Correcciones</Link>
        </div>
        <div>
          <h2>Protección</h2>
          <Link href="/privacy">Privacidad</Link>
          <Link href="/terms">Condiciones</Link>
          <Link href="/accessibility">Accesibilidad</Link>
          <span className="version-chip">Modelo 0.1 · pre-lanzamiento</span>
        </div>
      </div>
    </footer>
  );
}
