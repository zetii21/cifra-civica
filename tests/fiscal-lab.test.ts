import { describe, expect, it } from "vitest";
import {
  COMMUNITIES,
  createDefaultSettings,
  INSTRUMENTS,
  IRPF_TARGET_MEUR,
  buildSegments,
  calibrateIrpf,
  progressiveTaxEur,
  simulateNation,
  SPENDING_PROGRAMS,
  TOTAL_HOUSEHOLDS_THOUSANDS,
} from "../lib/fiscal-lab";

describe("fiscal-lab synthetic population", () => {
  it("reproduces the published household totals per community", () => {
    const segments = buildSegments();
    const byCommunity = new Map<string, number>();
    for (const segment of segments) {
      byCommunity.set(
        segment.community,
        (byCommunity.get(segment.community) ?? 0) + segment.households,
      );
    }
    for (const community of COMMUNITIES) {
      expect(byCommunity.get(community.code)! / 1000).toBeCloseTo(
        community.householdsThousands,
        3,
      );
    }
    const total = segments.reduce((sum, segment) => sum + segment.households, 0);
    expect(total / 1000).toBeCloseTo(TOTAL_HOUSEHOLDS_THOUSANDS, 2);
  });

  it("keeps every incidence profile normalised", () => {
    for (const instrument of INSTRUMENTS) {
      const sums = [
        instrument.incidence.deciles,
        instrument.incidence.familyTypes,
        instrument.incidence.ageBands,
      ].map((values) => values.reduce((sum, value) => sum + value, 0));
      for (const sum of sums) expect(sum).toBeCloseTo(1, 9);
      const weightSum = Object.values(instrument.regionalWeights).reduce(
        (sum, value) => sum + value,
        0,
      );
      expect(weightSum).toBeCloseTo(1, 9);
    }
    for (const program of SPENDING_PROGRAMS) {
      const weightSum = Object.values(program.regionalWeights).reduce(
        (sum, value) => sum + value,
        0,
      );
      expect(weightSum).toBeCloseTo(1, 9);
    }
  });
});

describe("fiscal-lab IRPF model", () => {
  it("calibrates the baseline to the published per-community references", () => {
    const calibration = calibrateIrpf();
    for (const community of COMMUNITIES) {
      const baseline = calibration.baselineByCommunity[community.code];
      expect(baseline.state + baseline.autonomous + baseline.savings).toBeCloseTo(
        IRPF_TARGET_MEUR[community.code],
        4,
      );
    }
  });

  it("computes progressive schedules exactly at bracket edges", () => {
    const schedule = [
      { thresholdEur: 0, ratePercent: 10 },
      { thresholdEur: 10_000, ratePercent: 20 },
    ];
    expect(progressiveTaxEur(0, schedule)).toBe(0);
    expect(progressiveTaxEur(10_000, schedule)).toBe(1_000);
    expect(progressiveTaxEur(15_000, schedule)).toBe(2_000);
  });
});

describe("fiscal-lab national simulation", () => {
  it("is exactly neutral at the baseline", () => {
    const result = simulateNation(createDefaultSettings());
    expect(result.totals.revenueDeltaMEur).toBeCloseTo(0, 6);
    expect(result.totals.spendingDeltaMEur).toBeCloseTo(0, 6);
    for (const community of result.communities) {
      expect(community.balanceDeltaMEur).toBeCloseTo(0, 6);
      expect(community.netHouseholdImpactEur).toBeCloseTo(0, 6);
    }
    for (const group of [
      ...result.distribution.deciles,
      ...result.distribution.familyTypes,
      ...result.distribution.ageBands,
    ]) {
      expect(group.netPerHouseholdEur).toBeCloseTo(0, 6);
    }
    expect(result.totals.baselineDeficitMEur).toBeLessThan(0);
    expect(result.totals.baselineDeficitMEur / result.totals.gdpMEur).toBeGreaterThan(-0.05);
  });

  it("keeps community attributions consistent with national deltas", () => {
    const settings = createDefaultSettings();
    settings.instrumentRates.iva_general = 23;
    settings.instrumentRates.hidrocarburos_diesel = 450;
    settings.spendingMultipliers.defensa = 1.25;
    const result = simulateNation(settings);
    for (const instrument of result.instruments) {
      const regional = Object.values(instrument.regionalDeltaMEur).reduce(
        (sum, value) => sum + value,
        0,
      );
      expect(regional + instrument.stateDeltaMEur).toBeCloseTo(instrument.deltaMEur, 6);
    }
    for (const program of result.spending) {
      const regional = Object.values(program.regionalDeltaMEur).reduce(
        (sum, value) => sum + value,
        0,
      );
      expect(regional + program.stateDeltaMEur).toBeCloseTo(program.deltaMEur, 6);
    }
  });

  it("raises revenue with attenuated behaviour when a rate rises", () => {
    const settings = createDefaultSettings();
    settings.instrumentRates.tabaco = 61;
    const result = simulateNation(settings);
    const tobacco = result.instruments.find((instrument) => instrument.id === "tabaco")!;
    const mechanical =
      tobacco.baselineRevenueMEur * (61 / 51) - tobacco.baselineRevenueMEur;
    expect(tobacco.deltaMEur).toBeGreaterThan(0);
    expect(tobacco.deltaMEur).toBeLessThan(mechanical);
    expect(tobacco.behaviouralOffsetMEur).toBeLessThan(0);
  });

  it("keeps a regional override inside the selected community", () => {
    const settings = createDefaultSettings();
    settings.instrumentRegionalRates.patrimonio = { "09": 200 };
    const result = simulateNation(settings);
    const wealth = result.instruments.find((instrument) => instrument.id === "patrimonio")!;
    expect(wealth.regionalDeltaMEur["09"]).toBeGreaterThan(0);
    for (const community of COMMUNITIES) {
      if (community.code === "09") continue;
      expect(Math.abs(wealth.regionalDeltaMEur[community.code])).toBeLessThan(1e-9);
    }
    expect(Math.abs(wealth.stateDeltaMEur)).toBeLessThan(1e-9);
  });

  it("assigns a top-bracket IRPF rise to the top decile only", () => {
    const settings = createDefaultSettings();
    settings.irpfStateBracketDeltas[5] = 2;
    const result = simulateNation(settings);
    const irpf = result.instruments.find((instrument) => instrument.id === "irpf")!;
    expect(irpf.deltaMEur).toBeGreaterThan(50);
    const deciles = result.distribution.deciles;
    expect(deciles[9].netPerHouseholdEur).toBeLessThan(-10);
    for (let index = 0; index < 9; index += 1) {
      expect(Math.abs(deciles[index].netPerHouseholdEur)).toBeLessThan(0.5);
    }
  });

  it("keeps state-schedule changes out of foral treasuries", () => {
    const settings = createDefaultSettings();
    settings.irpfStateBracketDeltas = settings.irpfStateBracketDeltas.map(() => -1);
    const result = simulateNation(settings);
    const irpf = result.instruments.find((instrument) => instrument.id === "irpf")!;
    expect(irpf.deltaMEur).toBeLessThan(-3_000);
    expect(Math.abs(irpf.regionalDeltaMEur["15"])).toBeLessThan(1e-6);
    expect(Math.abs(irpf.regionalDeltaMEur["16"])).toBeLessThan(1e-6);
  });

  it("directs education spending to families with children and younger households", () => {
    const settings = createDefaultSettings();
    settings.spendingMultipliers.educacion = 1.2;
    const result = simulateNation(settings);
    const families = new Map(
      result.distribution.familyTypes.map((group) => [group.id, group.netPerHouseholdEur]),
    );
    expect(families.get("pareja_con_hijos")!).toBeGreaterThan(families.get("unipersonal")!);
    expect(families.get("monoparental")!).toBeGreaterThan(families.get("pareja_sin_hijos")!);
    const ages = new Map(
      result.distribution.ageBands.map((group) => [group.id, group.netPerHouseholdEur]),
    );
    expect(ages.get("de_30_a_44")!).toBeGreaterThan(ages.get("mayores_65")!);
  });

  it("makes pension increases benefit older households and lower-middle deciles", () => {
    const settings = createDefaultSettings();
    settings.spendingMultipliers.pensiones = 1.05;
    const result = simulateNation(settings);
    const ages = new Map(
      result.distribution.ageBands.map((group) => [group.id, group.netPerHouseholdEur]),
    );
    expect(ages.get("mayores_65")!).toBeGreaterThan(ages.get("de_30_a_44")! * 5);
  });

  it("supports simultaneous multi-instrument, multi-territory packages", () => {
    const settings = createDefaultSettings();
    settings.irpfStateBracketDeltas[0] = -0.5;
    settings.irpfAutonomousDeltas["01"] = -0.5;
    settings.instrumentRates.hidrocarburos_gasolina = 522.69;
    settings.instrumentRates.loterias = 25;
    settings.instrumentRegionalRates.sucesiones = { "13": 150 };
    settings.spendingMultipliers.sanidad = 1.05;
    settings.spendingRegionalMultipliers.sanidad = { "11": 1.15 };
    const result = simulateNation(settings);
    const total =
      result.totals.stateBalanceDeltaMEur + result.totals.regionalBalanceDeltaMEur;
    expect(total).toBeCloseTo(result.totals.totalBalanceDeltaMEur, 6);
    const extremadura = result.communities.find((community) => community.code === "11")!;
    const galicia = result.communities.find((community) => community.code === "12")!;
    expect(extremadura.householdBenefitDeltaMEur / extremadura.households).toBeGreaterThan(
      galicia.householdBenefitDeltaMEur / galicia.households,
    );
    expect(result.evaluationCount).toBeGreaterThan(500_000);
  });
});
