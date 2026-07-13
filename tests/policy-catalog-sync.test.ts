import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { SCENARIOS } from "../lib/policy-catalog";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function jsonFiles(directory: string): Array<Record<string, unknown>> {
  return readdirSync(directory)
    .filter((name) => name.endsWith(".json"))
    .map((name) =>
      JSON.parse(readFileSync(path.join(directory, name), "utf8")) as Record<string, unknown>,
    );
}

describe("browser and edge policy projection", () => {
  it("matches every published registry policy, source and supported override", () => {
    const registryPolicies = [
      ...jsonFiles(path.join(projectRoot, "policy-registry/baseline")),
      ...jsonFiles(path.join(projectRoot, "policy-registry/scenarios")),
    ].filter((policy) => policy.published === true);
    const registrySources = new Map(
      jsonFiles(path.join(projectRoot, "policy-registry/sources")).map((source) => [
        source.id,
        source,
      ]),
    );

    expect(SCENARIOS.map((scenario) => scenario.id).sort()).toEqual(
      registryPolicies.map((policy) => String(policy.id)).sort(),
    );

    for (const raw of registryPolicies) {
      const scenario = SCENARIOS.find((candidate) => candidate.id === raw.id);
      expect(scenario).toBeDefined();
      expect(scenario).toMatchObject({
        id: raw.id,
        slug: raw.slug,
        publicName: raw.publicName,
        shortDescription: raw.shortDescription,
        sponsor: raw.origin,
        taxYear: raw.taxYear,
        status: raw.status,
        validationStatus: raw.validationStatus,
        policyVersion: raw.policyVersion,
        inheritedBaseline: raw.inheritedBaseline ?? undefined,
        synthetic: raw.isSynthetic,
        assumptions: raw.assumptions,
        limitations: raw.knownLimitations,
      });

      const parameterOverrides = raw.parameterOverrides as {
        irpf?: { stateGeneralRateDeltaBasisPoints?: number };
        benefits?: { annualPerEligibleDescendantCents?: number };
      };
      expect(scenario?.overrides).toEqual({
        ...(parameterOverrides.irpf?.stateGeneralRateDeltaBasisPoints === undefined
          ? {}
          : {
              stateRateDeltaBps:
                parameterOverrides.irpf.stateGeneralRateDeltaBasisPoints,
            }),
        ...(parameterOverrides.benefits?.annualPerEligibleDescendantCents === undefined
          ? {}
          : {
              annualPerEligibleDescendantCents:
                parameterOverrides.benefits.annualPerEligibleDescendantCents,
            }),
      });

      const sourceIds = raw.legalOrProposalSources as string[];
      expect(scenario?.sources).toEqual(
        sourceIds.map((sourceId) => {
          const source = registrySources.get(sourceId);
          expect(source).toBeDefined();
          return {
            id: source?.id,
            title: source?.title,
            publisher: source?.publisher,
            href: source?.url,
            reviewedAt: source?.lastReviewedAt,
          };
        }),
      );
    }
  });
});
