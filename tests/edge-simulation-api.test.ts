import { describe, expect, it } from "vitest";

import { buildApiRequest } from "../lib/api-client";
import { createDefaultHousehold } from "../lib/domain";
import { handleEdgeSimulationRequest } from "../lib/edge-simulation-api";

function comparisonRequest(body: unknown, headers: HeadersInit = {}): Request {
  return new Request("https://cifra.example/api/v1/simulations/compare", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("edge simulation API contingency", () => {
  it("validates the API contract and returns an explicitly labelled result", async () => {
    const household = createDefaultHousehold();
    household.adults[0].annualGrossEmploymentIncome = 3_000_000;

    const response = await handleEdgeSimulationRequest(
      comparisonRequest(buildApiRequest(household)),
    );
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Cifra-Engine")).toBe("edge_api");
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(body.modelVersion).toBe("cifra-civica-edge-reference-0.1.0");
    expect(body).not.toHaveProperty("calculationBackend");
    expect(body).not.toHaveProperty("filingModeUsed");
    expect(body.scenarioResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          filingModeApplied: "individual",
          calculationTrace: null,
        }),
      ]),
    );
    expect(body.globalWarnings).toEqual(
      expect.arrayContaining([expect.stringContaining("Motor edge de contingencia")]),
    );
  });

  it("rejects unknown fields without reflecting private input", async () => {
    const payload = {
      ...buildApiRequest(createDefaultHousehold()),
      privateNote: "no debe aparecer",
    };

    const response = await handleEdgeSimulationRequest(comparisonRequest(payload));
    const rawBody = await response.text();

    expect(response.status).toBe(422);
    expect(rawBody).not.toContain("no debe aparecer");
    expect(JSON.parse(rawBody)).toMatchObject({ code: "validation_error" });
  });

  it("enforces method and advertised body-size limits", async () => {
    const methodResponse = await handleEdgeSimulationRequest(
      new Request("https://cifra.example/api/v1/simulations/compare"),
    );
    const sizeResponse = await handleEdgeSimulationRequest(
      comparisonRequest(buildApiRequest(createDefaultHousehold()), {
        "Content-Length": "65537",
      }),
    );

    expect(methodResponse.status).toBe(405);
    expect(sizeResponse.status).toBe(413);
  });
});
