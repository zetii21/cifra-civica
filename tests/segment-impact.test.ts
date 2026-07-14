import { describe, expect, it } from "vitest";
import {
  AGE_BANDS,
  createDefaultSettings,
  FAMILY_TYPES,
  simulateNation,
} from "../lib/fiscal-lab";
import {
  computeSegmentImpacts,
  profileImpact,
} from "../lib/fiscal-lab/segment-impact";

function packageSettings() {
  const settings = createDefaultSettings();
  settings.irpfStateBracketDeltas[5] = 2;
  settings.irpfSavingsBracketDeltas[4] = 3;
  settings.instrumentRates.hidrocarburos_gasolina = 552.69;
  settings.instrumentRegionalRates.patrimonio = { "09": 150 };
  settings.spendingMultipliers.educacion = 1.1;
  settings.spendingRegionalMultipliers.sanidad = { "11": 1.15 };
  return settings;
}

describe("segment impact lookup", () => {
  it("is exactly zero at the baseline", () => {
    const impacts = computeSegmentImpacts(createDefaultSettings());
    for (let index = 0; index < impacts.segments.length; index += 1) {
      expect(Math.abs(impacts.taxEur[index])).toBeLessThan(1e-9);
      expect(Math.abs(impacts.benefitEur[index])).toBeLessThan(1e-9);
    }
  });

  it("reproduces the engine's distributional aggregates exactly", () => {
    const settings = packageSettings();
    const impacts = computeSegmentImpacts(settings);
    const engine = simulateNation(settings);

    const byGroup = (keyOf: (index: number) => string) => {
      const totals = new Map<string, { net: number; households: number }>();
      for (let index = 0; index < impacts.segments.length; index += 1) {
        const key = keyOf(index);
        const entry = totals.get(key) ?? { net: 0, households: 0 };
        entry.net +=
          (impacts.benefitEur[index] - impacts.taxEur[index]) *
          impacts.segments[index].households;
        entry.households += impacts.segments[index].households;
        totals.set(key, entry);
      }
      return totals;
    };

    const deciles = byGroup((index) => `d${impacts.segments[index].decile + 1}`);
    for (const group of engine.distribution.deciles) {
      const entry = deciles.get(group.id)!;
      expect(entry.net / entry.households).toBeCloseTo(group.netPerHouseholdEur, 6);
    }
    const families = byGroup((index) => impacts.segments[index].familyType);
    for (const group of engine.distribution.familyTypes) {
      const entry = families.get(group.id)!;
      expect(entry.net / entry.households).toBeCloseTo(group.netPerHouseholdEur, 6);
    }
    const ages = byGroup((index) => impacts.segments[index].ageBand);
    for (const group of engine.distribution.ageBands) {
      const entry = ages.get(group.id)!;
      expect(entry.net / entry.households).toBeCloseTo(group.netPerHouseholdEur, 6);
    }
  });

  it("resolves every coarse household profile to a segment", () => {
    const impacts = computeSegmentImpacts(packageSettings());
    for (const community of ["01", "09", "13", "16", "19"] as const) {
      for (const band of [0, 4, 9, 12]) {
        for (const familyType of FAMILY_TYPES) {
          for (const ageBand of AGE_BANDS) {
            const impact = profileImpact(impacts, {
              community,
              band,
              familyType: familyType.id,
              ageBand: ageBand.id,
            });
            expect(impact).toBeDefined();
            expect(Number.isFinite(impact!.netEur)).toBe(true);
            expect(impact!.households).toBeGreaterThan(0);
          }
        }
      }
    }
  });

  it("hits the top income band with a top-bracket rise and spares the bottom", () => {
    const settings = createDefaultSettings();
    settings.irpfStateBracketDeltas[5] = 2;
    const impacts = computeSegmentImpacts(settings);
    const top = profileImpact(impacts, {
      community: "13",
      band: 12,
      familyType: "pareja_sin_hijos",
      ageBand: "de_45_a_64",
    })!;
    const bottom = profileImpact(impacts, {
      community: "13",
      band: 0,
      familyType: "pareja_sin_hijos",
      ageBand: "de_45_a_64",
    })!;
    expect(top.netEur).toBeLessThan(-5_000);
    expect(Math.abs(bottom.netEur)).toBeLessThan(1);
  });
});
