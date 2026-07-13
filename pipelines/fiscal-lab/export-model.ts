/**
 * Exports the national fiscal-laboratory model (population segments,
 * schedules, instruments, spending programmes, calibration factors) plus a
 * set of golden scenarios computed with the TypeScript engine, so the Python
 * statistical study can re-implement the arithmetic independently and verify
 * both engines agree before running the exhaustive sweeps.
 *
 *   node --import tsx pipelines/fiscal-lab/export-model.ts
 */
import { writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AGE_BANDS,
  buildSegments,
  calibrateIrpf,
  COMMUNITIES,
  createDefaultSettings,
  baselineSchedules,
  FAMILY_TYPES,
  INSTRUMENTS,
  LAB_MODEL_VERSION,
  NATIONAL_GDP_MEUR,
  OTHER_REVENUE_MEUR,
  OTHER_SPENDING_MEUR,
  simulateNation,
  SPENDING_PROGRAMS,
  type PolicySettings,
} from "../../lib/fiscal-lab";
import { INCOME_BANDS } from "../../lib/fiscal-lab/demography";
import { SAVINGS_BASE_SHARE_BY_BAND } from "../../lib/fiscal-lab/irpf";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUTPUT = resolve(ROOT, "model-lab/inputs/national-model.json");

interface GoldenScenario {
  id: string;
  description: string;
  settings: PolicySettings;
}

function scenario(
  id: string,
  description: string,
  mutate: (settings: PolicySettings) => void,
): GoldenScenario {
  const settings = createDefaultSettings();
  mutate(settings);
  return { id, description, settings };
}

const GOLDEN_SCENARIOS: GoldenScenario[] = [
  scenario("baseline", "Sin cambios", () => {}),
  scenario("irpf_top_up2", "IRPF estatal: +2 puntos en el último tramo", (settings) => {
    settings.irpfStateBracketDeltas[5] = 2;
  }),
  scenario("irpf_all_down1", "IRPF estatal: -1 punto en todos los tramos", (settings) => {
    settings.irpfStateBracketDeltas = settings.irpfStateBracketDeltas.map(() => -1);
  }),
  scenario("savings_up3_top", "Ahorro: +3 puntos en el tramo superior", (settings) => {
    settings.irpfSavingsBracketDeltas[4] = 3;
  }),
  scenario("madrid_auto_up1", "IRPF autonómico de Madrid: +1 punto", (settings) => {
    settings.irpfAutonomousDeltas["13"] = 1;
  }),
  scenario("fuel_up100", "Gasolina: +100 €/1.000 l", (settings) => {
    settings.instrumentRates.hidrocarburos_gasolina = 572.69;
  }),
  scenario("iva_general_up2", "IVA general: 21 % → 23 %", (settings) => {
    settings.instrumentRates.iva_general = 23;
  }),
  scenario("juego_up10", "Juego online: 20 % → 30 %", (settings) => {
    settings.instrumentRates.juego_online = 30;
  }),
  scenario("loterias_up10", "Gravamen de loterías: 20 % → 30 %", (settings) => {
    settings.instrumentRates.loterias = 30;
  }),
  scenario("patrimonio_cat_150", "Patrimonio en Cataluña: índice 150", (settings) => {
    settings.instrumentRegionalRates.patrimonio = { "09": 150 };
  }),
  scenario("edu_up10_def_down10", "Educación +10 %, defensa -10 %", (settings) => {
    settings.spendingMultipliers.educacion = 1.1;
    settings.spendingMultipliers.defensa = 0.9;
  }),
  scenario("paquete_mixto", "Paquete mixto multi-palanca", (settings) => {
    settings.irpfStateBracketDeltas[0] = -0.5;
    settings.irpfStateBracketDeltas[5] = 1.5;
    settings.irpfSavingsBracketDeltas[3] = 1;
    settings.instrumentRates.hidrocarburos_diesel = 429;
    settings.instrumentRates.tabaco = 56;
    settings.irpfAutonomousDeltas["01"] = -0.25;
    settings.instrumentRegionalRates.sucesiones = { "12": 130 };
    settings.spendingMultipliers.sanidad = 1.04;
    settings.spendingRegionalMultipliers.carreteras = { "07": 1.3 };
  }),
];

async function main(): Promise<void> {
  const schedules = baselineSchedules();
  const calibration = calibrateIrpf();
  const segments = buildSegments();

  const familyIndex = new Map(FAMILY_TYPES.map((entry, index) => [entry.id, index]));
  const ageIndex = new Map(AGE_BANDS.map((entry, index) => [entry.id, index]));
  const communityIndex = new Map(COMMUNITIES.map((entry, index) => [entry.code, index]));

  const golden = GOLDEN_SCENARIOS.map((entry) => {
    const result = simulateNation(entry.settings);
    return {
      id: entry.id,
      description: entry.description,
      settings: entry.settings,
      expected: {
        revenueDeltaMEur: result.totals.revenueDeltaMEur,
        spendingDeltaMEur: result.totals.spendingDeltaMEur,
        stateBalanceDeltaMEur: result.totals.stateBalanceDeltaMEur,
        regionalBalanceDeltaMEur: result.totals.regionalBalanceDeltaMEur,
        irpfDeltaMEur: result.instruments.find((instrument) => instrument.id === "irpf")!
          .deltaMEur,
        communities: Object.fromEntries(
          result.communities.map((community) => [
            community.code,
            {
              revenueDeltaMEur: community.revenueDeltaMEur,
              spendingDeltaMEur: community.spendingDeltaMEur,
              netHouseholdImpactEur: community.netHouseholdImpactEur,
            },
          ]),
        ),
        decilesNetPerHouseholdEur: result.distribution.deciles.map(
          (group) => group.netPerHouseholdEur,
        ),
      },
    };
  });

  const model = {
    modelVersion: LAB_MODEL_VERSION,
    gdpMEur: NATIONAL_GDP_MEUR,
    otherRevenueMEur: OTHER_REVENUE_MEUR,
    otherSpendingMEur: OTHER_SPENDING_MEUR,
    communities: COMMUNITIES,
    incomeBands: INCOME_BANDS,
    familyTypes: FAMILY_TYPES,
    ageBands: AGE_BANDS,
    savingsBaseShareByBand: SAVINGS_BASE_SHARE_BY_BAND,
    schedules,
    irpfCalibrationFactors: calibration.factors,
    irpfBaselineByCommunity: calibration.baselineByCommunity,
    segments: segments.map((row) => ({
      c: communityIndex.get(row.community)!,
      b: row.band,
      f: familyIndex.get(row.familyType)!,
      a: ageIndex.get(row.ageBand)!,
      h: row.households,
      y: row.grossIncomeEur,
    })),
    instruments: INSTRUMENTS,
    spendingPrograms: SPENDING_PROGRAMS,
    goldenScenarios: golden,
  };

  const serialised = `${JSON.stringify(model, null, 1)}\n`;
  await writeFile(OUTPUT, serialised, "utf8");
  process.stdout.write(
    `National model exported: ${segments.length} segments, ${INSTRUMENTS.length + 1} instruments, ${SPENDING_PROGRAMS.length} programmes, ${golden.length} golden scenarios (${Buffer.byteLength(serialised, "utf8")} bytes)\n`,
  );
}

await main();
