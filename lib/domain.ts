export type FiscalRegime =
  | "common"
  | "foral_navarre"
  | "foral_basque"
  | "partial"
  | "unknown";

export type EmploymentStatus =
  | "employee"
  | "self_employed"
  | "unemployed"
  | "retired"
  | "student"
  | "inactive"
  | "mixed";

export type DisabilityBand =
  | "none"
  | "broad_lower_band"
  | "broad_higher_band"
  | "unknown";

export interface AutonomousCommunity {
  code: string;
  name: string;
  fiscalRegime: FiscalRegime;
  support: "supported" | "partial" | "unsupported";
}

export const AUTONOMOUS_COMMUNITIES: AutonomousCommunity[] = [
  { code: "01", name: "Andalucía", fiscalRegime: "common", support: "supported" },
  { code: "02", name: "Aragón", fiscalRegime: "common", support: "supported" },
  { code: "03", name: "Principado de Asturias", fiscalRegime: "common", support: "supported" },
  { code: "04", name: "Illes Balears", fiscalRegime: "common", support: "supported" },
  { code: "05", name: "Canarias", fiscalRegime: "common", support: "partial" },
  { code: "06", name: "Cantabria", fiscalRegime: "common", support: "supported" },
  { code: "07", name: "Castilla y León", fiscalRegime: "common", support: "supported" },
  { code: "08", name: "Castilla-La Mancha", fiscalRegime: "common", support: "supported" },
  { code: "09", name: "Cataluña", fiscalRegime: "common", support: "supported" },
  { code: "10", name: "Comunitat Valenciana", fiscalRegime: "common", support: "supported" },
  { code: "11", name: "Extremadura", fiscalRegime: "common", support: "supported" },
  { code: "12", name: "Galicia", fiscalRegime: "common", support: "supported" },
  { code: "13", name: "Comunidad de Madrid", fiscalRegime: "common", support: "supported" },
  { code: "14", name: "Región de Murcia", fiscalRegime: "common", support: "supported" },
  { code: "15", name: "Comunidad Foral de Navarra", fiscalRegime: "foral_navarre", support: "unsupported" },
  { code: "16", name: "País Vasco", fiscalRegime: "foral_basque", support: "unsupported" },
  { code: "17", name: "La Rioja", fiscalRegime: "common", support: "supported" },
  { code: "18", name: "Ceuta", fiscalRegime: "partial", support: "unsupported" },
  { code: "19", name: "Melilla", fiscalRegime: "partial", support: "unsupported" },
];

export interface AdultInput {
  id: string;
  age: number;
  relationshipToHousehold: "primary" | "spouse_partner" | "other_adult";
  employmentStatus: EmploymentStatus;
  annualGrossEmploymentIncome: number;
  annualSelfEmploymentNetIncome: number;
  annualUnemploymentBenefits: number;
  annualPensionIncome: number;
  annualOtherTaxableBenefits: number;
  annualExemptIncome: number;
  disabilityBand: DisabilityBand;
  monthsWorked: number;
  multipleJobs: boolean;
  dataQuality: "exact" | "estimated" | "unknown";
}

export interface DependantInput {
  id: string;
  age: number;
  relationship: "child" | "descendant" | "ascendant" | "other";
  disabilityBand: DisabilityBand;
  sharedCustody: boolean;
  dependentForTaxPurposes: boolean;
}

export interface HouseholdInput {
  taxYear: 2027;
  locale: "es-ES";
  residence: {
    autonomousCommunityCode: string;
    municipalityCode?: string;
    fiscalRegime: FiscalRegime;
  };
  filingPreference: "calculate_best" | "individual" | "joint";
  maritalStatus:
    | "single"
    | "married"
    | "separated"
    | "divorced"
    | "widowed"
    | "domestic_partnership";
  singleParentHousehold: boolean;
  adults: AdultInput[];
  dependants: DependantInput[];
  housing: {
    tenure:
      | "owner_no_mortgage"
      | "owner_with_mortgage"
      | "renter"
      | "social_renter"
      | "living_with_family"
      | "other";
    annualRent: number;
    mortgageExists: boolean;
    primaryResidence: boolean;
  };
  householdBenefits: number;
  broadCapitalIncome: {
    annualInterest: number;
    annualDividends: number;
    annualPropertyIncome: number;
    annualCapitalGains: number;
    annualCapitalLosses: number;
    valuesAreEstimated: boolean;
  };
  selectedScenarioIds: string[];
  userConfirmedAssumptions: string[];
}

export interface PolicySource {
  id: string;
  title: string;
  publisher: string;
  href: string;
  reviewedAt: string;
}

export interface ScenarioDefinition {
  id: string;
  slug: string;
  publicName: string;
  shortName: string;
  shortDescription: string;
  sponsor: string;
  status: "draft" | "proposed" | "legislated" | "simulated" | "validated" | "archived";
  validationStatus:
    | "unreviewed"
    | "source_reviewed"
    | "household_tested"
    | "aggregate_tested"
    | "production_validated";
  taxYear: 2027;
  policyVersion: string;
  inheritedBaseline?: string;
  synthetic: boolean;
  assumptions: string[];
  limitations: string[];
  sources: PolicySource[];
  overrides: {
    employeeContributionDeltaBps?: number;
    stateRateDeltaBps?: number;
    autonomousRateDeltaBps?: number;
    childCreditCents?: number;
    annualPerEligibleDescendantCents?: number;
    renterCreditCents?: number;
  };
}

export interface AnnualBreakdown {
  grossHouseholdIncome: number;
  exemptIncome: number;
  socialSecurityContributions: number;
  generalTaxBase: number;
  savingsTaxBase: number;
  personalAndFamilyMinimum: number;
  jointFilingReduction: number;
  stateIrpfBeforeCredits: number;
  autonomousIrpfBeforeCredits: number;
  deductionsAndCredits: number;
  finalIrpf: number;
  cashBenefits: number;
  pensionIncome: number;
  estimatedDisposableIncome: number;
}

export interface ScenarioResult {
  scenarioId: string;
  scenarioName: string;
  scenarioStatus: ScenarioDefinition["status"];
  policyVersion: string;
  validationStatus: ScenarioDefinition["validationStatus"];
  annual: AnnualBreakdown;
  monthlyEquivalent: {
    estimatedDisposableIncome: number;
    changeFromBaseline: number;
  };
  changeFromBaseline: {
    grossIncome: number;
    socialSecurityContributions: number;
    stateIrpf: number;
    autonomousIrpf: number;
    benefits: number;
    totalDisposableIncome: number;
  };
  explanationItems: Array<{
    title: string;
    plainLanguageExplanation: string;
    amount: number;
    direction: "increase" | "decrease" | "neutral";
  }>;
  assumptions: string[];
  warnings: string[];
  uncertainty: {
    level: "low" | "medium" | "high" | "not_assessed";
    reasons: string[];
    optionalLowerBound?: number;
    optionalUpperBound?: number;
  };
  sourceReferences: PolicySource[];
}

export interface SimulationComparison {
  requestId: string;
  taxYear: 2027;
  modelVersion: string;
  calculationTimestamp: string;
  inputCompleteness: "complete" | "estimated" | "incomplete";
  territorialSupport: "supported" | "partial" | "unsupported";
  baselineScenarioId: string;
  scenarioResults: ScenarioResult[];
  globalWarnings: string[];
  provenance: PolicySource[];
  dataRetention: "not_stored";
  filingModeUsed: "individual" | "joint";
  calculationBackend: "python_api" | "edge_api";
}

export function createAdult(index: number, id = crypto.randomUUID()): AdultInput {
  return {
    id,
    age: 35,
    relationshipToHousehold: index === 0 ? "primary" : "spouse_partner",
    employmentStatus: "employee",
    annualGrossEmploymentIncome: 0,
    annualSelfEmploymentNetIncome: 0,
    annualUnemploymentBenefits: 0,
    annualPensionIncome: 0,
    annualOtherTaxableBenefits: 0,
    annualExemptIncome: 0,
    disabilityBand: "none",
    monthsWorked: 12,
    multipleJobs: false,
    dataQuality: "exact",
  };
}

export function createDefaultHousehold(): HouseholdInput {
  return {
    taxYear: 2027,
    locale: "es-ES",
    residence: {
      autonomousCommunityCode: "13",
      fiscalRegime: "common",
    },
    filingPreference: "calculate_best",
    maritalStatus: "single",
    singleParentHousehold: false,
    // The initial value renders on both server and client. A stable identifier
    // prevents hydration drift; adults added interactively still use UUIDs.
    adults: [createAdult(0, "adult-1")],
    dependants: [],
    housing: {
      tenure: "renter",
      annualRent: 0,
      mortgageExists: false,
      primaryResidence: true,
    },
    householdBenefits: 0,
    broadCapitalIncome: {
      annualInterest: 0,
      annualDividends: 0,
      annualPropertyIncome: 0,
      annualCapitalGains: 0,
      annualCapitalLosses: 0,
      valuesAreEstimated: false,
    },
    selectedScenarioIds: [
      "baseline-2027-common-reference",
      "demo-family-tax-relief-2027",
      "demo-child-transfer-2027",
    ],
    userConfirmedAssumptions: [],
  };
}
