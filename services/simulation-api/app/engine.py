"""Deterministic Spain fiscal reference engine.

This is an OpenFisca-compatible design boundary rather than an OpenFisca Core
integration: named pure formulas consume dated parameter dictionaries and emit an
optional dependency trace. No language model participates in arithmetic.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass, field
from datetime import datetime, timezone
from functools import wraps
from typing import Any, Callable, Dict, List, Literal, Optional, Tuple, TypeVar

from typing_extensions import ParamSpec

from .config import Settings
from .models import (
    AnnualBreakdown,
    CalculationTraceEntry,
    ChangeFromBaseline,
    ComparisonRequest,
    DependantInput,
    ExplanationDirection,
    ExplanationItem,
    HouseholdInput,
    MonthlyEquivalent,
    PersonInput,
    ScenarioResult,
    SimulationComparison,
    SourceReference,
    Uncertainty,
)
from .registry import PolicyEntry, PolicyRegistry

FORMULA_REGISTRY: Dict[str, Callable[..., Any]] = {}
P = ParamSpec("P")
R = TypeVar("R")


def fiscal_formula(rule_id: str) -> Callable[[Callable[P, R]], Callable[P, R]]:
    """Tag executable formulas so the model inventory is generated, not asserted."""

    def decorator(function: Callable[P, R]) -> Callable[P, R]:
        if rule_id in FORMULA_REGISTRY:
            raise RuntimeError(f"Duplicate fiscal formula id: {rule_id}")

        @wraps(function)
        def wrapped(*args: P.args, **kwargs: P.kwargs) -> R:
            return function(*args, **kwargs)

        setattr(wrapped, "fiscal_rule_id", rule_id)  # noqa: B010 - inventory tag
        FORMULA_REGISTRY[rule_id] = wrapped
        return wrapped

    return decorator


NAMED_VARIABLES: Tuple[str, ...] = (
    "gross_household_income",
    "exempt_income",
    "employee_social_security_contributions",
    "self_employed_social_security_contributions",
    "social_security_contributions",
    "net_work_income",
    "work_income_reduction",
    "general_tax_base",
    "savings_tax_base",
    "state_personal_and_family_minimum",
    "autonomous_personal_and_family_minimum",
    "joint_filing_reduction",
    "state_general_irpf",
    "state_savings_irpf",
    "autonomous_general_irpf",
    "autonomous_savings_irpf",
    "state_irpf_before_credits",
    "autonomous_irpf_before_credits",
    "deductions_and_credits",
    "final_irpf",
    "cash_benefits",
    "pension_income",
    "estimated_disposable_income",
    "monthly_disposable_income",
    "change_gross_income",
    "change_social_security_contributions",
    "change_state_irpf",
    "change_autonomous_irpf",
    "change_benefits",
    "change_total_disposable_income",
)


class DomainError(RuntimeError):
    def __init__(self, code: str, message: str, *, status_code: int = 422):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


@dataclass
class ContributionResult:
    total_cents: int
    per_person_cents: Dict[str, int]
    employee_per_person_cents: Dict[str, int]
    self_employed_per_person_cents: Dict[str, int]
    assumptions: List[str]
    warnings: List[str]
    trace: List[CalculationTraceEntry]


@dataclass
class TaxTotals:
    general_base_cents: int = 0
    savings_base_cents: int = 0
    state_minimum_cents: int = 0
    autonomous_minimum_cents: int = 0
    joint_reduction_cents: int = 0
    state_irpf_cents: int = 0
    autonomous_irpf_cents: int = 0
    filing_mode: str = "individual"
    assumptions: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    trace: List[CalculationTraceEntry] = field(default_factory=list)


@dataclass
class RawScenarioCalculation:
    annual: AnnualBreakdown
    filing_mode: str
    assumptions: List[str]
    warnings: List[str]
    uncertainty_reasons: List[str]
    trace: List[CalculationTraceEntry]


def _round_ratio_half_up(amount: int, numerator: int, denominator: int = 10_000) -> int:
    """Round a non-negative integer ratio to cents using arithmetic half-up."""

    if amount < 0 or numerator < 0 or denominator <= 0:
        raise ValueError("Monetary ratios require non-negative inputs and a positive denominator")
    return (amount * numerator + denominator // 2) // denominator


def _allocate_integer(total: int, parts: int, index: int) -> int:
    if parts <= 0 or not 0 <= index < parts:
        raise ValueError("Invalid integer allocation")
    quotient, remainder = divmod(total, parts)
    return quotient + (1 if index < remainder else 0)


@fiscal_formula("irpf.progressive_scale")
def progressive_tax(amount_cents: int, scale: Sequence[Mapping[str, int]]) -> int:
    """Apply a marginal scale, rounding each statutory band to euro cents."""

    if amount_cents <= 0:
        return 0
    tax_cents = 0
    for index, bracket in enumerate(scale):
        lower = int(bracket["thresholdCents"])
        if amount_cents <= lower:
            break
        upper = int(scale[index + 1]["thresholdCents"]) if index + 1 < len(scale) else amount_cents
        taxable_slice = min(amount_cents, upper) - lower
        if taxable_slice > 0:
            tax_cents += _round_ratio_half_up(taxable_slice, int(bracket["rateBasisPoints"]))
    return tax_cents


def _scale_with_delta(scale: Sequence[Mapping[str, int]], delta_basis_points: int) -> List[Dict[str, int]]:
    return [
        {
            "thresholdCents": int(bracket["thresholdCents"]),
            "rateBasisPoints": max(0, int(bracket["rateBasisPoints"]) + delta_basis_points),
        }
        for bracket in scale
    ]


@fiscal_formula("social_security.employee")
def _employee_contribution(person: PersonInput, parameters: Mapping[str, Any]) -> Tuple[int, List[str], List[str]]:
    income = person.annual_gross_employment_income
    if income <= 0:
        return 0, [], []

    employee = parameters["socialSecurity"]["employee"]
    months = person.months_worked
    maximum_regular_base = int(employee["monthlyMaximumBaseCents"]) * months
    assumptions = [
        "La cotización por desempleo se aproxima con el tipo de contratación indefinida.",
        "La remuneración se distribuye uniformemente entre los meses trabajados para cotización.",
    ]
    warnings: List[str] = [
        "No se reconstruyen bases mínimas por grupo de cotización ni coeficientes de jornada parcial."
    ]

    override = person.contribution_base_override
    if override is not None and person.social_security_category == "general_employee":
        regular_base = min(override, maximum_regular_base)
        assumptions.append("Se utiliza la base anual de cotización indicada por el usuario.")
    else:
        regular_base = min(income, maximum_regular_base)

    ordinary_rate = sum(
        int(employee[key])
        for key in (
            "commonContingenciesEmployeeRateBasisPoints",
            "unemploymentIndefiniteEmployeeRateBasisPoints",
            "trainingEmployeeRateBasisPoints",
            "meiEmployeeRateBasisPoints",
        )
    )
    contribution = _round_ratio_half_up(regular_base, ordinary_rate)

    solidarity_bands = employee["solidarityBands"]
    for index, band in enumerate(solidarity_bands):
        lower = int(band["thresholdMonthlyCents"]) * months
        if income <= lower:
            break
        upper = (
            int(solidarity_bands[index + 1]["thresholdMonthlyCents"]) * months
            if index + 1 < len(solidarity_bands)
            else income
        )
        slice_cents = min(income, upper) - lower
        contribution += _round_ratio_half_up(slice_cents, int(band["rateBasisPoints"]))

    if person.multiple_jobs:
        warnings.append("La coordinación de topes entre varios empleadores se aproxima con el ingreso anual agregado.")
    if person.social_security_category not in {"general_employee", "self_employed"}:
        warnings.append(
            "La categoría de Seguridad Social no permite fidelidad específica; se aplica el régimen general práctico."
        )
    return contribution, assumptions, warnings


@fiscal_formula("social_security.self_employed")
def _self_employed_contribution(person: PersonInput, parameters: Mapping[str, Any]) -> Tuple[int, List[str], List[str]]:
    net_income = person.annual_self_employment_net_income
    if net_income <= 0:
        return 0, [], []

    self_employed = parameters["socialSecurity"]["selfEmployed"]
    months = person.months_worked
    monthly_income = _round_ratio_half_up(net_income, 1, months)
    selected_band: Mapping[str, Any] = self_employed["incomeBands"][-1]
    for band in self_employed["incomeBands"]:
        upper = band["upToMonthlyNetIncomeCents"]
        if upper is None or monthly_income <= int(upper):
            selected_band = band
            break

    assumptions = ["La cuota de autónomos usa el tramo 2026 correspondiente al rendimiento mensual medio."]
    warnings = [
        "La cotización de autónomos es una aproximación: no reconstruye "
        "regularizaciones, bonificaciones ni pluriactividad."
    ]

    override = person.contribution_base_override
    if override is not None and person.social_security_category == "self_employed":
        requested_monthly_base = _round_ratio_half_up(override, 1, months)
        minimum_base = int(selected_band["minimumBaseCents"])
        maximum_base = min(
            int(selected_band["maximumBaseCents"]),
            int(self_employed["monthlyAbsoluteMaximumBaseCents"]),
        )
        monthly_base = min(max(requested_monthly_base, minimum_base), maximum_base)
        assumptions.append("La base indicada se limita al intervalo mínimo y máximo del tramo RETA aplicable.")
        if monthly_base != requested_monthly_base:
            warnings.append("La base RETA indicada estaba fuera del intervalo del tramo y se ajustó para el cálculo.")
    else:
        monthly_base = int(selected_band["minimumBaseCents"])
        assumptions.append("Sin base indicada, se utiliza la base mínima del tramo RETA aplicable.")

    annual_base = monthly_base * months
    contribution = _round_ratio_half_up(annual_base, int(self_employed["totalRateBasisPoints"]))
    return contribution, assumptions, warnings


@fiscal_formula("social_security.household_total")
def calculate_contributions(household: HouseholdInput, parameters: Mapping[str, Any]) -> ContributionResult:
    total = 0
    per_person: Dict[str, int] = {}
    employee_per_person: Dict[str, int] = {}
    self_employed_per_person: Dict[str, int] = {}
    assumptions: List[str] = []
    warnings: List[str] = []
    trace: List[CalculationTraceEntry] = []
    for person in household.adults:
        employee, employee_assumptions, employee_warnings = _employee_contribution(person, parameters)
        self_employed, self_assumptions, self_warnings = _self_employed_contribution(person, parameters)
        person_total = employee + self_employed
        per_person[str(person.id)] = person_total
        employee_per_person[str(person.id)] = employee
        self_employed_per_person[str(person.id)] = self_employed
        total += person_total
        assumptions.extend(employee_assumptions + self_assumptions)
        warnings.extend(employee_warnings + self_warnings)
        trace.extend(
            [
                CalculationTraceEntry(
                    variable="employee_social_security_contributions",
                    amount=employee,
                    dependencies=["annual_gross_employment_income", "months_worked"],
                    rule_id="social_security.employee",
                ),
                CalculationTraceEntry(
                    variable="self_employed_social_security_contributions",
                    amount=self_employed,
                    dependencies=["annual_self_employment_net_income", "months_worked"],
                    rule_id="social_security.self_employed",
                ),
            ]
        )
    return ContributionResult(
        total_cents=total,
        per_person_cents=per_person,
        employee_per_person_cents=employee_per_person,
        self_employed_per_person_cents=self_employed_per_person,
        assumptions=_unique(assumptions),
        warnings=_unique(warnings),
        trace=trace,
    )


@fiscal_formula("irpf.work_income_reduction")
def _work_income_reduction(
    net_work_income_cents: int,
    other_non_exempt_income_cents: int,
    work_parameters: Mapping[str, Any],
) -> int:
    if other_non_exempt_income_cents > int(work_parameters["otherIncomeEligibilityLimitCents"]):
        return 0
    for band in work_parameters["reductionBands"]:
        if net_work_income_cents <= int(band["upToNetWorkIncomeCents"]):
            reduction = int(band["baseReductionCents"])
            excess = max(0, net_work_income_cents - int(band["excessOverCents"]))
            reduction -= _round_ratio_half_up(excess, int(band["slopeBasisPoints"]))
            return max(0, min(net_work_income_cents, reduction))
    return 0


@fiscal_formula("irpf.person_general_base")
def _person_general_base(
    person: PersonInput,
    employee_contribution_cents: int,
    self_employed_contribution_cents: int,
    other_general_income_cents: int,
    other_non_exempt_income_cents: int,
    parameters: Mapping[str, Any],
) -> Tuple[int, int, int]:
    work_gross = (
        person.annual_gross_employment_income
        + person.annual_unemployment_benefits
        + person.annual_pension_income
        + person.annual_other_taxable_benefits
    )
    employment_share = min(employee_contribution_cents, person.annual_gross_employment_income)
    work_after_contributions = max(0, work_gross - employment_share)
    standard_expense = min(
        work_after_contributions,
        int(parameters["irpf"]["workIncome"]["standardExpenseCents"]),
    )
    net_work_before_reduction = max(0, work_after_contributions - standard_expense)
    reduction = _work_income_reduction(
        work_after_contributions,
        other_non_exempt_income_cents,
        parameters["irpf"]["workIncome"],
    )
    reduction = min(reduction, net_work_before_reduction)
    net_work = max(0, net_work_before_reduction - reduction)
    general_base = (
        net_work
        + max(0, person.annual_self_employment_net_income - self_employed_contribution_cents)
        + other_general_income_cents
    )
    return general_base, net_work, reduction


def _joint_general_base(
    household: HouseholdInput,
    people: Sequence[PersonInput],
    contributions: ContributionResult,
    parameters: Mapping[str, Any],
) -> Tuple[int, int, int]:
    """Calculate work-income expenses and Article 20 reduction once per family unit."""

    work_gross = sum(
        person.annual_gross_employment_income
        + person.annual_unemployment_benefits
        + person.annual_pension_income
        + person.annual_other_taxable_benefits
        for person in people
    )
    employee_contributions = sum(
        min(
            contributions.employee_per_person_cents[str(person.id)],
            person.annual_gross_employment_income,
        )
        for person in people
    )
    work_after_contributions = max(0, work_gross - employee_contributions)
    standard_expense = min(
        work_after_contributions,
        int(parameters["irpf"]["workIncome"]["standardExpenseCents"]),
    )
    net_work_before_reduction = max(0, work_after_contributions - standard_expense)
    primary = _primary_person(household)
    other_non_exempt_income = sum(
        _person_other_non_exempt_income(
            person,
            household,
            primary=person.id == primary.id,
        )
        for person in people
    )
    reduction = _work_income_reduction(
        work_after_contributions,
        other_non_exempt_income,
        parameters["irpf"]["workIncome"],
    )
    reduction = min(reduction, net_work_before_reduction)
    net_work = max(0, net_work_before_reduction - reduction)
    self_employment = sum(
        max(
            0,
            person.annual_self_employment_net_income - contributions.self_employed_per_person_cents[str(person.id)],
        )
        for person in people
    )
    general_capital, _ = _capital_bases(household)
    general_base = net_work + self_employment + general_capital + _taxable_household_benefits(household)
    return general_base, net_work, reduction


def _minimum_config(parameters: Mapping[str, Any], community_code: str) -> Dict[str, Any]:
    minimums = parameters["irpf"]["minimums"]
    config = dict(minimums["default"])
    config.update(minimums["autonomousOverrides"].get(community_code, {}))
    return config


def _person_age_and_disability_minimum(person: PersonInput, minimums: Mapping[str, Any]) -> int:
    total = 0
    if person.age > 65:
        total += int(minimums["ageOver65IncrementCents"])
    if person.age > 75:
        total += int(minimums["ageOver75AdditionalIncrementCents"])
    if person.disability_band == "broad_lower_band":
        total += int(minimums["taxpayerDisabilityLowerCents"])
    elif person.disability_band == "broad_higher_band":
        total += int(minimums["taxpayerDisabilityHigherCents"])
        total += int(minimums["taxpayerDisabilityAssistanceCents"])
    return total


def _eligible_dependants(household: HouseholdInput) -> List[DependantInput]:
    return [dependant for dependant in household.dependants if dependant.dependent_for_tax_purposes is True]


def _dependant_minimum_total(
    household: HouseholdInput,
    minimums: Mapping[str, Any],
    *,
    filing_parts: int,
    filing_index: int,
    joint_includes_spouse: bool,
) -> int:
    eligible = _eligible_dependants(household)
    descendant_order = 0
    total = 0
    for dependant in eligible:
        item_total = 0
        is_disabled = dependant.disability_band in {
            "broad_lower_band",
            "broad_higher_band",
        }
        if dependant.relationship in {"child", "descendant"} and (dependant.age < 25 or is_disabled):
            descendant_amounts = minimums["descendantByOrderCents"]
            amount_index = min(descendant_order, len(descendant_amounts) - 1)
            item_total += int(descendant_amounts[amount_index])
            descendant_order += 1
            if dependant.age < 3:
                item_total += int(minimums["descendantUnder3IncrementCents"])
        elif dependant.relationship == "ascendant" and (dependant.age > 65 or is_disabled):
            item_total += int(minimums["ascendantCents"])
            if dependant.age > 75:
                item_total += int(minimums["ascendantOver75IncrementCents"])
        else:
            continue

        if dependant.disability_band == "broad_lower_band":
            item_total += int(minimums["dependantDisabilityLowerCents"])
        elif dependant.disability_band == "broad_higher_band":
            item_total += int(minimums["dependantDisabilityHigherCents"])
            item_total += int(minimums["dependantDisabilityAssistanceCents"])

        custody_parts = filing_parts
        if dependant.shared_custody and not joint_includes_spouse:
            custody_parts = max(2, filing_parts)
        total += _allocate_integer(item_total, custody_parts, min(filing_index, custody_parts - 1))
    return total


@fiscal_formula("irpf.personal_family_minimum")
def _unit_minimum(
    household: HouseholdInput,
    people: Sequence[PersonInput],
    minimums: Mapping[str, Any],
    *,
    dependant_parts: int,
    dependant_index: int,
    joint_includes_spouse: bool,
) -> int:
    total = int(minimums["taxpayerCents"])
    total += sum(_person_age_and_disability_minimum(person, minimums) for person in people)
    total += _dependant_minimum_total(
        household,
        minimums,
        filing_parts=dependant_parts,
        filing_index=dependant_index,
        joint_includes_spouse=joint_includes_spouse,
    )
    return total


@fiscal_formula("irpf.general_and_savings_quota")
def _quota_for_unit(
    general_base_cents: int,
    savings_base_cents: int,
    minimum_cents: int,
    general_scale: Sequence[Mapping[str, int]],
    savings_scale: Sequence[Mapping[str, int]],
) -> int:
    general_minimum = min(general_base_cents, minimum_cents)
    general_quota = progressive_tax(general_base_cents, general_scale) - progressive_tax(general_minimum, general_scale)
    remaining_minimum = max(0, minimum_cents - general_minimum)
    savings_minimum = min(savings_base_cents, remaining_minimum)
    savings_quota = progressive_tax(savings_base_cents, savings_scale) - progressive_tax(savings_minimum, savings_scale)
    return max(0, general_quota + savings_quota)


def _primary_person(household: HouseholdInput) -> PersonInput:
    return next(person for person in household.adults if person.relationship_to_household == "primary")


def _tax_parent_people(household: HouseholdInput) -> List[PersonInput]:
    return [person for person in household.adults if person.relationship_to_household in {"primary", "spouse_partner"}]


def _capital_bases(household: HouseholdInput) -> Tuple[int, int]:
    capital = household.broad_capital_income
    general = capital.annual_property_income
    capital_returns = capital.annual_interest + capital.annual_dividends
    gain_balance = capital.annual_capital_gains - capital.annual_capital_losses
    if gain_balance >= 0:
        savings = capital_returns + gain_balance
    else:
        cross_offset_limit = _round_ratio_half_up(capital_returns, 2_500)
        savings = capital_returns - min(capital_returns, -gain_balance, cross_offset_limit)
    return general, savings


def _taxable_household_benefits(household: HouseholdInput) -> int:
    return sum(benefit.annual_amount for benefit in household.household_benefits if benefit.tax_treatment == "taxable")


def _person_other_non_exempt_income(
    person: PersonInput,
    household: HouseholdInput,
    *,
    primary: bool,
) -> int:
    amount = person.annual_self_employment_net_income
    if primary:
        general_capital, savings_capital = _capital_bases(household)
        amount += general_capital + savings_capital + _taxable_household_benefits(household)
    return amount


def _scales(parameters: Mapping[str, Any], community_code: str) -> Tuple[Any, Any, Any]:
    irpf = parameters["irpf"]
    state_scale = _scale_with_delta(irpf["stateGeneralScale"], int(irpf["stateGeneralRateDeltaBasisPoints"]))
    return state_scale, irpf["autonomousGeneralScales"][community_code], irpf


@fiscal_formula("irpf.individual_filing")
def _calculate_individual_tax(
    household: HouseholdInput,
    parameters: Mapping[str, Any],
    contributions: ContributionResult,
) -> TaxTotals:
    community_code = household.residence.autonomous_community_code
    state_scale, autonomous_scale, irpf = _scales(parameters, community_code)
    state_minimums = _minimum_config(parameters, "__state__")
    autonomous_minimums = _minimum_config(parameters, community_code)
    tax_parents = _tax_parent_people(household)
    parent_index = {str(person.id): index for index, person in enumerate(tax_parents)}
    primary = _primary_person(household)
    general_capital, savings_capital = _capital_bases(household)
    taxable_benefits = _taxable_household_benefits(household)
    totals = TaxTotals(filing_mode="individual")

    for person in household.adults:
        is_primary = person.id == primary.id
        other_general = general_capital + taxable_benefits if is_primary else 0
        person_general, net_work, work_reduction = _person_general_base(
            person,
            contributions.employee_per_person_cents[str(person.id)],
            contributions.self_employed_per_person_cents[str(person.id)],
            other_general,
            _person_other_non_exempt_income(person, household, primary=is_primary),
            parameters,
        )
        person_savings = savings_capital if is_primary else 0
        if str(person.id) in parent_index:
            parts = max(1, len(tax_parents))
            index = parent_index[str(person.id)]
            state_minimum = _unit_minimum(
                household,
                [person],
                state_minimums,
                dependant_parts=parts,
                dependant_index=index,
                joint_includes_spouse=False,
            )
            autonomous_minimum = _unit_minimum(
                household,
                [person],
                autonomous_minimums,
                dependant_parts=parts,
                dependant_index=index,
                joint_includes_spouse=False,
            )
        else:
            state_minimum = _unit_minimum(
                household,
                [person],
                state_minimums,
                dependant_parts=1,
                dependant_index=0,
                joint_includes_spouse=False,
            ) - _dependant_minimum_total(
                household,
                state_minimums,
                filing_parts=1,
                filing_index=0,
                joint_includes_spouse=False,
            )
            autonomous_minimum = _unit_minimum(
                household,
                [person],
                autonomous_minimums,
                dependant_parts=1,
                dependant_index=0,
                joint_includes_spouse=False,
            ) - _dependant_minimum_total(
                household,
                autonomous_minimums,
                filing_parts=1,
                filing_index=0,
                joint_includes_spouse=False,
            )

        state_quota = _quota_for_unit(
            person_general,
            person_savings,
            state_minimum,
            state_scale,
            irpf["stateSavingsScale"],
        )
        autonomous_quota = _quota_for_unit(
            person_general,
            person_savings,
            autonomous_minimum,
            autonomous_scale,
            irpf["autonomousSavingsScale"],
        )
        totals.general_base_cents += person_general
        totals.savings_base_cents += person_savings
        totals.state_minimum_cents += state_minimum
        totals.autonomous_minimum_cents += autonomous_minimum
        totals.state_irpf_cents += state_quota
        totals.autonomous_irpf_cents += autonomous_quota
        totals.trace.extend(
            [
                CalculationTraceEntry(
                    variable="net_work_income",
                    amount=net_work,
                    dependencies=["work_income", "social_security_contributions"],
                    rule_id="irpf.person_general_base",
                ),
                CalculationTraceEntry(
                    variable="work_income_reduction",
                    amount=work_reduction,
                    dependencies=["net_work_income", "other_non_exempt_income"],
                    rule_id="irpf.work_income_reduction",
                ),
            ]
        )
    return totals


def _joint_people(household: HouseholdInput) -> Tuple[List[PersonInput], Optional[int]]:
    primary = _primary_person(household)
    spouses = [person for person in household.adults if person.relationship_to_household == "spouse_partner"]
    if household.marital_status == "married" and len(spouses) == 1:
        return [primary, spouses[0]], 340000
    if (
        household.single_parent_household
        and any(dependant.relationship == "child" and dependant.age < 18 for dependant in household.dependants)
        and not spouses
        and household.marital_status in {"single", "separated", "divorced", "widowed"}
    ):
        return [primary], 215000
    return [], None


@fiscal_formula("irpf.joint_filing")
def _calculate_joint_tax(
    household: HouseholdInput,
    parameters: Mapping[str, Any],
    contributions: ContributionResult,
) -> Optional[TaxTotals]:
    joint_people, reduction_hint = _joint_people(household)
    if not joint_people or reduction_hint is None:
        return None

    community_code = household.residence.autonomous_community_code
    state_scale, autonomous_scale, irpf = _scales(parameters, community_code)
    state_minimums = _minimum_config(parameters, "__state__")
    autonomous_minimums = _minimum_config(parameters, community_code)
    _, savings_capital = _capital_bases(household)
    joint_ids = {str(person.id) for person in joint_people}
    totals = TaxTotals(filing_mode="joint")

    joint_general, net_work, work_reduction = _joint_general_base(
        household,
        joint_people,
        contributions,
        parameters,
    )
    totals.trace.extend(
        [
            CalculationTraceEntry(
                variable="net_work_income",
                amount=net_work,
                dependencies=["work_income", "social_security_contributions"],
                rule_id="irpf.person_general_base",
            ),
            CalculationTraceEntry(
                variable="work_income_reduction",
                amount=work_reduction,
                dependencies=["net_work_income", "other_non_exempt_income"],
                rule_id="irpf.work_income_reduction",
            ),
        ]
    )

    reduction_parameters = irpf["jointFiling"]
    if len(joint_people) == 2:
        reduction_limit = int(reduction_parameters["marriedReductionCents"])
    else:
        reduction_limit = int(reduction_parameters["singleParentReductionCents"])
    general_reduction = min(joint_general, reduction_limit)
    savings_reduction = min(savings_capital, reduction_limit - general_reduction)
    joint_reduction = general_reduction + savings_reduction
    adjusted_general = joint_general - general_reduction
    adjusted_savings = savings_capital - savings_reduction
    includes_spouse = len(joint_people) == 2
    state_minimum = _unit_minimum(
        household,
        joint_people,
        state_minimums,
        dependant_parts=1,
        dependant_index=0,
        joint_includes_spouse=includes_spouse,
    )
    autonomous_minimum = _unit_minimum(
        household,
        joint_people,
        autonomous_minimums,
        dependant_parts=1,
        dependant_index=0,
        joint_includes_spouse=includes_spouse,
    )
    totals.general_base_cents += joint_general
    totals.savings_base_cents += savings_capital
    totals.state_minimum_cents += state_minimum
    totals.autonomous_minimum_cents += autonomous_minimum
    totals.joint_reduction_cents += joint_reduction
    totals.state_irpf_cents += _quota_for_unit(
        adjusted_general,
        adjusted_savings,
        state_minimum,
        state_scale,
        irpf["stateSavingsScale"],
    )
    totals.autonomous_irpf_cents += _quota_for_unit(
        adjusted_general,
        adjusted_savings,
        autonomous_minimum,
        autonomous_scale,
        irpf["autonomousSavingsScale"],
    )

    for person in household.adults:
        if str(person.id) in joint_ids:
            continue
        person_general, net_work, work_reduction = _person_general_base(
            person,
            contributions.employee_per_person_cents[str(person.id)],
            contributions.self_employed_per_person_cents[str(person.id)],
            0,
            _person_other_non_exempt_income(person, household, primary=False),
            parameters,
        )
        state_other_minimum = int(state_minimums["taxpayerCents"]) + _person_age_and_disability_minimum(
            person, state_minimums
        )
        autonomous_other_minimum = int(autonomous_minimums["taxpayerCents"]) + _person_age_and_disability_minimum(
            person, autonomous_minimums
        )
        totals.general_base_cents += person_general
        totals.state_minimum_cents += state_other_minimum
        totals.autonomous_minimum_cents += autonomous_other_minimum
        totals.state_irpf_cents += _quota_for_unit(
            person_general,
            0,
            state_other_minimum,
            state_scale,
            irpf["stateSavingsScale"],
        )
        totals.autonomous_irpf_cents += _quota_for_unit(
            person_general,
            0,
            autonomous_other_minimum,
            autonomous_scale,
            irpf["autonomousSavingsScale"],
        )
        totals.trace.extend(
            [
                CalculationTraceEntry(
                    variable="net_work_income",
                    amount=net_work,
                    dependencies=["work_income", "social_security_contributions"],
                    rule_id="irpf.person_general_base",
                ),
                CalculationTraceEntry(
                    variable="work_income_reduction",
                    amount=work_reduction,
                    dependencies=["net_work_income", "other_non_exempt_income"],
                    rule_id="irpf.work_income_reduction",
                ),
            ]
        )
    return totals


@fiscal_formula("irpf.filing_selection")
def calculate_tax(
    household: HouseholdInput,
    parameters: Mapping[str, Any],
    contributions: ContributionResult,
) -> TaxTotals:
    individual = _calculate_individual_tax(household, parameters, contributions)
    joint = _calculate_joint_tax(household, parameters, contributions)
    preference = household.filing_preference
    if preference == "individual":
        return individual
    if preference == "joint":
        if joint is None:
            raise DomainError(
                "incomplete_household",
                "La composición indicada no permite calcular una unidad familiar conjunta.",
            )
        return joint
    if joint is None:
        individual.assumptions.append(
            "No se identificó una unidad familiar conjunta elegible; se aplica tributación individual."
        )
        return individual
    individual_tax = individual.state_irpf_cents + individual.autonomous_irpf_cents
    joint_tax = joint.state_irpf_cents + joint.autonomous_irpf_cents
    selected = joint if joint_tax < individual_tax else individual
    selected.assumptions.append(
        "Se compararon tributación individual y conjunta y se muestra la de menor IRPF estimado."
    )
    return selected


@fiscal_formula("benefits.household_cash")
def _cash_benefits(household: HouseholdInput, parameters: Mapping[str, Any]) -> int:
    entered = sum(benefit.annual_amount for benefit in household.household_benefits)
    eligible_descendants = sum(
        dependant.relationship in {"child", "descendant"} and dependant.dependent_for_tax_purposes is True
        for dependant in household.dependants
    )
    synthetic = eligible_descendants * int(parameters["benefits"]["annualPerEligibleDescendantCents"])
    return entered + synthetic


def _gross_household_income(household: HouseholdInput) -> int:
    people_income = sum(
        person.annual_gross_employment_income
        + person.annual_self_employment_net_income
        + person.annual_unemployment_benefits
        + person.annual_pension_income
        + person.annual_other_taxable_benefits
        + person.annual_exempt_income
        for person in household.adults
    )
    capital = household.broad_capital_income
    return (
        people_income
        + capital.annual_interest
        + capital.annual_dividends
        + capital.annual_property_income
        + capital.annual_capital_gains
    )


def _input_assumptions_and_warnings(household: HouseholdInput) -> Tuple[List[str], List[str]]:
    assumptions: List[str] = list(household.user_confirmed_assumptions)
    warnings: List[str] = []
    if any(benefit.tax_treatment == "unknown" for benefit in household.household_benefits):
        assumptions.append(
            "Las prestaciones con tratamiento fiscal desconocido se consideran exentas en esta estimación."
        )
        warnings.append("Confirme el tratamiento fiscal de las prestaciones: puede cambiar la base general.")
    if any(dependant.dependent_for_tax_purposes == "unknown" for dependant in household.dependants):
        assumptions.append(
            "Las personas con elegibilidad fiscal desconocida no generan mínimo familiar ni transferencia DEMO."
        )
        warnings.append("Falta confirmar la elegibilidad fiscal de una o más personas dependientes.")
    if any(person.disability_band == "unknown" for person in household.adults) or any(
        dependant.disability_band == "unknown" for dependant in household.dependants
    ):
        assumptions.append("Una discapacidad marcada como desconocida no genera mínimo adicional.")
        warnings.append("El grado de discapacidad puede alterar los mínimos personal y familiar.")
    if household.housing.annual_rent or household.housing.mortgage_exists:
        warnings.append(
            "Los datos de vivienda se conservan para elegibilidad futura, pero esta "
            "referencia no aplica deducciones de vivienda."
        )
    if household.broad_capital_income.annual_capital_losses:
        assumptions.append(
            "Las pérdidas patrimoniales se compensan en el ejercicio y el cruce con intereses "
            "y dividendos se limita al 25 %; no se reconstruyen saldos históricos."
        )
        warnings.append("Las pérdidas patrimoniales no se tratan como flujo de caja negativo en la renta disponible.")
    if any(person.annual_self_employment_net_income for person in household.adults):
        assumptions.append(
            "El rendimiento neto de autónomos se interpreta antes de la cuota RETA; "
            "la cuota estimada se resta para la base fiscal y la renta disponible."
        )
    if any(person.annual_unemployment_benefits for person in household.adults):
        assumptions.append(
            "No se deduce cotización durante el desempleo porque no se recoge su modalidad ni base reguladora."
        )
        warnings.append(
            "Una prestación contributiva por desempleo puede soportar cotización y reducir la renta disponible."
        )
    if household.single_parent_household and any(
        dependant.relationship == "child" and dependant.age >= 18 for dependant in household.dependants
    ):
        warnings.append(
            "La unidad familiar monoparental conjunta no incluye hijos adultos porque "
            "no se recoge incapacidad judicial."
        )
    return assumptions, warnings


@fiscal_formula("disposable_income.annual")
def calculate_raw_scenario(
    household: HouseholdInput,
    parameters: Mapping[str, Any],
    policy: PolicyEntry,
) -> RawScenarioCalculation:
    contributions = calculate_contributions(household, parameters)
    tax = calculate_tax(household, parameters, contributions)
    gross = _gross_household_income(household)
    cash_benefits = _cash_benefits(household, parameters)
    exempt_income = sum(person.annual_exempt_income for person in household.adults)
    pension_income = sum(person.annual_pension_income for person in household.adults)
    final_irpf = tax.state_irpf_cents + tax.autonomous_irpf_cents
    disposable = gross + cash_benefits - contributions.total_cents - final_irpf
    input_assumptions, input_warnings = _input_assumptions_and_warnings(household)

    assumptions = _unique(
        list(policy.raw["assumptions"])
        + input_assumptions
        + contributions.assumptions
        + tax.assumptions
        + [
            "No se aplican deducciones o créditos que requieren documentación no recogida.",
            "Las plusvalías, intereses y dividendos se integran en una base del ahorro simplificada.",
        ]
    )
    warnings = _unique(
        contributions.warnings
        + tax.warnings
        + input_warnings
        + [
            "Referencia 2027 por arrastre: utiliza IRPF autonómico 2025 y cotizaciones "
            "2026; debe actualizarse antes de uso público en 2027.",
            "Estimación informativa: no es una declaración, asesoramiento legal ni cálculo oficial.",
        ]
        + (["DEMO — escenario sintético, no es una propuesta oficial."] if policy.is_synthetic else [])
        + (
            ["Canarias: se modela IRPF directo; no se incluye IGIC ni incidencia del consumo."]
            if household.residence.autonomous_community_code == "05"
            else []
        )
    )
    uncertainty_reasons = _unique(
        [
            "Los parámetros se trasladan a 2027 desde referencias oficiales de ejercicios anteriores.",
            "No se modelan deducciones documentales ni todas las interacciones del "
            "sistema tributario y de prestaciones.",
        ]
        + (["El escenario es sintético."] if policy.is_synthetic else [])
        + input_warnings
        + contributions.warnings
    )

    trace = contributions.trace + tax.trace
    trace.extend(
        [
            CalculationTraceEntry(
                variable="general_tax_base",
                amount=tax.general_base_cents,
                dependencies=["net_work_income", "self_employment_income", "property_income"],
                rule_id="irpf.person_general_base",
            ),
            CalculationTraceEntry(
                variable="savings_tax_base",
                amount=tax.savings_base_cents,
                dependencies=["interest", "dividends", "capital_gains", "capital_losses"],
                rule_id="irpf.general_and_savings_quota",
            ),
            CalculationTraceEntry(
                variable="state_irpf_before_credits",
                amount=tax.state_irpf_cents,
                dependencies=["general_tax_base", "savings_tax_base", "state_minimum"],
                rule_id="irpf.general_and_savings_quota",
            ),
            CalculationTraceEntry(
                variable="autonomous_irpf_before_credits",
                amount=tax.autonomous_irpf_cents,
                dependencies=["general_tax_base", "savings_tax_base", "autonomous_minimum"],
                rule_id="irpf.general_and_savings_quota",
            ),
            CalculationTraceEntry(
                variable="estimated_disposable_income",
                amount=disposable,
                dependencies=[
                    "gross_household_income",
                    "cash_benefits",
                    "social_security_contributions",
                    "final_irpf",
                ],
                rule_id="disposable_income.annual",
            ),
        ]
    )

    annual = AnnualBreakdown(
        gross_household_income=gross,
        exempt_income=exempt_income,
        social_security_contributions=contributions.total_cents,
        general_tax_base=tax.general_base_cents,
        savings_tax_base=tax.savings_base_cents,
        personal_and_family_minimum=tax.state_minimum_cents,
        joint_filing_reduction=tax.joint_reduction_cents,
        state_irpf_before_credits=tax.state_irpf_cents,
        autonomous_irpf_before_credits=tax.autonomous_irpf_cents,
        deductions_and_credits=0,
        final_irpf=final_irpf,
        cash_benefits=cash_benefits,
        pension_income=pension_income,
        estimated_disposable_income=disposable,
    )
    return RawScenarioCalculation(
        annual=annual,
        filing_mode=tax.filing_mode,
        assumptions=assumptions,
        warnings=warnings,
        uncertainty_reasons=uncertainty_reasons,
        trace=trace,
    )


@fiscal_formula("scenario.change_decomposition")
def _changes(annual: AnnualBreakdown, baseline: AnnualBreakdown) -> ChangeFromBaseline:
    return ChangeFromBaseline(
        gross_income=annual.gross_household_income - baseline.gross_household_income,
        social_security_contributions=(annual.social_security_contributions - baseline.social_security_contributions),
        state_irpf=annual.state_irpf_before_credits - baseline.state_irpf_before_credits,
        autonomous_irpf=(annual.autonomous_irpf_before_credits - baseline.autonomous_irpf_before_credits),
        benefits=annual.cash_benefits - baseline.cash_benefits,
        total_disposable_income=(annual.estimated_disposable_income - baseline.estimated_disposable_income),
    )


def _explanations(change: ChangeFromBaseline) -> List[ExplanationItem]:
    explanations: List[ExplanationItem] = []
    if change.social_security_contributions:
        explanations.append(
            ExplanationItem(
                title="Cambio en cotizaciones sociales",
                plain_language_explanation=(
                    "Las cotizaciones estimadas disminuyen respecto de la referencia."
                    if change.social_security_contributions < 0
                    else "Las cotizaciones estimadas aumentan respecto de la referencia."
                ),
                amount=change.social_security_contributions,
                direction=(
                    ExplanationDirection.DECREASE
                    if change.social_security_contributions < 0
                    else ExplanationDirection.INCREASE
                ),
                related_variables=["social_security_contributions"],
                related_policy_rule_ids=["social_security.household_total"],
            )
        )
    if change.state_irpf:
        direction = ExplanationDirection.DECREASE if change.state_irpf < 0 else ExplanationDirection.INCREASE
        explanations.append(
            ExplanationItem(
                title="Cambio en el IRPF estatal",
                plain_language_explanation=(
                    "La cuota estatal estimada disminuye respecto de la referencia."
                    if change.state_irpf < 0
                    else "La cuota estatal estimada aumenta respecto de la referencia."
                ),
                amount=change.state_irpf,
                direction=direction,
                related_variables=["state_irpf_before_credits"],
                related_policy_rule_ids=["irpf.general_and_savings_quota"],
            )
        )
    if change.autonomous_irpf:
        explanations.append(
            ExplanationItem(
                title="Cambio en el IRPF autonómico",
                plain_language_explanation="La cuota autonómica estimada cambia respecto de la referencia.",
                amount=change.autonomous_irpf,
                direction=(
                    ExplanationDirection.DECREASE if change.autonomous_irpf < 0 else ExplanationDirection.INCREASE
                ),
                related_variables=["autonomous_irpf_before_credits"],
                related_policy_rule_ids=["irpf.general_and_savings_quota"],
            )
        )
    if change.benefits:
        explanations.append(
            ExplanationItem(
                title="Cambio en transferencias",
                plain_language_explanation="Las transferencias monetarias estimadas cambian respecto de la referencia.",
                amount=change.benefits,
                direction=(ExplanationDirection.INCREASE if change.benefits > 0 else ExplanationDirection.DECREASE),
                related_variables=["cash_benefits"],
                related_policy_rule_ids=["benefits.household_cash"],
            )
        )
    if not explanations:
        explanations.append(
            ExplanationItem(
                title="Sin cambio respecto de la referencia",
                plain_language_explanation="Este resultado reproduce los parámetros de la referencia seleccionada.",
                amount=0,
                direction=ExplanationDirection.NEUTRAL,
                related_variables=["estimated_disposable_income"],
                related_policy_rule_ids=["scenario.change_decomposition"],
            )
        )
    return explanations


def _source_models(registry: PolicyRegistry, policy: PolicyEntry) -> List[SourceReference]:
    return [
        SourceReference(
            id=source["id"],
            title=source["title"],
            url=source["url"],
            publisher=source["publisher"],
            last_reviewed_at=source["lastReviewedAt"],
        )
        for source in registry.source_references(policy)
    ]


def _unique(strings: Iterable[str]) -> List[str]:
    return list(dict.fromkeys(value for value in strings if value))


def _input_completeness(
    household: HouseholdInput,
) -> Literal["complete", "estimated", "incomplete"]:
    if any(person.data_quality == "unknown" for person in household.adults):
        return "incomplete"
    if any(person.disability_band == "unknown" for person in household.adults):
        return "incomplete"
    if any(dependant.disability_band == "unknown" for dependant in household.dependants):
        return "incomplete"
    if any(dependant.dependent_for_tax_purposes == "unknown" for dependant in household.dependants):
        return "incomplete"
    if any(benefit.tax_treatment == "unknown" for benefit in household.household_benefits):
        return "incomplete"
    if any(benefit.data_quality == "unknown" for benefit in household.household_benefits):
        return "incomplete"
    if any(
        person.social_security_category == "unknown"
        and (person.annual_gross_employment_income > 0 or person.annual_self_employment_net_income > 0)
        for person in household.adults
    ):
        return "incomplete"
    if any(person.data_quality == "estimated" for person in household.adults):
        return "estimated"
    if any(benefit.data_quality == "estimated" for benefit in household.household_benefits):
        return "estimated"
    if household.broad_capital_income.values_are_estimated:
        return "estimated"
    return "complete"


def _validate_territory(household: HouseholdInput) -> None:
    code = household.residence.autonomous_community_code
    regime = household.residence.fiscal_regime
    if code == "15" or regime == "foral_navarre":
        raise DomainError(
            "unsupported_territory",
            "Navarra aún no está soportada con fidelidad a su normativa foral.",
        )
    if code == "16" or regime == "foral_basque":
        raise DomainError(
            "unsupported_territory",
            "El País Vasco aún no está soportado con fidelidad a su normativa foral.",
        )
    if code in {"18", "19"}:
        raise DomainError(
            "unsupported_territory",
            "Ceuta y Melilla no se calculan hasta validar su tratamiento fiscal especial.",
        )
    if regime != "common":
        raise DomainError(
            "unsupported_territory",
            "No se puede determinar un régimen fiscal común compatible con la residencia indicada.",
        )
    if code not in {
        "01",
        "02",
        "03",
        "04",
        "05",
        "06",
        "07",
        "08",
        "09",
        "10",
        "11",
        "12",
        "13",
        "14",
        "17",
    }:
        raise DomainError("unsupported_territory", "El territorio indicado no está soportado.")


class FiscalEngine:
    def __init__(self, registry: PolicyRegistry, settings: Settings):
        self.registry = registry
        self.settings = settings

    def compare(self, request: ComparisonRequest, request_id: str) -> SimulationComparison:
        _validate_territory(request.household)
        if request.tax_year != self.registry.baseline.tax_year:
            raise DomainError("invalid_tax_year", "El año fiscal solicitado no está disponible.")

        requested_ids = list(request.scenario_ids)
        baseline_id = self.registry.baseline.id
        if baseline_id not in requested_ids:
            requested_ids.insert(0, baseline_id)
        else:
            requested_ids.remove(baseline_id)
            requested_ids.insert(0, baseline_id)
        if len(requested_ids) > 4:
            raise DomainError(
                "invalid_scenario",
                "Puede comparar la referencia con un máximo de tres escenarios.",
            )

        policies: List[PolicyEntry] = []
        for scenario_id in requested_ids:
            try:
                policy = self.registry.get_policy(scenario_id)
            except KeyError as exc:
                raise DomainError("invalid_scenario", "Uno de los escenarios seleccionados no existe.") from exc
            if policy.tax_year != request.tax_year:
                raise DomainError(
                    "scenario_not_compatible",
                    "Uno de los escenarios no es compatible con el año fiscal solicitado.",
                )
            if request.household.residence.autonomous_community_code not in policy.raw["territorialScope"]:
                raise DomainError(
                    "scenario_not_compatible",
                    "Uno de los escenarios no cubre la comunidad autónoma seleccionada.",
                )
            policies.append(policy)

        raw_results: List[Tuple[PolicyEntry, RawScenarioCalculation]] = []
        for policy in policies:
            parameters = self.registry.resolve_parameters(policy.id)
            raw_results.append((policy, calculate_raw_scenario(request.household, parameters, policy)))
        baseline_annual = raw_results[0][1].annual

        scenario_results: List[ScenarioResult] = []
        for policy, raw in raw_results:
            change = _changes(raw.annual, baseline_annual)
            trace = raw.trace if request.include_trace and self.settings.traces_enabled else None
            scenario_results.append(
                ScenarioResult(
                    scenario_id=policy.id,
                    scenario_name=str(policy.raw["publicName"]),
                    scenario_status=str(policy.raw["status"]),
                    policy_version=str(policy.raw["policyVersion"]),
                    validation_status=str(policy.raw["validationStatus"]),
                    filing_mode_applied=raw.filing_mode,
                    annual=raw.annual,
                    monthly_equivalent=MonthlyEquivalent(
                        estimated_disposable_income=_signed_monthly(raw.annual.estimated_disposable_income),
                        change_from_baseline=_signed_monthly(change.total_disposable_income),
                    ),
                    change_from_baseline=change,
                    explanation_items=_explanations(change),
                    assumptions=raw.assumptions,
                    warnings=raw.warnings,
                    uncertainty=Uncertainty(level="high", reasons=raw.uncertainty_reasons),
                    source_references=_source_models(self.registry, policy),
                    calculation_trace=trace,
                )
            )

        provenance_by_id: Dict[str, SourceReference] = {}
        for scenario in scenario_results:
            for source in scenario.source_references:
                provenance_by_id[source.id] = source

        global_warnings = [
            "Este simulador ofrece una estimación informativa. No es una declaración de "
            "impuestos, asesoramiento legal ni un cálculo oficial de una autoridad pública.",
            "La referencia 2027 arrastra parámetros revisados de 2025 y 2026; la "
            "legislación 2027 todavía debe validarse.",
            "Los datos fiscales personales se procesan en memoria y no se almacenan.",
        ]
        if request.include_trace and not self.settings.traces_enabled:
            global_warnings.append("La traza de cálculo está desactivada en producción.")
        if any(policy.is_synthetic for policy in policies):
            global_warnings.append("Los escenarios marcados DEMO son sintéticos y no representan propuestas oficiales.")

        return SimulationComparison(
            request_id=request_id,
            tax_year=request.tax_year,
            model_version=self.settings.model_version,
            calculation_timestamp=datetime.now(timezone.utc),
            input_completeness=_input_completeness(request.household),
            territorial_support=(
                "partial" if request.household.residence.autonomous_community_code == "05" else "supported"
            ),
            baseline_scenario_id=baseline_id,
            scenario_results=scenario_results,
            global_warnings=global_warnings,
            provenance=list(provenance_by_id.values()),
        )


def _signed_monthly(amount: int) -> int:
    if amount >= 0:
        return _round_ratio_half_up(amount, 1, 12)
    return -_round_ratio_half_up(-amount, 1, 12)
