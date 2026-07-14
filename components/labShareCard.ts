/**
 * Client-side share-card renderer for the national laboratory. Draws a PNG
 * entirely in the browser with canvas — no personal data, no URLs, no
 * network round trip — and triggers a local download.
 */

export interface ShareCardData {
  presetName?: string;
  balanceDeltaMEur: number;
  revenueDeltaMEur: number;
  spendingDeltaMEur: number;
  deficitBeforeShare: number;
  deficitAfterShare: number;
  mostAffected: Array<{ label: string; value: number }>;
  leastAffected: Array<{ label: string; value: number }>;
  activeChanges: number;
}

const eurFormat = new Intl.NumberFormat("es-ES", {
  maximumFractionDigits: 0,
  signDisplay: "exceptZero",
});
const pctFormat = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 });

export function downloadShareCard(data: ShareCardData): void {
  const width = 1200;
  const height = 630;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return;

  // Background and frame.
  context.fillStyle = "#f4f1e9";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#102b2c";
  context.fillRect(0, 0, width, 12);

  const sans = "'Segoe UI', 'Helvetica Neue', Arial, sans-serif";

  // Brand row.
  context.fillStyle = "#146a5e";
  context.fillRect(56, 52, 10, 34);
  context.fillRect(70, 62, 10, 24);
  context.fillRect(84, 44, 10, 42);
  context.fillStyle = "#102b2c";
  context.font = `700 30px ${sans}`;
  context.fillText("Cifra Cívica — laboratorio fiscal", 110, 76);
  context.font = `500 20px ${sans}`;
  context.fillStyle = "#4c5e5c";
  context.fillText(
    data.presetName ? `Escenario: ${data.presetName}` : "Escenario propio del usuario",
    56,
    122,
  );

  // Headline balance.
  const positive = data.balanceDeltaMEur >= 0;
  context.fillStyle = positive ? "#146a5e" : "#aa5144";
  context.font = `600 84px Georgia, serif`;
  context.fillText(`${eurFormat.format(Math.round(data.balanceDeltaMEur))} M€`, 56, 220);
  context.fillStyle = "#102b2c";
  context.font = `600 26px ${sans}`;
  context.fillText("cambio anual del saldo público", 56, 258);
  context.fillStyle = "#4c5e5c";
  context.font = `400 22px ${sans}`;
  context.fillText(
    `Ingresos ${eurFormat.format(Math.round(data.revenueDeltaMEur))} M€ · Gasto ${eurFormat.format(Math.round(data.spendingDeltaMEur))} M€ · Déficit ${pctFormat.format(data.deficitBeforeShare)} % → ${pctFormat.format(data.deficitAfterShare)} % del PIB`,
    56,
    292,
  );

  // Winners / losers columns.
  const drawGroup = (
    title: string,
    entries: Array<{ label: string; value: number }>,
    x: number,
    color: string,
  ) => {
    context.fillStyle = "#102b2c";
    context.font = `700 22px ${sans}`;
    context.fillText(title, x, 360);
    context.font = `400 21px ${sans}`;
    entries.slice(0, 3).forEach((entry, index) => {
      context.fillStyle = "#4c5e5c";
      const label = entry.label.length > 30 ? `${entry.label.slice(0, 29)}…` : entry.label;
      context.fillText(label, x, 396 + index * 34);
      context.fillStyle = color;
      context.font = `700 21px ${sans}`;
      context.fillText(
        `${eurFormat.format(Math.round(entry.value))} €/año`,
        x + 330,
        396 + index * 34,
      );
      context.font = `400 21px ${sans}`;
    });
  };
  drawGroup("Más afectados", data.mostAffected, 56, "#aa5144");
  drawGroup("Más beneficiados", data.leastAffected, 620, "#146a5e");

  // Footer.
  context.fillStyle = "#102b2c";
  context.fillRect(0, height - 86, width, 86);
  context.fillStyle = "#a8d6c3";
  context.font = `600 20px ${sans}`;
  context.fillText(
    `${data.activeChanges} palancas modificadas · simulador cívico transparente`,
    56,
    height - 50,
  );
  context.fillStyle = "#c4d0cd";
  context.font = `400 17px ${sans}`;
  context.fillText(
    "Referencia aproximada 2024 · estimación informativa, no una liquidación oficial · sin recomendación de voto",
    56,
    height - 22,
  );

  const link = document.createElement("a");
  link.download = "cifra-civica-escenario.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
}
