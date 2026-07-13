import type {
  AdultInput,
  AnnualBreakdown,
  HouseholdInput,
  ScenarioDefinition,
  ScenarioResult,
  SimulationComparison,
} from "./domain";
import { AUTONOMOUS_COMMUNITIES } from "./domain";
import { BASELINE_ID, OFFICIAL_SOURCES, SCENARIOS } from "./policy-catalog";

interface Band {
  upperCents: number | null;
  rateBps: number;
}

const STATE_GENERAL_BANDS: Band[] = [
  { upperCents: 1_245_000, rateBps: 950 },
  { upperCents: 2_020_000, rateBps: 1_200 },
  { upperCents: 3_520_000, rateBps: 1_500 },
  { upperCents: 6_000_000, rateBps: 1_850 },
  { upperCents: 30_000_000, rateBps: 2_250 },
  { upperCents: null, rateBps: 2_450 },
];

const SAVINGS_HALF_BANDS: Band[] = [
  { upperCents: 600_000, rateBps: 950 },
  { upperCents: 5_000_000, rateBps: 1_050 },
  { upperCents: 20_000_000, rateBps: 1_150 },
  { upperCents: 30_000_000, rateBps: 1_350 },
  { upperCents: null, rateBps: 1_500 },
];

const PERSONAL_MINIMUM_CENTS = 555_000;
const CONTRIBUTION_MAX_ANNUAL_CENTS = 6_121_440;

function progressiveTax(baseCents: number, bands: Band[], deltaBps = 0): number {
  let previous = 0;
  let total = 0;
  for (const band of bands) {
    const upper = band.upperCents ?? baseCents;
    const taxableInBand = Math.max(0, Math.min(baseCents, upper) - previous);
    total += Math.round((taxableInBand * Math.max(0, band.rateBps + deltaBps)) / 10_000);
    if (baseCents <= upper) break;
    previous = upper;
  }
  return total;
}

function descendantMinimum(household: HouseholdInput): number {
  const eligible = household.dependants.filter(
    (dependant) => dependant.dependentForTaxPurposes && dependant.relationship !== "other",
  );
  const amounts = [240_000, 270_000, 400_000, 450_000];
  return eligible.reduce((sum, dependant, index) => {
    const base = amounts[Math.min(index, amounts.length - 1)];
    const underThree = dependant.age < 3 ? 280_000 : 0;
    const disability =
      dependant.disabilityBand === "broad_higher_band"
        ? 900_000
        : dependant.disabilityBand === "broad_lower_band"
          ? 300_000
          : 0;
    return sum + base + underThree + disability;
  }, 0);
}

function adultMinimum(adult: AdultInput): number {
  const ageIncrement = adult.age > 75 ? 255_000 : adult.age > 65 ? 115_000 : 0;
  const disability =
    adult.disabilityBand === "broad_higher_band"
      ? 900_000
      : adult.disabilityBand === "broad_lower_band"
        ? 300_000
        : 0;
  return PERSONAL_MINIMUM_CENTS + ageIncrement + disability;
}

function contributionForAdult(adult: AdultInput, scenario: ScenarioDefinition): number {
  const employeeRate = 650 + (scenario.overrides.employeeContributionDeltaBps ?? 0);
  const employeeBase = Math.min(
    adult.annualGrossEmploymentIncome,
    Math.round(CONTRIBUTION_MAX_ANNUAL_CENTS * (adult.monthsWorked / 12)),
  );
  const employeeContribution = Math.round((employeeBase * Math.max(0, employeeRate)) / 10_000);
  const selfEmployedBase = Math.min(
    adult.annualSelfEmploymentNetIncome,
    CONTRIBUTION_MAX_ANNUAL_CENTS,
  );
  const selfEmployedApproximation = Math.round((selfEmployedBase * 3_150) / 10_000);
  return employeeContribution + selfEmployedApproximation;
}

function adultGeneralIncome(adult: AdultInput): number {
  return (
    adult.annualGrossEmploymentIncome +
    adult.annualSelfEmploymentNetIncome +
    adult.annualUnemploymentBenefits +
    adult.annualPensionIncome +
    adult.annualOtherTaxableBenefits
  );
}

function calculateTaxForMode(
  household: HouseholdInput,
  scenario: ScenarioDefinition,
  mode: "individual" | "joint",
  contributions: number[],
): Pick<
  AnnualBreakdown,
  | "generalTaxBase"
  | "savingsTaxBase"
  | "personalAndFamilyMinimum"
  | "jointFilingReduction"
  | "stateIrpfBeforeCredits"
  | "autonomousIrpfBeforeCredits"
> {
  const savingsBase = Math.max(
    0,
    household.broadCapitalIncome.annualInterest +
      household.broadCapitalIncome.annualDividends +
      household.broadCapitalIncome.annualCapitalGains -
      household.broadCapitalIncome.annualCapitalLosses,
  );
  const propertyIncome = household.broadCapitalIncome.annualPropertyIncome;
  const familyMinimum = descendantMinimum(household);
  const stateDelta = scenario.overrides.stateRateDeltaBps ?? 0;
  const autonomousDelta = scenario.overrides.autonomousRateDeltaBps ?? 0;

  if (mode === "joint") {
    const grossGeneral = household.adults.reduce(
      (sum, adult) => sum + adultGeneralIncome(adult),
      propertyIncome,
    );
    const jointReduction =
      household.maritalStatus === "married"
        ? 340_000
        : household.singleParentHousehold
          ? 215_000
          : 0;
    const base = Math.max(
      0,
      grossGeneral - contributions.reduce((sum, amount) => sum + amount, 0) - jointReduction,
    );
    const minimum = adultMinimum(household.adults[0]) + familyMinimum;
    const stateGeneral = Math.max(
      0,
      progressiveTax(base, STATE_GENERAL_BANDS, stateDelta) -
        progressiveTax(Math.min(base, minimum), STATE_GENERAL_BANDS, stateDelta),
    );
    const autonomousGeneral = Math.max(
      0,
      progressiveTax(base, STATE_GENERAL_BANDS, autonomousDelta) -
        progressiveTax(Math.min(base, minimum), STATE_GENERAL_BANDS, autonomousDelta),
    );
    const stateSavings = progressiveTax(savingsBase, SAVINGS_HALF_BANDS);
    const autonomousSavings = progressiveTax(savingsBase, SAVINGS_HALF_BANDS);
    return {
      generalTaxBase: base,
      savingsTaxBase: savingsBase,
      personalAndFamilyMinimum: minimum,
      jointFilingReduction: jointReduction,
      stateIrpfBeforeCredits: stateGeneral + stateSavings,
      autonomousIrpfBeforeCredits: autonomousGeneral + autonomousSavings,
    };
  }

  const adultShareOfFamilyMinimum = household.adults.length
    ? Math.round(familyMinimum / household.adults.length)
    : 0;
  let generalTaxBase = 0;
  let personalAndFamilyMinimum = 0;
  let stateIrpfBeforeCredits = 0;
  let autonomousIrpfBeforeCredits = 0;
  household.adults.forEach((adult, index) => {
    const allocatedPropertyIncome = Math.round(propertyIncome / household.adults.length);
    const base = Math.max(
      0,
      adultGeneralIncome(adult) + allocatedPropertyIncome - contributions[index],
    );
    const minimum = adultMinimum(adult) + adultShareOfFamilyMinimum;
    generalTaxBase += base;
    personalAndFamilyMinimum += minimum;
    stateIrpfBeforeCredits += Math.max(
      0,
      progressiveTax(base, STATE_GENERAL_BANDS, stateDelta) -
        progressiveTax(Math.min(base, minimum), STATE_GENERAL_BANDS, stateDelta),
    );
    autonomousIrpfBeforeCredits += Math.max(
      0,
      progressiveTax(base, STATE_GENERAL_BANDS, autonomousDelta) -
        progressiveTax(Math.min(base, minimum), STATE_GENERAL_BANDS, autonomousDelta),
    );
  });
  return {
    generalTaxBase,
    savingsTaxBase: savingsBase,
    personalAndFamilyMinimum,
    jointFilingReduction: 0,
    stateIrpfBeforeCredits:
      stateIrpfBeforeCredits + progressiveTax(savingsBase, SAVINGS_HALF_BANDS),
    autonomousIrpfBeforeCredits:
      autonomousIrpfBeforeCredits + progressiveTax(savingsBase, SAVINGS_HALF_BANDS),
  };
}

function scenarioAnnual(
  household: HouseholdInput,
  scenario: ScenarioDefinition,
  mode: "individual" | "joint",
): AnnualBreakdown {
  const contributions = household.adults.map((adult) =>
    contributionForAdult(adult, scenario),
  );
  const socialSecurityContributions = contributions.reduce((sum, amount) => sum + amount, 0);
  const grossFromAdults = household.adults.reduce(
    (sum, adult) =>
      sum +
      adultGeneralIncome(adult) +
      adult.annualExemptIncome,
    0,
  );
  const grossHouseholdIncome =
    grossFromAdults +
    household.broadCapitalIncome.annualInterest +
    household.broadCapitalIncome.annualDividends +
    household.broadCapitalIncome.annualPropertyIncome +
    household.broadCapitalIncome.annualCapitalGains -
    household.broadCapitalIncome.annualCapitalLosses;
  const exemptIncome = household.adults.reduce(
    (sum, adult) => sum + adult.annualExemptIncome,
    0,
  );
  const tax = calculateTaxForMode(household, scenario, mode, contributions);
  const eligibleDependants = household.dependants.filter(
    (dependant) => dependant.dependentForTaxPurposes,
  ).length;
  const childCredit = (scenario.overrides.childCreditCents ?? 0) * eligibleDependants;
  const childTransfer =
    (scenario.overrides.annualPerEligibleDescendantCents ?? 0) * eligibleDependants;
  const renterCredit =
    household.housing.tenure === "renter" || household.housing.tenure === "social_renter"
      ? scenario.overrides.renterCreditCents ?? 0
      : 0;
  const deductionsAndCredits = childCredit + renterCredit;
  const finalIrpf = Math.max(
    0,
    tax.stateIrpfBeforeCredits + tax.autonomousIrpfBeforeCredits - deductionsAndCredits,
  );
  const pensionIncome = household.adults.reduce(
    (sum, adult) => sum + adult.annualPensionIncome,
    0,
  );
  return {
    grossHouseholdIncome,
    exemptIncome,
    socialSecurityContributions,
    ...tax,
    deductionsAndCredits,
    finalIrpf,
    cashBenefits: household.householdBenefits + childTransfer,
    pensionIncome,
    estimatedDisposableIncome:
      grossHouseholdIncome + household.householdBenefits + childTransfer - socialSecurityContributions - finalIrpf,
  };
}

function chooseMode(
  household: HouseholdInput,
  baseline: ScenarioDefinition,
): "individual" | "joint" {
  if (household.filingPreference !== "calculate_best") {
    return household.filingPreference;
  }
  const jointEligible =
    (household.maritalStatus === "married" && household.adults.length === 2) ||
    household.singleParentHousehold;
  if (!jointEligible) return "individual";
  const individual = scenarioAnnual(household, baseline, "individual");
  const joint = scenarioAnnual(household, baseline, "joint");
  return joint.finalIrpf < individual.finalIrpf ? "joint" : "individual";
}

function resultForScenario(
  household: HouseholdInput,
  scenario: ScenarioDefinition,
  baselineAnnual: AnnualBreakdown,
  mode: "individual" | "joint",
): ScenarioResult {
  const annual = scenarioAnnual(household, scenario, mode);
  const totalChange = annual.estimatedDisposableIncome - baselineAnnual.estimatedDisposableIncome;
  const benefitChange =
    annual.cashBenefits - baselineAnnual.cashBenefits +
    annual.deductionsAndCredits - baselineAnnual.deductionsAndCredits;
  const contributionChange =
    annual.socialSecurityContributions - baselineAnnual.socialSecurityContributions;
  const stateChange = annual.stateIrpfBeforeCredits - baselineAnnual.stateIrpfBeforeCredits;
  const autonomousChange =
    annual.autonomousIrpfBeforeCredits - baselineAnnual.autonomousIrpfBeforeCredits;
  const isBaseline = scenario.id === BASELINE_ID;
  const hasSelfEmployment = household.adults.some(
    (adult) => adult.annualSelfEmploymentNetIncome > 0,
  );
  return {
    scenarioId: scenario.id,
    scenarioName: scenario.publicName,
    scenarioStatus: scenario.status,
    policyVersion: scenario.policyVersion,
    validationStatus: scenario.validationStatus,
    annual,
    monthlyEquivalent: {
      estimatedDisposableIncome: Math.round(annual.estimatedDisposableIncome / 12),
      changeFromBaseline: Math.round(totalChange / 12),
    },
    changeFromBaseline: {
      grossIncome: 0,
      socialSecurityContributions: contributionChange === 0 ? 0 : -contributionChange,
      stateIrpf: stateChange === 0 ? 0 : -stateChange,
      autonomousIrpf: autonomousChange === 0 ? 0 : -autonomousChange,
      benefits: benefitChange,
      totalDisposableIncome: totalChange,
    },
    explanationItems: isBaseline
      ? [
          {
            title: "Punto de comparación",
            plainLanguageExplanation:
              "Esta referencia usa la última normativa revisada disponible y debe actualizarse antes del ejercicio 2027.",
            amount: 0,
            direction: "neutral",
          },
        ]
      : [
          {
            title: totalChange >= 0 ? "Aumento estimado" : "Disminución estimada",
            plainLanguageExplanation:
              "El cambio reúne la variación de IRPF, cotizaciones y créditos incluidos en este escenario.",
            amount: totalChange,
            direction: totalChange > 0 ? "increase" : totalChange < 0 ? "decrease" : "neutral",
          },
        ],
    assumptions: scenario.assumptions,
    warnings: [
      ...scenario.limitations,
      "La escala autonómica detallada todavía no ha superado validación territorio por territorio.",
      ...(hasSelfEmployment
        ? ["La aportación de autónomos es una aproximación por falta de base y cobertura detalladas."]
        : []),
    ],
    uncertainty: {
      level: "high",
      reasons: [
        "La normativa 2027 aún no está disponible para validación completa.",
        "La capa autonómica usa un proxy explícito en este corte de pre-lanzamiento.",
      ],
      optionalLowerBound: annual.estimatedDisposableIncome - Math.abs(totalChange) * 0.15,
      optionalUpperBound: annual.estimatedDisposableIncome + Math.abs(totalChange) * 0.15,
    },
    sourceReferences: scenario.sources,
  };
}

export function simulate(household: HouseholdInput): SimulationComparison {
  const community = AUTONOMOUS_COMMUNITIES.find(
    (candidate) => candidate.code === household.residence.autonomousCommunityCode,
  );
  if (!community || community.support === "unsupported") {
    throw new Error("unsupported_territory");
  }
  const baseline = SCENARIOS.find((scenario) => scenario.id === BASELINE_ID);
  if (!baseline) throw new Error("model_unavailable");
  const mode = chooseMode(household, baseline);
  const baselineAnnual = scenarioAnnual(household, baseline, mode);
  const requestedIds = Array.from(
    new Set([BASELINE_ID, ...household.selectedScenarioIds]),
  ).slice(0, 4);
  const requestedScenarios = requestedIds.map((id) => {
    const scenario = SCENARIOS.find((candidate) => candidate.id === id);
    if (!scenario) throw new Error("invalid_scenario");
    return scenario;
  });
  const estimated = household.adults.some(
    (adult) => adult.dataQuality !== "exact",
  );
  return {
    requestId: crypto.randomUUID(),
    taxYear: 2027,
    modelVersion: "cifra-civica-ts-0.1.0",
    calculationTimestamp: new Date().toISOString(),
    inputCompleteness: estimated ? "estimated" : "complete",
    territorialSupport: community.support,
    baselineScenarioId: BASELINE_ID,
    scenarioResults: requestedScenarios.map((scenario) =>
      resultForScenario(household, scenario, baselineAnnual, mode),
    ),
    globalWarnings: [
      "Pre-lanzamiento 2027: la referencia fiscal usa normativa revisada de 2025–2026 y requiere actualización antes de uso electoral público.",
      ...(community.code === "05"
        ? ["Canarias: el cálculo directo no incluye IGIC ni incidencia de impuestos al consumo."]
        : []),
    ],
    provenance: OFFICIAL_SOURCES,
    dataRetention: "not_stored",
    filingModeUsed: mode,
    calculationBackend: "edge_api",
  };
}
