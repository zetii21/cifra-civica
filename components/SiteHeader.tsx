import Link from "next/link";
import { ArrowUpRight, Menu } from "lucide-react";

const links = [
  { href: "/calculator", label: "Calculadora" },
  { href: "/laboratorio", label: "Laboratorio" },
  { href: "/scenarios", label: "Escenarios" },
  { href: "/explorer", label: "Mapa" },
  { href: "/methodology", label: "Método" },
];

export function Brand() {
  return (
    <Link className="brand" href="/" aria-label="Cifra Cívica, inicio">
      <span className="brand-mark" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span>Cifra Cívica</span>
    </Link>
  );
}

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Brand />
        <nav className="desktop-nav" aria-label="Navegación principal">
          {links.map((link) => (
            <Link href={link.href} key={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>
        <Link className="button button-small header-cta" href="/calculator">
          Calcular impacto <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
        <details className="mobile-nav">
          <summary aria-label="Abrir navegación">
            <Menu size={22} aria-hidden="true" />
          </summary>
          <nav aria-label="Navegación móvil">
            {links.map((link) => (
              <Link href={link.href} key={link.href}>
                {link.label}
              </Link>
            ))}
            <Link href="/calculator">Calcular impacto</Link>
          </nav>
        </details>
      </div>
    </header>
  );
}
