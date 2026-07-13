import Link from "next/link";

const links = [
  ["/methodology", "Resumen"],
  ["/methodology/model", "Modelo"],
  ["/methodology/statistical-study", "Estudio estadístico"],
  ["/methodology/data", "Datos"],
  ["/methodology/validation", "Validación"],
  ["/methodology/limitations", "Limitaciones"],
];

export function MethodologyNav() {
  return (
    <nav className="method-nav" aria-label="Secciones de metodología">
      {links.map(([href, label]) => <Link href={href} key={href}>{label}</Link>)}
    </nav>
  );
}
