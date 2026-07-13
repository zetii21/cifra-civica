"""Strict API input and output contracts.

All monetary values are integer euro cents.  JSON uses camelCase while Python keeps
domain-readable snake_case names.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Dict, List, Literal, Optional, Union
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator
from pydantic.alias_generators import to_camel

MAX_ANNUAL_CENTS = 10_000_000_000  # EUR 100 million: catches likely data-entry errors.


class APIModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="forbid",
        use_enum_values=True,
    )


class FiscalRegime(str, Enum):
    COMMON = "common"
    FORAL_NAVARRE = "foral_navarre"
    FORAL_BASQUE = "foral_basque"
    UNKNOWN = "unknown"


class FilingPreference(str, Enum):
    CALCULATE_BEST = "calculate_best"
    INDIVIDUAL = "individual"
    JOINT = "joint"


class MaritalStatus(str, Enum):
    SINGLE = "single"
    MARRIED = "married"
    SEPARATED = "separated"
    DIVORCED = "divorced"
    WIDOWED = "widowed"
    DOMESTIC_PARTNERSHIP = "domestic_partnership"


class RelationshipToHousehold(str, Enum):
    PRIMARY = "primary"
    SPOUSE_PARTNER = "spouse_partner"
    OTHER_ADULT = "other_adult"
    DEPENDENT_ADULT = "dependent_adult"


class EmploymentStatus(str, Enum):
    EMPLOYEE = "employee"
    SELF_EMPLOYED = "self_employed"
    UNEMPLOYED = "unemployed"
    RETIRED = "retired"
    STUDENT = "student"
    INACTIVE = "inactive"
    MIXED = "mixed"


class DisabilityBand(str, Enum):
    NONE = "none"
    BROAD_LOWER = "broad_lower_band"
    BROAD_HIGHER = "broad_higher_band"
    UNKNOWN = "unknown"


class SocialSecurityCategory(str, Enum):
    GENERAL_EMPLOYEE = "general_employee"
    SELF_EMPLOYED = "self_employed"
    OTHER = "other"
    UNKNOWN = "unknown"


class DataQuality(str, Enum):
    EXACT = "exact"
    ESTIMATED = "estimated"
    UNKNOWN = "unknown"


class ResidenceInput(APIModel):
    autonomous_community_code: str = Field(pattern=r"^[0-9]{2}$")
    municipality_code: Optional[str] = Field(default=None, pattern=r"^[0-9]{5}$")
    fiscal_regime: FiscalRegime


class PersonInput(APIModel):
    id: UUID
    age: int = Field(ge=18, le=110)
    relationship_to_household: RelationshipToHousehold
    employment_status: EmploymentStatus
    annual_gross_employment_income: int = Field(default=0, ge=0, le=MAX_ANNUAL_CENTS)
    annual_self_employment_net_income: int = Field(default=0, ge=0, le=MAX_ANNUAL_CENTS)
    annual_unemployment_benefits: int = Field(default=0, ge=0, le=MAX_ANNUAL_CENTS)
    annual_pension_income: int = Field(default=0, ge=0, le=MAX_ANNUAL_CENTS)
    annual_other_taxable_benefits: int = Field(default=0, ge=0, le=MAX_ANNUAL_CENTS)
    annual_exempt_income: int = Field(default=0, ge=0, le=MAX_ANNUAL_CENTS)
    disability_band: DisabilityBand = DisabilityBand.NONE
    social_security_category: SocialSecurityCategory
    months_worked: int = Field(default=0, ge=0, le=12)
    multiple_jobs: bool = False
    contribution_base_override: Optional[int] = Field(default=None, gt=0, le=MAX_ANNUAL_CENTS)
    data_quality: DataQuality = DataQuality.EXACT

    @model_validator(mode="after")
    def income_requires_worked_months(self) -> PersonInput:
        labour_income = self.annual_gross_employment_income + self.annual_self_employment_net_income
        if labour_income > 0 and self.months_worked == 0:
            raise ValueError("monthsWorked debe ser mayor que cero cuando hay ingresos laborales")
        return self


class DependantRelationship(str, Enum):
    CHILD = "child"
    DESCENDANT = "descendant"
    ASCENDANT = "ascendant"
    OTHER = "other"


class DependantInput(APIModel):
    id: UUID
    age: int = Field(ge=0, le=120)
    relationship: DependantRelationship
    disability_band: DisabilityBand = DisabilityBand.NONE
    shared_custody: bool = False
    dependent_for_tax_purposes: Union[bool, Literal["unknown"]]


class HousingTenure(str, Enum):
    OWNER_NO_MORTGAGE = "owner_no_mortgage"
    OWNER_WITH_MORTGAGE = "owner_with_mortgage"
    RENTER = "renter"
    SOCIAL_RENTER = "social_renter"
    LIVING_WITH_FAMILY = "living_with_family"
    OTHER = "other"


class HousingInput(APIModel):
    tenure: HousingTenure = HousingTenure.OTHER
    annual_rent: Optional[int] = Field(default=None, ge=0, le=MAX_ANNUAL_CENTS)
    mortgage_exists: bool = False
    mortgage_start_year: Optional[int] = Field(default=None, ge=1900, le=2027)
    primary_residence: bool = True
    protected_housing: Union[bool, Literal["unknown"], None] = None


class BenefitTaxTreatment(str, Enum):
    EXEMPT = "exempt"
    TAXABLE = "taxable"
    UNKNOWN = "unknown"


class HouseholdBenefitInput(APIModel):
    benefit_type: str = Field(min_length=1, max_length=80, pattern=r"^[a-z0-9_-]+$")
    annual_amount: int = Field(ge=0, le=MAX_ANNUAL_CENTS)
    tax_treatment: BenefitTaxTreatment = BenefitTaxTreatment.UNKNOWN
    data_quality: DataQuality = DataQuality.EXACT


class CapitalIncomeInput(APIModel):
    annual_interest: int = Field(default=0, ge=0, le=MAX_ANNUAL_CENTS)
    annual_dividends: int = Field(default=0, ge=0, le=MAX_ANNUAL_CENTS)
    annual_property_income: int = Field(default=0, ge=0, le=MAX_ANNUAL_CENTS)
    annual_capital_gains: int = Field(default=0, ge=0, le=MAX_ANNUAL_CENTS)
    annual_capital_losses: int = Field(default=0, ge=0, le=MAX_ANNUAL_CENTS)
    values_are_estimated: bool = False


class HouseholdInput(APIModel):
    residence: ResidenceInput
    filing_preference: FilingPreference
    marital_status: MaritalStatus
    single_parent_household: bool
    adults: List[PersonInput] = Field(min_length=1, max_length=6)
    dependants: List[DependantInput] = Field(default_factory=list, max_length=12)
    housing: HousingInput = Field(default_factory=HousingInput)
    household_benefits: List[HouseholdBenefitInput] = Field(default_factory=list, max_length=20)
    broad_capital_income: CapitalIncomeInput = Field(default_factory=CapitalIncomeInput)
    user_confirmed_assumptions: List[str] = Field(default_factory=list, max_length=30)

    @model_validator(mode="after")
    def validate_people(self) -> HouseholdInput:
        person_ids = [person.id for person in self.adults]
        dependant_ids = [dependant.id for dependant in self.dependants]
        if len(set(person_ids + dependant_ids)) != len(person_ids) + len(dependant_ids):
            raise ValueError("Los identificadores de personas deben ser únicos")
        primary_count = sum(
            person.relationship_to_household == RelationshipToHousehold.PRIMARY for person in self.adults
        )
        if primary_count != 1:
            raise ValueError("Debe existir exactamente una persona principal")
        return self


class ComparisonRequest(APIModel):
    tax_year: int = Field(ge=2000, le=2100)
    locale: Literal["es-ES"] = "es-ES"
    household: HouseholdInput
    scenario_ids: List[str] = Field(default_factory=list, max_length=4)
    include_trace: bool = False

    @model_validator(mode="after")
    def unique_scenarios(self) -> ComparisonRequest:
        if len(self.scenario_ids) != len(set(self.scenario_ids)):
            raise ValueError("scenarioIds no puede contener duplicados")
        return self


class AnnualBreakdown(APIModel):
    gross_household_income: int
    exempt_income: int
    social_security_contributions: int
    general_tax_base: int
    savings_tax_base: int
    personal_and_family_minimum: int
    joint_filing_reduction: int
    state_irpf_before_credits: int
    autonomous_irpf_before_credits: int
    deductions_and_credits: int
    final_irpf: int
    cash_benefits: int
    pension_income: int
    estimated_disposable_income: int


class MonthlyEquivalent(APIModel):
    estimated_disposable_income: int
    change_from_baseline: int


class ChangeFromBaseline(APIModel):
    gross_income: int
    social_security_contributions: int
    state_irpf: int
    autonomous_irpf: int
    benefits: int
    total_disposable_income: int


class ExplanationDirection(str, Enum):
    INCREASE = "increase"
    DECREASE = "decrease"
    NEUTRAL = "neutral"


class ExplanationItem(APIModel):
    title: str
    plain_language_explanation: str
    amount: int
    direction: ExplanationDirection
    related_variables: List[str]
    related_policy_rule_ids: List[str]


class Uncertainty(APIModel):
    level: Literal["low", "medium", "high", "not_assessed"]
    reasons: List[str]
    optional_lower_bound: Optional[int] = None
    optional_upper_bound: Optional[int] = None


class SourceReference(APIModel):
    id: str
    title: str
    url: str
    publisher: str
    last_reviewed_at: str


class CalculationTraceEntry(APIModel):
    variable: str
    amount: int
    dependencies: List[str]
    rule_id: str


class ScenarioResult(APIModel):
    scenario_id: str
    scenario_name: str
    scenario_status: str
    policy_version: str
    validation_status: str
    filing_mode_applied: str
    annual: AnnualBreakdown
    monthly_equivalent: MonthlyEquivalent
    change_from_baseline: ChangeFromBaseline
    explanation_items: List[ExplanationItem]
    assumptions: List[str]
    warnings: List[str]
    uncertainty: Uncertainty
    source_references: List[SourceReference]
    calculation_trace: Optional[List[CalculationTraceEntry]] = None


class SimulationComparison(APIModel):
    request_id: str
    tax_year: int
    model_version: str
    calculation_timestamp: datetime
    input_completeness: Literal["complete", "estimated", "incomplete"]
    territorial_support: Literal["supported", "partial", "unsupported"]
    baseline_scenario_id: str
    scenario_results: List[ScenarioResult]
    global_warnings: List[str]
    provenance: List[SourceReference]
    data_retention: Literal["not_stored"] = "not_stored"


class SafeError(APIModel):
    code: str
    message: str
    request_id: str
    details: Optional[List[Dict[str, str]]] = None
