"use client";

import { SpainMap } from "./SpainMap";

const signedInteger = new Intl.NumberFormat("es-ES", {
  maximumFractionDigits: 0,
  signDisplay: "exceptZero",
});

/**
 * Client wrapper so the server-rendered widget page can hand plain data to
 * the interactive map (functions cannot cross the RSC boundary).
 */
export function WidgetMap({ values }: { values: Record<string, number> }) {
  return (
    <SpainMap
      values={values}
      formatValue={(value) => `${signedInteger.format(Math.round(value))} € por hogar y año`}
      metricLabel="Impacto neto por hogar (€/hogar·año)"
      compact
    />
  );
}
