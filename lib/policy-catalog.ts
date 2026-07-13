import type { PolicySource, ScenarioDefinition } from "./domain";

import baselineJson from "../policy-registry/baseline/baseline-2027-common-reference.json";
import childTransferJson from "../policy-registry/scenarios/demo-child-transfer-2027.json";
import familyReliefJson from "../policy-registry/scenarios/demo-family-tax-relief-2027.json";
import boeIrpfJson from "../policy-registry/sources/source-boe-lirpf-consolidated-2026.json";
import boeSocialSecurityJson from "../policy-registry/sources/source-boe-social-security-2026.json";
import haciendaAutonomicJson from "../policy-registry/sources/source-hacienda-autonomic-2025.json";
import socialSecurityRatesJson from "../policy-registry/sources/source-seg-social-rates-2026.json";
import syntheticMethodologyJson from "../policy-registry/sources/source-synthetic-demo-methodology.json";

interface RegistrySource {
  id: string;
  title: string;
  publisher: string;
  url: string;
  lastReviewedAt: string;
}

interface RegistryPolicy {
  id: string;
  slug: string;
  publicName: string;
  shortDescription: string;
  origin: string;
  taxYear: number;
  status: ScenarioDefinition["status"];
  validationStatus: ScenarioDefinition["validationStatus"];
  inheritedBaseline: string | null;
  legalOrProposalSources: string[];
  assumptions: string[];
  parameterOverrides: {
    irpf?: { stateGeneralRateDeltaBasisPoints?: number };
    benefits?: { annualPerEligibleDescendantCents?: number };
  };
  knownLimitations: string[];
  policyVersion: string;
  published: boolean;
  isSynthetic: boolean;
}

const REGISTRY_SOURCES = [
  boeIrpfJson,
  boeSocialSecurityJson,
  haciendaAutonomicJson,
  socialSecurityRatesJson,
  syntheticMethodologyJson,
] as RegistrySource[];

const SOURCE_BY_ID = new Map(REGISTRY_SOURCES.map((source) => [source.id, source]));

function projectSource(source: RegistrySource): PolicySource {
  return {
    id: source.id,
    title: source.title,
    publisher: source.publisher,
    href: source.url,
    reviewedAt: source.lastReviewedAt,
  };
}

function projectPolicy(raw: RegistryPolicy): ScenarioDefinition {
  if (!raw.published || raw.taxYear !== 2027) {
    throw new Error(`Policy ${raw.id} is not a published 2027 scenario`);
  }
  const sources = raw.legalOrProposalSources.map((sourceId) => {
    const source = SOURCE_BY_ID.get(sourceId);
    if (!source) throw new Error(`Policy ${raw.id} references unknown source ${sourceId}`);
    return projectSource(source);
  });
  const overrides: ScenarioDefinition["overrides"] = {};
  const stateDelta = raw.parameterOverrides.irpf?.stateGeneralRateDeltaBasisPoints;
  if (stateDelta !== undefined) overrides.stateRateDeltaBps = stateDelta;
  const descendantTransfer =
    raw.parameterOverrides.benefits?.annualPerEligibleDescendantCents;
  if (descendantTransfer !== undefined) {
    overrides.annualPerEligibleDescendantCents = descendantTransfer;
  }

  return {
    id: raw.id,
    slug: raw.slug,
    publicName: raw.publicName,
    shortName:
      raw.id === "baseline-2027-common-reference"
        ? "Referencia"
        : raw.publicName.replace(/^DEMO — /, ""),
    shortDescription: raw.shortDescription,
    sponsor: raw.origin,
    status: raw.status,
    validationStatus: raw.validationStatus,
    taxYear: 2027,
    policyVersion: raw.policyVersion,
    inheritedBaseline: raw.inheritedBaseline ?? undefined,
    synthetic: raw.isSynthetic,
    assumptions: raw.assumptions,
    limitations: raw.knownLimitations,
    sources,
    overrides,
  };
}

export const BASELINE_ID = "baseline-2027-common-reference";

const REGISTRY_POLICIES = [baselineJson, familyReliefJson, childTransferJson] as RegistryPolicy[];

export const SCENARIOS: ScenarioDefinition[] = REGISTRY_POLICIES.map(projectPolicy);

export const OFFICIAL_SOURCES: PolicySource[] = SCENARIOS.find(
  (scenario) => scenario.id === BASELINE_ID,
)!.sources;

export function getScenario(idOrSlug: string): ScenarioDefinition | undefined {
  return SCENARIOS.find(
    (scenario) => scenario.id === idOrSlug || scenario.slug === idOrSlug,
  );
}
