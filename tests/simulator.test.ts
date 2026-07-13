import { describe, expect, it } from "vitest";
import {
  createDefaultHousehold,
  type HouseholdInput,
} from "../lib/domain";
import { BASELINE_ID } from "../lib/policy-catalog";
import { simulate } from "../lib/simulator";

function householdWithSalary(euros: number): HouseholdInput {
  const household = createDefaultHousehold();
  return {
    ...household,
    adults: [
      {
        ...household.adults[0],
        id: "adult-1",
        annualGrossEmploymentIncome: euros * 100,
      },
    ],
    selectedScenarioIds: [
      BASELINE_ID,
      "demo-family-tax-relief-2027",
      "demo-child-transfer-2027",
    ],
  };
}

function stableEconomicOutput(household: HouseholdInput) {
  const result = simulate(household);
  return {
    taxYear: result.taxYear,
    modelVersion: result.modelVersion,
    inputCompleteness: result.inputCompleteness,
    territorialSupport: result.territorialSupport,
    baselineScenarioId: result.baselineScenarioId,
    scenarioResults: result.scenarioResults,
    globalWarnings: result.globalWarnings,
    provenance: result.provenance,
    dataRetention: result.dataRetention,
    filingModeUsed: result.filingModeUsed,
  };
}

describe("deterministic fiscal simulator", () => {
  it("returns the same economic result for the same input", () => {
    const household = householdWithSalary(42_000);
    expect(stableEconomicOutput(household)).toEqual(stableEconomicOutput(household));
  });

  it("calculates the reference case in integer cents", () => {
    const result = simulate(householdWithSalary(30_000));
    const baseline = result.scenarioResults[0];

    expect(baseline.scenarioId).toBe(BASELINE_ID);
    expect(baseline.annual).toMatchObject({
      grossHouseholdIncome: 3_000_000,
      socialSecurityContributions: 195_000,
      generalTaxBase: 2_805_000,
      personalAndFamilyMinimum: 555_000,
      stateIrpfBeforeCredits: 276_300,
      autonomousIrpfBeforeCredits: 276_300,
      finalIrpf: 552_600,
      estimatedDisposableIncome: 2_252_400,
    });
    expect(Object.values(baseline.annual).every(Number.isInteger)).toBe(true);
    expect(baseline.changeFromBaseline.totalDisposableIncome).toBe(0);
    expect(result.dataRetention).toBe("not_stored");
  });

  it("returns zero tax and contributions for a zero-income household", () => {
    const result = simulate(householdWithSalary(0));
    const baseline = result.scenarioResults[0].annual;

    expect(baseline.grossHouseholdIncome).toBe(0);
    expect(baseline.socialSecurityContributions).toBe(0);
    expect(baseline.finalIrpf).toBe(0);
    expect(baseline.estimatedDisposableIncome).toBe(0);
  });

  it("adds the synthetic child transfer once per eligible dependant", () => {
    const household = householdWithSalary(42_000);
    household.dependants = [
      {
        id: "child-1",
        age: 8,
        relationship: "child",
        disabilityBand: "none",
        sharedCustody: false,
        dependentForTaxPurposes: true,
      },
      {
        id: "child-2",
        age: 13,
        relationship: "child",
        disabilityBand: "none",
        sharedCustody: false,
        dependentForTaxPurposes: false,
      },
    ];

    const result = simulate(household);
    const childTransfer = result.scenarioResults.find(
      (scenario) => scenario.scenarioId === "demo-child-transfer-2027",
    );

    expect(childTransfer).toBeDefined();
    expect(childTransfer?.annual.cashBenefits).toBe(120_000);
    expect(childTransfer?.annual.deductionsAndCredits).toBe(0);
    expect(childTransfer?.changeFromBaseline.benefits).toBe(120_000);
    expect(childTransfer?.changeFromBaseline.totalDisposableIncome).toBe(120_000);
    expect(childTransfer?.monthlyEquivalent.changeFromBaseline).toBe(10_000);
  });

  it("fully reconciles every scenario change to its published components", () => {
    const result = simulate(householdWithSalary(42_000));

    for (const scenario of result.scenarioResults) {
      const change = scenario.changeFromBaseline;
      expect(change.totalDisposableIncome).toBe(
        change.grossIncome +
          change.socialSecurityContributions +
          change.stateIrpf +
          change.autonomousIrpf +
          change.benefits,
      );
    }

    const familyRelief = result.scenarioResults.find(
      (scenario) => scenario.scenarioId === "demo-family-tax-relief-2027",
    );
    expect(familyRelief?.changeFromBaseline.socialSecurityContributions).toBe(0);
    expect(familyRelief?.changeFromBaseline.stateIrpf).toBeGreaterThan(0);
    expect(familyRelief?.changeFromBaseline.totalDisposableIncome).toBeGreaterThan(0);
  });

  it("chooses joint filing when it lowers IRPF for an eligible married household", () => {
    const household = householdWithSalary(60_000);
    household.maritalStatus = "married";
    household.filingPreference = "calculate_best";
    household.adults.push({
      ...household.adults[0],
      id: "adult-2",
      relationshipToHousehold: "spouse_partner",
      annualGrossEmploymentIncome: 0,
    });

    expect(simulate(household).filingModeUsed).toBe("joint");
  });

  it("marks estimated inputs and partial territorial coverage", () => {
    const household = householdWithSalary(30_000);
    household.adults[0].dataQuality = "estimated";
    household.residence = {
      autonomousCommunityCode: "05",
      fiscalRegime: "common",
    };

    const result = simulate(household);
    expect(result.inputCompleteness).toBe("estimated");
    expect(result.territorialSupport).toBe("partial");
    expect(result.globalWarnings.join(" ")).toMatch(/Canarias.+IGIC/i);
  });

  it.each([
    ["15", "foral_navarre"],
    ["16", "foral_basque"],
    ["18", "partial"],
    ["19", "partial"],
    ["99", "unknown"],
  ] as const)("refuses unsupported territory %s", (code, fiscalRegime) => {
    const household = householdWithSalary(30_000);
    household.residence = {
      autonomousCommunityCode: code,
      fiscalRegime,
    };

    expect(() => simulate(household)).toThrowError("unsupported_territory");
  });

  it("rejects unknown policy identifiers instead of silently substituting a scenario", () => {
    const household = householdWithSalary(30_000);
    household.selectedScenarioIds = ["unknown-policy"];
    expect(() => simulate(household)).toThrowError("invalid_scenario");
  });

  it("deduplicates the baseline and preserves the policy ordering", () => {
    const household = householdWithSalary(30_000);
    household.selectedScenarioIds = [
      BASELINE_ID,
      BASELINE_ID,
      "demo-child-transfer-2027",
      "demo-family-tax-relief-2027",
    ];
    const ids = simulate(household).scenarioResults.map((scenario) => scenario.scenarioId);
    expect(ids).toEqual([
      BASELINE_ID,
      "demo-child-transfer-2027",
      "demo-family-tax-relief-2027",
    ]);
  });
});
