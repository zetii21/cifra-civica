import { describe, expect, it } from "vitest";
import {
  COMMUNITIES,
  createDefaultSettings,
  INSTRUMENTS,
  LAB_MODEL_VERSION,
  SPENDING_PROGRAMS,
} from "../lib/fiscal-lab";
import {
  decodeScenarioFragment,
  encodeScenarioFragment,
  packScenario,
  unpackScenario,
} from "../lib/lab-scenario";

const instrument = INSTRUMENTS[0];
const program = SPENDING_PROGRAMS[0];
const community = COMMUNITIES[0];

function sampleSettings() {
  const settings = createDefaultSettings();
  settings.irpfStateBracketDeltas[0] = 1.5;
  settings.irpfSavingsBracketDeltas[1] = -2;
  settings.irpfAutonomousDeltas[community.code] = 0.5;
  settings.instrumentRates[instrument.id] = instrument.maxRate;
  settings.instrumentRegionalRates[instrument.id] = {
    [community.code]: instrument.minRate,
  };
  settings.spendingMultipliers[program.id] = program.minMultiplier;
  settings.spendingRegionalMultipliers[program.id] = {
    [community.code]: program.maxMultiplier,
  };
  return settings;
}

describe("lab scenario codec", () => {
  it("round-trips a scenario through the URL fragment", () => {
    const settings = sampleSettings();
    const decoded = decodeScenarioFragment(encodeScenarioFragment(settings));
    expect(decoded).toEqual(settings);
  });

  it("produces URL-safe fragments", () => {
    const fragment = encodeScenarioFragment(sampleSettings());
    expect(fragment).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("rejects payloads from a different model version", () => {
    const packed = packScenario(sampleSettings());
    expect(unpackScenario({ ...packed, version: "otra-version" })).toBeNull();
    expect(packed.version).toBe(LAB_MODEL_VERSION);
  });

  it("rejects junk instead of throwing", () => {
    expect(decodeScenarioFragment("no-es-base64!!!")).toBeNull();
    expect(decodeScenarioFragment(btoa("{corrupto"))).toBeNull();
    expect(unpackScenario(null)).toBeNull();
    expect(unpackScenario(42)).toBeNull();
    expect(unpackScenario({ version: LAB_MODEL_VERSION, settings: "nope" })).toBeNull();
  });

  it("clamps out-of-range values and drops unknown keys", () => {
    const decoded = unpackScenario({
      version: LAB_MODEL_VERSION,
      settings: {
        st: [999, -999],
        ir: {
          [instrument.id]: instrument.maxRate + 1000,
          "impuesto-inventado": 12,
        },
        sm: { [program.id]: -50 },
        au: { XX: 2, [community.code]: 99 },
        irr: { [instrument.id]: { [community.code]: -1e9, ZZ: 1 } },
      },
    });
    expect(decoded).not.toBeNull();
    expect(decoded!.irpfStateBracketDeltas[0]).toBe(5);
    expect(decoded!.irpfStateBracketDeltas[1]).toBe(-5);
    expect(decoded!.instrumentRates[instrument.id]).toBe(instrument.maxRate);
    expect(decoded!.instrumentRates["impuesto-inventado"]).toBeUndefined();
    expect(decoded!.spendingMultipliers[program.id]).toBe(program.minMultiplier);
    expect(decoded!.irpfAutonomousDeltas[community.code]).toBe(4);
    expect(
      Object.keys(decoded!.irpfAutonomousDeltas).filter((code) => code === "XX"),
    ).toHaveLength(0);
    expect(decoded!.instrumentRegionalRates[instrument.id]).toEqual({
      [community.code]: instrument.minRate,
    });
  });

  it("drops non-finite numbers", () => {
    const decoded = unpackScenario({
      version: LAB_MODEL_VERSION,
      settings: { st: [Number.NaN, 2], ir: { [instrument.id]: Number.POSITIVE_INFINITY } },
    });
    expect(decoded!.irpfStateBracketDeltas[0]).toBe(0);
    expect(decoded!.irpfStateBracketDeltas[1]).toBe(2);
    expect(decoded!.instrumentRates[instrument.id]).toBeUndefined();
  });

  it("keeps the baseline reference empty after packing defaults", () => {
    const packed = packScenario(createDefaultSettings());
    expect(packed.settings).toEqual({});
  });
});
