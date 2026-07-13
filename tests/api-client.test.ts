import { describe, expect, it } from "vitest";
import {
  buildApiRequest,
  requestApiSimulation,
} from "../lib/api-client";
import { createDefaultHousehold } from "../lib/domain";
import { BASELINE_ID } from "../lib/policy-catalog";

function apiResponse() {
  const source = {
    id: "official-source",
    title: "Fuente oficial",
    url: "https://example.test/source",
    publisher: "Organismo público",
    lastReviewedAt: "2026-07-13",
  };
  return {
    requestId: "request-1",
    taxYear: 2027,
    modelVersion: "es-fiscal-reference-0.1.0",
    calculationTimestamp: "2026-07-13T00:00:00Z",
    inputCompleteness: "complete",
    territorialSupport: "supported",
    baselineScenarioId: BASELINE_ID,
    scenarioResults: [
      {
        scenarioId: BASELINE_ID,
        scenarioName: "Referencia",
        scenarioStatus: "simulated",
        policyVersion: "2027.reference.1",
        validationStatus: "source_reviewed",
        filingModeApplied: "individual",
        annual: {
          grossHouseholdIncome: 3_000_000,
          exemptIncome: 0,
          socialSecurityContributions: 190_000,
          generalTaxBase: 2_500_000,
          savingsTaxBase: 0,
          personalAndFamilyMinimum: 555_000,
          jointFilingReduction: 0,
          stateIrpfBeforeCredits: 200_000,
          autonomousIrpfBeforeCredits: 200_000,
          deductionsAndCredits: 0,
          finalIrpf: 400_000,
          cashBenefits: 0,
          pensionIncome: 0,
          estimatedDisposableIncome: 2_410_000,
        },
        monthlyEquivalent: {
          estimatedDisposableIncome: 200_833,
          changeFromBaseline: 0,
        },
        changeFromBaseline: {
          grossIncome: 0,
          socialSecurityContributions: 0,
          stateIrpf: 0,
          autonomousIrpf: 0,
          benefits: 0,
          totalDisposableIncome: 0,
        },
        explanationItems: [],
        assumptions: [],
        warnings: [],
        uncertainty: { level: "high", reasons: ["Referencia trasladada."] },
        sourceReferences: [source],
      },
    ],
    globalWarnings: [],
    provenance: [source],
    dataRetention: "not_stored",
  };
}

describe("ephemeral simulation API adapter", () => {
  it("normalises UI state into the strict API contract", () => {
    const household = createDefaultHousehold();
    household.adults[0].annualGrossEmploymentIncome = 3_000_000;
    household.householdBenefits = 120_000;
    const request = buildApiRequest(household);

    expect(request.household.adults[0]).toMatchObject({
      id: "00000000-0000-4000-8000-000000000001",
      socialSecurityCategory: "general_employee",
      annualGrossEmploymentIncome: 3_000_000,
    });
    expect(request.household.householdBenefits).toEqual([
      expect.objectContaining({ annualAmount: 120_000, taxTreatment: "unknown" }),
    ]);
    expect(request.scenarioIds).toEqual([
      BASELINE_ID,
      "demo-family-tax-relief-2027",
      "demo-child-transfer-2027",
    ]);
  });

  it("uses a no-store POST body and maps provenance for the UI", async () => {
    const calls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
    const fetchMock: typeof fetch = async (input, init) => {
      calls.push([input, init]);
      return new Response(JSON.stringify(apiResponse()), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "X-Cifra-Engine": "python_api",
        },
      });
    };
    const result = await requestApiSimulation(
      createDefaultHousehold(),
      "https://api.example.test/",
      fetchMock,
    );

    expect(calls).toHaveLength(1);
    const [url, init] = calls[0];
    expect(url).toBe("https://api.example.test/api/v1/simulations/compare");
    expect(init).toMatchObject({ method: "POST", cache: "no-store", credentials: "omit" });
    expect(new URL(String(url)).search).toBe("");
    expect(JSON.parse(String(init?.body))).toHaveProperty("household.adults.0.age");
    expect(result.calculationBackend).toBe("python_api");
    expect(result.filingModeUsed).toBe("individual");
    expect(result.provenance[0]).toMatchObject({
      href: "https://example.test/source",
      reviewedAt: "2026-07-13",
    });
  });

  it("preserves safe API error codes without falling back silently", async () => {
    const fetchMock: typeof fetch = async () =>
      new Response(JSON.stringify({ code: "unsupported_territory", message: "No compatible" }), {
        status: 422,
        headers: { "Content-Type": "application/json" },
      });

    await expect(
      requestApiSimulation(createDefaultHousehold(), "https://api.example.test", fetchMock),
    ).rejects.toMatchObject({ code: "unsupported_territory" });
  });

  it("labels a response produced by the edge contingency engine", async () => {
    const fetchMock: typeof fetch = async () =>
      new Response(JSON.stringify(apiResponse()), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "X-Cifra-Engine": "edge_api",
        },
      });

    const result = await requestApiSimulation(createDefaultHousehold(), "", fetchMock);

    expect(result.calculationBackend).toBe("edge_api");
  });

  it("fails closed when the engine identity header is absent", async () => {
    const fetchMock: typeof fetch = async () =>
      new Response(JSON.stringify(apiResponse()), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    await expect(
      requestApiSimulation(createDefaultHousehold(), "", fetchMock),
    ).rejects.toMatchObject({ code: "unverified_engine" });
  });
});
