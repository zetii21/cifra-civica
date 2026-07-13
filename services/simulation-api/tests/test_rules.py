from __future__ import annotations

from copy import deepcopy

import pytest

from app.engine import (
    DomainError,
    _employee_contribution,
    _minimum_config,
    _self_employed_contribution,
    calculate_contributions,
    calculate_raw_scenario,
    calculate_tax,
    progressive_tax,
)
from app.models import ComparisonRequest
from tests.helpers import valid_payload


def test_state_general_scale_boundaries_are_exact(registry):
    parameters = registry.resolve_parameters(registry.baseline.id)
    scale = parameters["irpf"]["stateGeneralScale"]
    assert progressive_tax(0, scale) == 0
    assert progressive_tax(1_245_000, scale) == 118_275
    assert progressive_tax(2_020_000, scale) == 211_275
    assert progressive_tax(3_520_000, scale) == 436_275


def test_savings_scale_boundaries_are_exact(registry):
    scale = registry.resolve_parameters(registry.baseline.id)["irpf"]["stateSavingsScale"]
    assert progressive_tax(600_000, scale) == 57_000
    assert progressive_tax(5_000_000, scale) == 519_000
    assert progressive_tax(20_000_000, scale) == 2_244_000


def test_all_common_regime_autonomous_scales_start_at_zero(registry):
    scales = registry.resolve_parameters(registry.baseline.id)["irpf"]["autonomousGeneralScales"]
    assert len(scales) == 15
    for scale in scales.values():
        assert scale[0]["thresholdCents"] == 0
        assert progressive_tax(1, scale) >= 0


def test_madrid_autonomous_minimum_uses_official_compendium_value(registry):
    parameters = registry.resolve_parameters(registry.baseline.id)
    assert _minimum_config(parameters, "13")["taxpayerCents"] == 595_665
    assert _minimum_config(parameters, "__state__")["taxpayerCents"] == 555_000


def test_employee_contribution_below_cap_is_six_point_five_percent(registry):
    request = ComparisonRequest.model_validate(valid_payload())
    person = request.household.adults[0]
    parameters = registry.resolve_parameters(registry.baseline.id)
    amount, assumptions, warnings = _employee_contribution(person, parameters)
    assert amount == 195_000
    assert assumptions
    assert any("bases mínimas" in warning for warning in warnings)


def test_employee_contribution_applies_cap_and_solidarity(registry):
    payload = valid_payload(household={"adults": [{"annualGrossEmploymentIncome": 10_000_000}]})
    person = ComparisonRequest.model_validate(payload).household.adults[0]
    parameters = registry.resolve_parameters(registry.baseline.id)
    amount, _, _ = _employee_contribution(person, parameters)
    assert amount == 406_162


def test_work_reduction_threshold_uses_net_before_standard_expense(engine):
    payload = valid_payload(household={"adults": [{"annualGrossEmploymentIncome": 1_800_000}]})
    result = engine.compare(ComparisonRequest.model_validate(payload), "work-reduction")
    assert result.scenario_results[0].annual.general_tax_base == 1_098_950


def test_self_employed_uses_minimum_base_of_income_band(registry):
    payload = valid_payload(
        household={
            "adults": [
                {
                    "employmentStatus": "self_employed",
                    "annualGrossEmploymentIncome": 0,
                    "annualSelfEmploymentNetIncome": 1_200_000,
                    "socialSecurityCategory": "self_employed",
                }
            ]
        }
    )
    person = ComparisonRequest.model_validate(payload).household.adults[0]
    parameters = registry.resolve_parameters(registry.baseline.id)
    amount, assumptions, warnings = _self_employed_contribution(person, parameters)
    assert amount == 321_175
    assert any("base mínima" in assumption for assumption in assumptions)
    assert warnings


def test_self_employed_override_is_clamped_to_statutory_band(registry):
    payload = valid_payload(
        household={
            "adults": [
                {
                    "employmentStatus": "self_employed",
                    "annualGrossEmploymentIncome": 0,
                    "annualSelfEmploymentNetIncome": 1_200_000,
                    "socialSecurityCategory": "self_employed",
                    "contributionBaseOverride": 1,
                }
            ]
        }
    )
    person = ComparisonRequest.model_validate(payload).household.adults[0]
    parameters = registry.resolve_parameters(registry.baseline.id)
    amount, assumptions, warnings = _self_employed_contribution(person, parameters)
    assert amount == 321_175
    assert any("intervalo" in assumption for assumption in assumptions)
    assert any("ajustó" in warning for warning in warnings)


def test_low_self_employment_income_can_report_negative_disposable_without_crashing(
    engine,
):
    payload = valid_payload(
        household={
            "adults": [
                {
                    "employmentStatus": "self_employed",
                    "annualGrossEmploymentIncome": 0,
                    "annualSelfEmploymentNetIncome": 1,
                    "socialSecurityCategory": "self_employed",
                }
            ]
        }
    )
    result = engine.compare(ComparisonRequest.model_validate(payload), "low-reta")
    scenario = result.scenario_results[0]
    assert scenario.annual.estimated_disposable_income < 0
    assert scenario.monthly_equivalent.estimated_disposable_income < 0


def test_zero_income_has_zero_tax_and_contributions(engine):
    payload = valid_payload(
        household={
            "adults": [
                {
                    "employmentStatus": "inactive",
                    "annualGrossEmploymentIncome": 0,
                    "monthsWorked": 0,
                    "socialSecurityCategory": "unknown",
                }
            ]
        }
    )
    result = engine.compare(ComparisonRequest.model_validate(payload), "test-request")
    annual = result.scenario_results[0].annual
    assert annual.final_irpf == 0
    assert annual.social_security_contributions == 0
    assert annual.estimated_disposable_income == 0


def test_forced_joint_filing_applies_married_reduction(registry):
    payload = valid_payload(
        household={
            "filingPreference": "joint",
            "maritalStatus": "married",
            "adults": [
                {},
                {
                    "id": "22222222-2222-4222-8222-222222222222",
                    "age": 39,
                    "relationshipToHousehold": "spouse_partner",
                    "employmentStatus": "inactive",
                    "annualGrossEmploymentIncome": 0,
                    "disabilityBand": "none",
                    "socialSecurityCategory": "unknown",
                    "monthsWorked": 0,
                    "multipleJobs": False,
                    "dataQuality": "exact",
                },
            ],
        }
    )
    request = ComparisonRequest.model_validate(payload)
    parameters = registry.resolve_parameters(registry.baseline.id)
    contributions = calculate_contributions(request.household, parameters)
    tax = calculate_tax(request.household, parameters, contributions)
    assert tax.filing_mode == "joint"
    assert tax.joint_reduction_cents == 340_000


def test_joint_work_expense_and_reduction_are_applied_once_per_family_unit(registry):
    payload = valid_payload(
        household={
            "filingPreference": "joint",
            "maritalStatus": "married",
            "adults": [
                {"annualGrossEmploymentIncome": 1_500_000},
                {
                    "id": "22222222-2222-4222-8222-222222222222",
                    "age": 39,
                    "relationshipToHousehold": "spouse_partner",
                    "employmentStatus": "employee",
                    "annualGrossEmploymentIncome": 1_500_000,
                    "disabilityBand": "none",
                    "socialSecurityCategory": "general_employee",
                    "monthsWorked": 12,
                    "multipleJobs": False,
                    "dataQuality": "exact",
                },
            ],
        }
    )
    request = ComparisonRequest.model_validate(payload)
    parameters = registry.resolve_parameters(registry.baseline.id)
    contributions = calculate_contributions(request.household, parameters)
    tax = calculate_tax(request.household, parameters, contributions)
    assert contributions.total_cents == 195_000
    assert tax.general_base_cents == 2_605_000
    assert tax.state_irpf_cents + tax.autonomous_irpf_cents > 0


def test_joint_reduction_remainder_reduces_savings_base(registry):
    payload = valid_payload(
        household={
            "filingPreference": "joint",
            "maritalStatus": "married",
            "adults": [
                {
                    "employmentStatus": "inactive",
                    "annualGrossEmploymentIncome": 0,
                    "monthsWorked": 0,
                    "socialSecurityCategory": "unknown",
                },
                {
                    "id": "22222222-2222-4222-8222-222222222222",
                    "age": 39,
                    "relationshipToHousehold": "spouse_partner",
                    "employmentStatus": "inactive",
                    "annualGrossEmploymentIncome": 0,
                    "disabilityBand": "none",
                    "socialSecurityCategory": "unknown",
                    "monthsWorked": 0,
                    "multipleJobs": False,
                    "dataQuality": "exact",
                },
            ],
            "broadCapitalIncome": {"annualInterest": 1_000_000},
        }
    )
    request = ComparisonRequest.model_validate(payload)
    parameters = registry.resolve_parameters(registry.baseline.id)
    contributions = calculate_contributions(request.household, parameters)
    tax = calculate_tax(request.household, parameters, contributions)
    assert tax.general_base_cents == 0
    assert tax.savings_base_cents == 1_000_000
    assert tax.joint_reduction_cents == 340_000


def test_single_parent_joint_filing_rejects_ascendant_only(engine):
    payload = valid_payload(
        household={
            "filingPreference": "joint",
            "maritalStatus": "single",
            "singleParentHousehold": True,
            "dependants": [
                {
                    "id": "33333333-3333-4333-8333-333333333333",
                    "age": 70,
                    "relationship": "ascendant",
                    "disabilityBand": "none",
                    "sharedCustody": False,
                    "dependentForTaxPurposes": True,
                }
            ],
        }
    )
    with pytest.raises(DomainError, match="unidad familiar conjunta"):
        engine.compare(ComparisonRequest.model_validate(payload), "ascendant-joint")


def test_single_parent_minor_can_form_family_unit_without_tax_minimum(engine):
    payload = valid_payload(
        household={
            "filingPreference": "joint",
            "maritalStatus": "single",
            "singleParentHousehold": True,
            "dependants": [
                {
                    "id": "33333333-3333-4333-8333-333333333333",
                    "age": 8,
                    "relationship": "child",
                    "disabilityBand": "none",
                    "sharedCustody": False,
                    "dependentForTaxPurposes": False,
                }
            ],
        }
    )
    result = engine.compare(ComparisonRequest.model_validate(payload), "minor-joint")
    assert result.scenario_results[0].filing_mode_applied == "joint"
    assert result.scenario_results[0].annual.joint_filing_reduction == 215_000


def test_calculate_best_selects_no_more_tax_than_individual(engine):
    base = valid_payload(
        household={
            "maritalStatus": "married",
            "adults": [
                {},
                {
                    "id": "22222222-2222-4222-8222-222222222222",
                    "age": 39,
                    "relationshipToHousehold": "spouse_partner",
                    "employmentStatus": "inactive",
                    "annualGrossEmploymentIncome": 0,
                    "disabilityBand": "none",
                    "socialSecurityCategory": "unknown",
                    "monthsWorked": 0,
                    "multipleJobs": False,
                    "dataQuality": "exact",
                },
            ],
        }
    )
    best = engine.compare(ComparisonRequest.model_validate(base), "best")
    individual_payload = deepcopy(base)
    individual_payload["household"]["filingPreference"] = "individual"
    individual = engine.compare(ComparisonRequest.model_validate(individual_payload), "individual")
    assert best.scenario_results[0].annual.final_irpf <= individual.scenario_results[0].annual.final_irpf


def test_pension_and_unemployment_are_in_general_income(engine):
    payload = valid_payload(
        household={
            "adults": [
                {
                    "employmentStatus": "mixed",
                    "annualGrossEmploymentIncome": 0,
                    "annualPensionIncome": 1_800_000,
                    "annualUnemploymentBenefits": 600_000,
                    "monthsWorked": 0,
                    "socialSecurityCategory": "unknown",
                }
            ]
        }
    )
    result = engine.compare(ComparisonRequest.model_validate(payload), "benefits")
    annual = result.scenario_results[0].annual
    assert annual.pension_income == 1_800_000
    assert annual.general_tax_base > 0
    assert annual.gross_household_income == 2_400_000


def test_capital_losses_only_offset_current_savings(engine):
    payload = valid_payload(
        household={
            "broadCapitalIncome": {
                "annualInterest": 100_000,
                "annualDividends": 50_000,
                "annualCapitalGains": 200_000,
                "annualCapitalLosses": 300_000,
            }
        }
    )
    result = engine.compare(ComparisonRequest.model_validate(payload), "capital")
    assert result.scenario_results[0].annual.savings_tax_base == 112_500
    assert any("pérdidas" in text for text in result.scenario_results[0].assumptions)


def test_empty_parameter_override_reproduces_baseline(registry, comparison_request):
    policy = registry.baseline
    parameters = registry.resolve_parameters(policy.id)
    left = calculate_raw_scenario(comparison_request.household, parameters, policy)
    right = calculate_raw_scenario(comparison_request.household, deepcopy(parameters), policy)
    assert left.annual == right.annual
