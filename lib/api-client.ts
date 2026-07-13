import type {
  HouseholdInput,
  PolicySource,
  ScenarioResult,
  SimulationComparison,
} from "./domain";
import { BASELINE_ID } from "./policy-catalog";

interface ApiSource {
  id: string;
  title: string;
  url: string;
  publisher: string;
  lastReviewedAt: string;
}

interface ApiScenarioResult extends Omit<ScenarioResult, "sourceReferences"> {
  filingModeApplied: "individual" | "joint";
  sourceReferences: ApiSource[];
}

interface ApiSimulationComparison
  extends Omit<
    SimulationComparison,
    "scenarioResults" | "provenance" | "filingModeUsed" | "calculationBackend"
  > {
  scenarioResults: ApiScenarioResult[];
  provenance: ApiSource[];
}

interface SafeApiError {
  code?: string;
  message?: string;
}

export class SimulationApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "SimulationApiError";
  }
}

function generatedPersonId(index: number): string {
  return `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
}

function socialSecurityCategory(adult: HouseholdInput["adults"][number]): string {
  if (adult.annualGrossEmploymentIncome > 0) return "general_employee";
  if (adult.annualSelfEmploymentNetIncome > 0) return "self_employed";
  return "other";
}

export function buildApiRequest(household: HouseholdInput) {
  return {
    taxYear: household.taxYear,
    locale: household.locale,
    household: {
      residence: {
        autonomousCommunityCode: household.residence.autonomousCommunityCode,
        municipalityCode: household.residence.municipalityCode || null,
        fiscalRegime:
          household.residence.fiscalRegime === "partial"
            ? "unknown"
            : household.residence.fiscalRegime,
      },
      filingPreference: household.filingPreference,
      maritalStatus: household.maritalStatus,
      singleParentHousehold: household.singleParentHousehold,
      adults: household.adults.map((adult, index) => ({
        id: generatedPersonId(index),
        age: adult.age,
        relationshipToHousehold: adult.relationshipToHousehold,
        employmentStatus: adult.employmentStatus,
        annualGrossEmploymentIncome: adult.annualGrossEmploymentIncome,
        annualSelfEmploymentNetIncome: adult.annualSelfEmploymentNetIncome,
        annualUnemploymentBenefits: adult.annualUnemploymentBenefits,
        annualPensionIncome: adult.annualPensionIncome,
        annualOtherTaxableBenefits: adult.annualOtherTaxableBenefits,
        annualExemptIncome: adult.annualExemptIncome,
        disabilityBand: adult.disabilityBand,
        socialSecurityCategory: socialSecurityCategory(adult),
        monthsWorked: adult.monthsWorked,
        multipleJobs: adult.multipleJobs,
        contributionBaseOverride: null,
        dataQuality: adult.dataQuality,
      })),
      dependants: household.dependants.map((dependant, index) => ({
        id: generatedPersonId(household.adults.length + index),
        age: dependant.age,
        relationship: dependant.relationship,
        disabilityBand: dependant.disabilityBand,
        sharedCustody: dependant.sharedCustody,
        dependentForTaxPurposes: dependant.dependentForTaxPurposes,
      })),
      housing: {
        tenure: household.housing.tenure,
        annualRent: household.housing.annualRent || null,
        mortgageExists: household.housing.mortgageExists,
        mortgageStartYear: null,
        primaryResidence: household.housing.primaryResidence,
        protectedHousing: null,
      },
      householdBenefits:
        household.householdBenefits > 0
          ? [
              {
                benefitType: "user_entered_support",
                annualAmount: household.householdBenefits,
                taxTreatment: "unknown",
                dataQuality: "exact",
              },
            ]
          : [],
      broadCapitalIncome: household.broadCapitalIncome,
      userConfirmedAssumptions: household.userConfirmedAssumptions,
    },
    scenarioIds: Array.from(new Set([BASELINE_ID, ...household.selectedScenarioIds])),
    includeTrace: false,
  };
}

function mapSource(source: ApiSource): PolicySource {
  return {
    id: source.id,
    title: source.title,
    publisher: source.publisher,
    href: source.url,
    reviewedAt: source.lastReviewedAt,
  };
}

export function mapApiResponse(
  raw: ApiSimulationComparison,
  calculationBackend: SimulationComparison["calculationBackend"],
): SimulationComparison {
  const scenarioResults = raw.scenarioResults.map((scenario) => ({
    ...scenario,
    sourceReferences: scenario.sourceReferences.map(mapSource),
  }));
  const baseline = scenarioResults.find(
    (scenario) => scenario.scenarioId === raw.baselineScenarioId,
  );
  return {
    ...raw,
    scenarioResults,
    provenance: raw.provenance.map(mapSource),
    filingModeUsed: baseline?.filingModeApplied ?? "individual",
    calculationBackend,
  };
}

export async function requestApiSimulation(
  household: HouseholdInput,
  apiBase: string,
  fetchImplementation: typeof fetch = fetch,
): Promise<SimulationComparison> {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetchImplementation(
      `${apiBase.replace(/\/$/, "")}/api/v1/simulations/compare`,
      {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(buildApiRequest(household)),
        cache: "no-store",
        credentials: "omit",
        signal: controller.signal,
      },
    );
    if (!response.ok) {
      let safeError: SafeApiError = {};
      try {
        safeError = (await response.json()) as SafeApiError;
      } catch {
        // The public error remains generic when an intermediary returns non-JSON.
      }
      throw new SimulationApiError(
        safeError.code ?? "calculation_failed",
        safeError.message ?? "No se pudo completar el cálculo.",
      );
    }
    const engineHeader = response.headers.get("X-Cifra-Engine");
    if (engineHeader !== "python_api" && engineHeader !== "edge_api") {
      throw new SimulationApiError(
        "unverified_engine",
        "No se pudo verificar qué motor produjo el cálculo.",
      );
    }
    return mapApiResponse(
      (await response.json()) as ApiSimulationComparison,
      engineHeader,
    );
  } catch (error) {
    if (error instanceof SimulationApiError) throw error;
    throw new SimulationApiError(
      "api_unavailable",
      "El motor fiscal no está disponible en este momento.",
    );
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

export async function calculateHousehold(
  household: HouseholdInput,
): Promise<SimulationComparison> {
  return requestApiSimulation(household, "");
}
