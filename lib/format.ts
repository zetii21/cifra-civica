export const euro = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export const euroDetailed = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCents(cents: number, detailed = false): string {
  return (detailed ? euroDetailed : euro).format(cents / 100);
}

export function centsFromEuros(value: string | number): number {
  const parsed = typeof value === "number" ? value : Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

export function eurosFromCents(cents: number): number {
  return Math.round(cents / 100);
}
