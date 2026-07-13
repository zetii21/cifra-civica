import { z } from "zod";

import type { HouseholdInput, PolicySource, SimulationComparison } from "./domain";
import { simulate } from "./simulator";

const MAX_REQUEST_BYTES = 65_536;
const MAX_ANNUAL_CENTS = 10_000_000_000;
const EDGE_MODEL_VERSION = "cifra-civica-edge-reference-0.1.0";
const ENGINE_HEADER = "X-Cifra-Engine";

const money = z.number().int().min(0).max(MAX_ANNUAL_CENTS);
const disabilityBand = z.enum([
  "none",
  "broad_lower_band",
  "broad_higher_band",
  "unknown",
]);
const dataQuality = z.enum(["exact", "estimated", "unknown"]);

const residenceSchema = z.strictObject({
  autonomousCommunityCode: z.string().regex(/^[0-9]{2}$/),
  municipalityCode: z.string().regex(/^[0-9]{5}$/).nullable(),
  fiscalRegime: z.enum(["common", "foral_navarre", "foral_basque", "unknown"]),
});

const adultSchema = z.strictObject({
  id: z.string().uuid(),
  age: z.number().int().min(18).max(110),
  relationshipToHousehold: z.enum([
    "primary",
    "spouse_partner",
    "other_adult",
    "dependent_adult",
  ]),
  employmentStatus: z.enum([
    "employee",
    "self_employed",
    "unemployed",
    "retired",
    "student",
    "inactive",
    "mixed",
  ]),
  annualGrossEmploymentIncome: money,
  annualSelfEmploymentNetIncome: money,
  annualUnemploymentBenefits: money,
  annualPensionIncome: money,
  annualOtherTaxableBenefits: money,
  annualExemptIncome: money,
  disabilityBand,
  socialSecurityCategory: z.enum([
    "general_employee",
    "self_employed",
    "other",
    "unknown",
  ]),
  monthsWorked: z.number().int().min(0).max(12),
  multipleJobs: z.boolean(),
  contributionBaseOverride: money.positive().nullable(),
  dataQuality,
}).refine(
  (adult) =>
    adult.annualGrossEmploymentIncome + adult.annualSelfEmploymentNetIncome === 0 ||
    adult.monthsWorked > 0,
  { message: "Los ingresos laborales requieren meses trabajados." },
);

const dependantSchema = z.strictObject({
  id: z.string().uuid(),
  age: z.number().int().min(0).max(120),
  relationship: z.enum(["child", "descendant", "ascendant", "other"]),
  disabilityBand,
  sharedCustody: z.boolean(),
  dependentForTaxPurposes: z.union([z.boolean(), z.literal("unknown")]),
});

const housingSchema = z.strictObject({
  tenure: z.enum([
    "owner_no_mortgage",
    "owner_with_mortgage",
    "renter",
    "social_renter",
    "living_with_family",
    "other",
  ]),
  annualRent: money.nullable(),
  mortgageExists: z.boolean(),
  mortgageStartYear: z.number().int().min(1900).max(2027).nullable(),
  primaryResidence: z.boolean(),
  protectedHousing: z.union([z.boolean(), z.literal("unknown")]).nullable(),
});

const benefitSchema = z.strictObject({
  benefitType: z.string().min(1).max(80).regex(/^[a-z0-9_-]+$/),
  annualAmount: money,
  taxTreatment: z.enum(["exempt", "taxable", "unknown"]),
  dataQuality,
});

const capitalIncomeSchema = z.strictObject({
  annualInterest: money,
  annualDividends: money,
  annualPropertyIncome: money,
  annualCapitalGains: money,
  annualCapitalLosses: money,
  valuesAreEstimated: z.boolean(),
});

const comparisonRequestSchema = z
  .strictObject({
    taxYear: z.literal(2027),
    locale: z.literal("es-ES"),
    household: z.strictObject({
      residence: residenceSchema,
      filingPreference: z.enum(["calculate_best", "individual", "joint"]),
      maritalStatus: z.enum([
        "single",
        "married",
        "separated",
        "divorced",
        "widowed",
        "domestic_partnership",
      ]),
      singleParentHousehold: z.boolean(),
      adults: z.array(adultSchema).min(1).max(6),
      dependants: z.array(dependantSchema).max(12),
      housing: housingSchema,
      householdBenefits: z.array(benefitSchema).max(20),
      broadCapitalIncome: capitalIncomeSchema,
      userConfirmedAssumptions: z.array(z.string().max(500)).max(30),
    }),
    scenarioIds: z.array(z.string().min(1).max(120)).max(4),
    includeTrace: z.boolean(),
  })
  .superRefine((request, context) => {
    const people = [
      ...request.household.adults.map((adult) => adult.id),
      ...request.household.dependants.map((dependant) => dependant.id),
    ];
    if (new Set(people).size !== people.length) {
      context.addIssue({ code: "custom", message: "Los identificadores deben ser únicos." });
    }
    if (
      request.household.adults.filter(
        (adult) => adult.relationshipToHousehold === "primary",
      ).length !== 1
    ) {
      context.addIssue({ code: "custom", message: "Debe existir una persona principal." });
    }
    if (new Set(request.scenarioIds).size !== request.scenarioIds.length) {
      context.addIssue({ code: "custom", message: "Los escenarios deben ser únicos." });
    }
    if (
      request.household.adults.some(
        (adult) => adult.contributionBaseOverride !== null,
      )
    ) {
      context.addIssue({
        code: "custom",
        message: "La contingencia edge no admite bases de cotización manuales.",
      });
    }
  });

type EdgeComparisonRequest = z.infer<typeof comparisonRequestSchema>;

function mapHousehold(request: EdgeComparisonRequest): HouseholdInput {
  const { household } = request;
  return {
    taxYear: 2027,
    locale: "es-ES",
    residence: {
      autonomousCommunityCode: household.residence.autonomousCommunityCode,
      municipalityCode: household.residence.municipalityCode ?? undefined,
      fiscalRegime: household.residence.fiscalRegime,
    },
    filingPreference: household.filingPreference,
    maritalStatus: household.maritalStatus,
    singleParentHousehold: household.singleParentHousehold,
    adults: household.adults.map((adult) => ({
      id: adult.id,
      age: adult.age,
      relationshipToHousehold:
        adult.relationshipToHousehold === "dependent_adult"
          ? "other_adult"
          : adult.relationshipToHousehold,
      employmentStatus: adult.employmentStatus,
      annualGrossEmploymentIncome: adult.annualGrossEmploymentIncome,
      annualSelfEmploymentNetIncome: adult.annualSelfEmploymentNetIncome,
      annualUnemploymentBenefits: adult.annualUnemploymentBenefits,
      annualPensionIncome: adult.annualPensionIncome,
      annualOtherTaxableBenefits: adult.annualOtherTaxableBenefits,
      annualExemptIncome: adult.annualExemptIncome,
      disabilityBand: adult.disabilityBand,
      monthsWorked: adult.monthsWorked,
      multipleJobs: adult.multipleJobs,
      dataQuality: adult.dataQuality,
    })),
    dependants: household.dependants.map((dependant) => ({
      id: dependant.id,
      age: dependant.age,
      relationship: dependant.relationship,
      disabilityBand: dependant.disabilityBand,
      sharedCustody: dependant.sharedCustody,
      dependentForTaxPurposes: dependant.dependentForTaxPurposes === true,
    })),
    housing: {
      tenure: household.housing.tenure,
      annualRent: household.housing.annualRent ?? 0,
      mortgageExists: household.housing.mortgageExists,
      primaryResidence: household.housing.primaryResidence,
    },
    householdBenefits: household.householdBenefits.reduce(
      (total, benefit) => total + benefit.annualAmount,
      0,
    ),
    broadCapitalIncome: household.broadCapitalIncome,
    selectedScenarioIds: request.scenarioIds,
    userConfirmedAssumptions: household.userConfirmedAssumptions,
  };
}

function mapSource(source: PolicySource) {
  return {
    id: source.id,
    title: source.title,
    url: source.href,
    publisher: source.publisher,
    lastReviewedAt: source.reviewedAt,
  };
}

function mapComparison(comparison: SimulationComparison) {
  const { calculationBackend: _engine, filingModeUsed, ...publicComparison } = comparison;
  void _engine;
  return {
    ...publicComparison,
    modelVersion: EDGE_MODEL_VERSION,
    scenarioResults: comparison.scenarioResults.map((scenario) => ({
      ...scenario,
      filingModeApplied: filingModeUsed,
      explanationItems: scenario.explanationItems.map((item) => ({
        ...item,
        relatedVariables: [],
        relatedPolicyRuleIds: [],
      })),
      uncertainty: {
        ...scenario.uncertainty,
        optionalLowerBound:
          scenario.uncertainty.optionalLowerBound === undefined
            ? undefined
            : Math.round(scenario.uncertainty.optionalLowerBound),
        optionalUpperBound:
          scenario.uncertainty.optionalUpperBound === undefined
            ? undefined
            : Math.round(scenario.uncertainty.optionalUpperBound),
      },
      sourceReferences: scenario.sourceReferences.map(mapSource),
      calculationTrace: null,
    })),
    globalWarnings: [
      ...comparison.globalWarnings,
      "Motor edge de contingencia: cálculo aproximado y visible para despliegues sin la API Python; no sustituye la validación fiscal de producción.",
    ],
    provenance: comparison.provenance.map(mapSource),
  };
}

function jsonResponse(
  body: unknown,
  status: number,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "Content-Type": "application/json; charset=utf-8",
      Pragma: "no-cache",
      [ENGINE_HEADER]: "edge_api",
      ...extraHeaders,
    },
  });
}

function safeError(code: string, message: string, requestId: string, status: number) {
  return jsonResponse({ code, message, requestId }, status);
}

export async function handleEdgeSimulationRequest(request: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  if (request.method !== "POST") {
    return safeError(
      "method_not_allowed",
      "Este endpoint solo admite solicitudes POST.",
      requestId,
      405,
    );
  }
  if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) {
    return safeError(
      "unsupported_media_type",
      "El cuerpo debe enviarse como application/json.",
      requestId,
      415,
    );
  }

  const advertisedSize = Number(request.headers.get("Content-Length") ?? 0);
  if (Number.isFinite(advertisedSize) && advertisedSize > MAX_REQUEST_BYTES) {
    return safeError("request_too_large", "La solicitud supera el límite permitido.", requestId, 413);
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return safeError("invalid_request", "No se pudo leer la solicitud.", requestId, 400);
  }
  if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BYTES) {
    return safeError("request_too_large", "La solicitud supera el límite permitido.", requestId, 413);
  }

  let rawInput: unknown;
  try {
    rawInput = JSON.parse(rawBody);
  } catch {
    return safeError("invalid_json", "El cuerpo JSON no es válido.", requestId, 400);
  }
  const parsed = comparisonRequestSchema.safeParse(rawInput);
  if (!parsed.success) {
    return safeError(
      "validation_error",
      "La solicitud no cumple el contrato de cálculo.",
      requestId,
      422,
    );
  }

  try {
    const comparison = simulate(mapHousehold(parsed.data));
    return jsonResponse(mapComparison(comparison), 200);
  } catch (error) {
    const code = error instanceof Error ? error.message : "calculation_failed";
    if (code === "unsupported_territory") {
      return safeError(
        code,
        "El territorio seleccionado todavía no está soportado.",
        requestId,
        422,
      );
    }
    if (code === "invalid_scenario") {
      return safeError(code, "Uno de los escenarios no es válido.", requestId, 422);
    }
    return safeError(
      "calculation_failed",
      "No se pudo completar el cálculo.",
      requestId,
      500,
    );
  }
}
