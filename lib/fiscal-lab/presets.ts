/**
 * Government packages for the national laboratory: historical trajectories
 * mapped from documented, enacted measures (with sources) and neutral policy
 * archetypes. Every package is an illustrative application over today's
 * baseline — never a prediction, a 2027 programme or a voting suggestion.
 *
 * Neutrality rules encoded here:
 * - identical visual treatment for every package (uniform tiles; no party
 *   logos — brand marks require a separate rights review);
 * - alphabetical ordering inside each group;
 * - historical packages only exist for parties with national governing
 *   records, mapped from measures actually published in the BOE;
 * - published 2027 programmes can be added later with their own sources and
 *   review; nothing here claims to be one.
 */
import { createDefaultSettings } from "./engine";
import type { PolicySettings } from "./types";

export type PresetKind = "historical" | "archetype";

export interface GovernmentPreset {
  id: string;
  /** Display name of the package. */
  name: string;
  /** Short uniform tile label (2–6 characters). */
  tileLabel: string;
  /** Neutral identifying colour for the uniform tile. */
  color: string;
  kind: PresetKind;
  /** One-sentence description of what the package applies. */
  description: string;
  /** Documented measures the mapping is based on (historical packages). */
  sourceNotes: string[];
  /** Compulsory honesty caveats shown with the package. */
  caveats: string[];
  /** Mutations applied over the default settings. */
  apply: (settings: PolicySettings) => void;
}

export const GOVERNMENT_PRESETS: GovernmentPreset[] = [
  {
    id: "hist_pp_2011_2016",
    name: "Trayectoria de gobierno PP (2011–2016)",
    tileLabel: "PP",
    color: "#3f7fbf",
    kind: "historical",
    description:
      "Dirección fiscal aplicada durante la consolidación 2012–2015: subida del IVA, ajuste del gasto y reforma del IRPF de 2015.",
    sourceNotes: [
      "RDL 20/2012: IVA general del 18 % al 21 % y reducido del 8 % al 10 %.",
      "RDL 20/2011: gravamen complementario temporal del IRPF (2012–2014).",
      "Ley 26/2014: reforma del IRPF con rebaja de tipos desde 2015.",
      "RDL 14/2012 y RDL 16/2012: medidas de ajuste en educación y sanidad.",
    ],
    caveats: [
      "Aplicación ilustrativa de la dirección de medidas 2011–2016 sobre la referencia actual.",
      "No es el programa del partido para 2027 ni una predicción.",
    ],
    apply: (settings) => {
      settings.irpfStateBracketDeltas = [-0.5, -0.5, -0.5, -0.5, -0.5, -0.5];
      settings.instrumentRates.iva_general = 23;
      settings.instrumentRates.iva_reducido = 11;
      settings.spendingMultipliers.educacion = 0.94;
      settings.spendingMultipliers.sanidad = 0.94;
      settings.spendingMultipliers.carreteras = 0.75;
      settings.spendingMultipliers.idi = 0.85;
      settings.spendingMultipliers.cultura = 0.8;
      settings.spendingMultipliers.vivienda = 0.8;
    },
  },
  {
    id: "hist_psoe_2018_2024",
    name: "Trayectoria de gobierno PSOE (2018–2024)",
    tileLabel: "PSOE",
    color: "#c94d43",
    kind: "historical",
    description:
      "Dirección fiscal aplicada 2018–2024: subidas en tramos altos y ahorro, refuerzo de gasto social y creación del IMV.",
    sourceNotes: [
      "Ley 11/2020 (PGE 2021): +2 puntos en la escala general por encima de 300.000 € y +3 en el ahorro por encima de 200.000 €.",
      "Ley 38/2022: impuesto de solidaridad de las grandes fortunas (ya presente en la referencia).",
      "Ley 19/2021 e indexación por IPC de pensiones (Ley 21/2021).",
      "RDL 20/2020: creación del ingreso mínimo vital.",
      "RDL 11/2022 y siguientes: rebajas temporales de IVA e impuesto eléctrico en esenciales.",
    ],
    caveats: [
      "Aplicación ilustrativa de la dirección de medidas 2018–2024 sobre la referencia actual.",
      "No es el programa del partido para 2027 ni una predicción.",
    ],
    apply: (settings) => {
      settings.irpfStateBracketDeltas = [0, 0, 0, 0, 0, 2];
      settings.irpfSavingsBracketDeltas = [0, 0, 0, 1, 3];
      settings.instrumentRates.iva_superreducido = 2;
      settings.spendingMultipliers.pensiones = 1.04;
      settings.spendingMultipliers.sanidad = 1.05;
      settings.spendingMultipliers.educacion = 1.05;
      settings.spendingMultipliers.dependencia = 1.1;
      settings.spendingMultipliers.imv = 1.5;
      settings.spendingMultipliers.defensa = 1.15;
    },
  },
  {
    id: "arquetipo_consolidacion",
    name: "Arquetipo: consolidación presupuestaria",
    tileLabel: "CONS",
    color: "#7a6f5a",
    kind: "archetype",
    description:
      "Paquete sintético de reducción del déficit: más imposición indirecta y contención generalizada del gasto.",
    sourceNotes: [],
    caveats: ["Paquete sintético de demostración; no representa a ningún partido."],
    apply: (settings) => {
      settings.instrumentRates.iva_general = 22;
      settings.instrumentRates.hidrocarburos_gasolina = 522.69;
      settings.instrumentRates.hidrocarburos_diesel = 439;
      settings.instrumentRates.tabaco = 56;
      settings.spendingMultipliers.pensiones = 0.98;
      settings.spendingMultipliers.sanidad = 0.96;
      settings.spendingMultipliers.educacion = 0.96;
      settings.spendingMultipliers.defensa = 0.9;
      settings.spendingMultipliers.carreteras = 0.8;
      settings.spendingMultipliers.cultura = 0.7;
    },
  },
  {
    id: "arquetipo_expansion_social",
    name: "Arquetipo: expansión del gasto social",
    tileLabel: "SOC",
    color: "#a4547d",
    kind: "archetype",
    description:
      "Paquete sintético de refuerzo del estado del bienestar financiado con imposición sobre rentas altas y riqueza.",
    sourceNotes: [],
    caveats: ["Paquete sintético de demostración; no representa a ningún partido."],
    apply: (settings) => {
      settings.irpfStateBracketDeltas = [0, 0, 0, 0, 1, 1.5];
      settings.irpfSavingsBracketDeltas = [0, 0, 0, 1, 2];
      settings.instrumentRates.patrimonio = 130;
      settings.instrumentRates.sucesiones = 120;
      settings.spendingMultipliers.sanidad = 1.08;
      settings.spendingMultipliers.educacion = 1.08;
      settings.spendingMultipliers.dependencia = 1.25;
      settings.spendingMultipliers.imv = 1.6;
      settings.spendingMultipliers.vivienda = 1.5;
      settings.spendingMultipliers.defensa = 0.95;
    },
  },
  {
    id: "arquetipo_rebaja_fiscal",
    name: "Arquetipo: rebaja fiscal general",
    tileLabel: "REB",
    color: "#4c8a5a",
    kind: "archetype",
    description:
      "Paquete sintético de bajada generalizada de impuestos con contención moderada del gasto no social.",
    sourceNotes: [],
    caveats: ["Paquete sintético de demostración; no representa a ningún partido."],
    apply: (settings) => {
      settings.irpfStateBracketDeltas = [-1, -1, -1, -1, -1, -1];
      settings.instrumentRates.iva_reducido = 9;
      settings.instrumentRates.sociedades = 23;
      settings.instrumentRates.patrimonio = 0;
      settings.instrumentRates.itp_ajd = 80;
      settings.spendingMultipliers.carreteras = 0.9;
      settings.spendingMultipliers.cultura = 0.8;
      settings.spendingMultipliers.idi = 0.9;
    },
  },
  {
    id: "arquetipo_verde_industrial",
    name: "Arquetipo: transición verde e industrial",
    tileLabel: "VERD",
    color: "#4f8a83",
    kind: "archetype",
    description:
      "Paquete sintético de fiscalidad ambiental reforzada e inversión en I+D+i, transporte y vivienda.",
    sourceNotes: [],
    caveats: ["Paquete sintético de demostración; no representa a ningún partido."],
    apply: (settings) => {
      settings.instrumentRates.hidrocarburos_gasolina = 572.69;
      settings.instrumentRates.hidrocarburos_diesel = 499;
      settings.instrumentRates.matriculacion = 150;
      settings.instrumentRates.plasticos = 0.9;
      settings.instrumentRates.electricidad = 6.11;
      settings.instrumentRates.iva_superreducido = 3;
      settings.spendingMultipliers.idi = 1.8;
      settings.spendingMultipliers.carreteras = 1.2;
      settings.spendingMultipliers.medio_ambiente = 1.6;
      settings.spendingMultipliers.vivienda = 1.3;
      settings.spendingMultipliers.agricultura = 1.1;
    },
  },
];

/** Returns a fresh settings object with the preset applied. */
export function buildPresetSettings(preset: GovernmentPreset): PolicySettings {
  const settings = createDefaultSettings();
  preset.apply(settings);
  return settings;
}

export function getPreset(id: string): GovernmentPreset | undefined {
  return GOVERNMENT_PRESETS.find((preset) => preset.id === id);
}
