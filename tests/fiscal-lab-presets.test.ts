import { describe, expect, it } from "vitest";
import {
  buildPresetSettings,
  createDefaultSettings,
  GOVERNMENT_PRESETS,
  INSTRUMENT_BY_ID,
  simulateNation,
  SPENDING_BY_ID,
} from "../lib/fiscal-lab";

describe("government packages", () => {
  it("keeps identical structure and alphabetical order inside each group", () => {
    const historical = GOVERNMENT_PRESETS.filter((preset) => preset.kind === "historical");
    const archetypes = GOVERNMENT_PRESETS.filter((preset) => preset.kind === "archetype");
    expect(historical.length).toBeGreaterThanOrEqual(2);
    expect(archetypes.length).toBeGreaterThanOrEqual(4);
    for (const group of [historical, archetypes]) {
      const ids = group.map((preset) => preset.id);
      expect(ids).toEqual([...ids].sort());
    }
    for (const preset of GOVERNMENT_PRESETS) {
      expect(preset.tileLabel.length).toBeGreaterThanOrEqual(2);
      expect(preset.tileLabel.length).toBeLessThanOrEqual(6);
      expect(preset.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(preset.caveats.length).toBeGreaterThan(0);
    }
  });

  it("documents historical trajectories and labels archetypes as synthetic", () => {
    for (const preset of GOVERNMENT_PRESETS) {
      if (preset.kind === "historical") {
        expect(preset.sourceNotes.length).toBeGreaterThanOrEqual(3);
        expect(preset.caveats.join(" ")).toMatch(/No es el programa/);
      } else {
        expect(preset.sourceNotes).toEqual([]);
        expect(preset.caveats.join(" ")).toMatch(/sintético/);
      }
    }
  });

  it("only references existing levers within their allowed ranges", () => {
    for (const preset of GOVERNMENT_PRESETS) {
      const settings = buildPresetSettings(preset);
      for (const [id, rate] of Object.entries(settings.instrumentRates)) {
        const instrument = INSTRUMENT_BY_ID.get(id);
        expect(instrument, `unknown instrument ${id} in ${preset.id}`).toBeDefined();
        expect(rate).toBeGreaterThanOrEqual(instrument!.minRate);
        expect(rate).toBeLessThanOrEqual(instrument!.maxRate);
      }
      for (const [id, multiplier] of Object.entries(settings.spendingMultipliers)) {
        const program = SPENDING_BY_ID.get(id);
        expect(program, `unknown programme ${id} in ${preset.id}`).toBeDefined();
        expect(multiplier).toBeGreaterThanOrEqual(program!.minMultiplier);
        expect(multiplier).toBeLessThanOrEqual(program!.maxMultiplier);
      }
      for (const delta of settings.irpfStateBracketDeltas) {
        expect(Math.abs(delta)).toBeLessThanOrEqual(5);
      }
      for (const delta of settings.irpfSavingsBracketDeltas) {
        expect(delta).toBeGreaterThanOrEqual(-5);
        expect(delta).toBeLessThanOrEqual(8);
      }
    }
  });

  it("produces finite, non-baseline simulations and never mutates defaults", () => {
    const reference = JSON.stringify(createDefaultSettings());
    for (const preset of GOVERNMENT_PRESETS) {
      const result = simulateNation(buildPresetSettings(preset));
      expect(Number.isFinite(result.totals.totalBalanceDeltaMEur)).toBe(true);
      expect(
        Math.abs(result.totals.revenueDeltaMEur) + Math.abs(result.totals.spendingDeltaMEur),
      ).toBeGreaterThan(100);
      expect(JSON.stringify(createDefaultSettings())).toBe(reference);
    }
  });

  it("moves the deficit in opposite directions for expansion and consolidation", () => {
    const expansion = simulateNation(
      buildPresetSettings(
        GOVERNMENT_PRESETS.find((preset) => preset.id === "arquetipo_expansion_social")!,
      ),
    );
    const consolidation = simulateNation(
      buildPresetSettings(
        GOVERNMENT_PRESETS.find((preset) => preset.id === "arquetipo_consolidacion")!,
      ),
    );
    expect(consolidation.totals.totalBalanceDeltaMEur).toBeGreaterThan(0);
    expect(expansion.totals.totalBalanceDeltaMEur).toBeLessThan(
      consolidation.totals.totalBalanceDeltaMEur,
    );
  });
});
