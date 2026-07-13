import Link from "next/link";

const steps = [
  { href: "/calculator/household", label: "Hogar" },
  { href: "/calculator/income", label: "Ingresos" },
  { href: "/calculator/housing-benefits", label: "Vivienda" },
  { href: "/calculator/scenarios", label: "Comparar" },
];

export function ProgressSteps({ current }: { current: number }) {
  return (
    <nav className="progress-steps" aria-label="Progreso de la calculadora">
      <ol>
        {steps.map((step, index) => (
          <li
            key={step.href}
            aria-current={index === current ? "step" : undefined}
            data-complete={index < current ? "true" : "false"}
          >
            <Link href={step.href}>
              <span>{index + 1}</span>
              {step.label}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}
