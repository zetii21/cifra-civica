from __future__ import annotations

from app.models import ComparisonRequest
from tests.helpers import BASELINE_ID, DEMO_CHILD_ID, DEMO_TAX_ID, valid_payload


def test_scenario_inheritance_only_changes_overridden_parameters(registry):
    baseline = registry.resolve_parameters(BASELINE_ID)
    tax_demo = registry.resolve_parameters(DEMO_TAX_ID)
    child_demo = registry.resolve_parameters(DEMO_CHILD_ID)
    assert tax_demo["socialSecurity"] == baseline["socialSecurity"]
    assert tax_demo["irpf"]["stateGeneralRateDeltaBasisPoints"] == -100
    assert child_demo["irpf"] == baseline["irpf"]
    assert child_demo["benefits"]["annualPerEligibleDescendantCents"] == 120_000


def test_tax_demo_reduces_only_state_tax(engine):
    payload = valid_payload(scenarioIds=[BASELINE_ID, DEMO_TAX_ID])
    result = engine.compare(ComparisonRequest.model_validate(payload), "scenario-tax")
    baseline, demo = result.scenario_results
    assert demo.annual.state_irpf_before_credits < baseline.annual.state_irpf_before_credits
    assert demo.annual.autonomous_irpf_before_credits == baseline.annual.autonomous_irpf_before_credits
    assert demo.annual.social_security_contributions == baseline.annual.social_security_contributions
    assert demo.change_from_baseline.total_disposable_income == -demo.change_from_baseline.state_irpf


def test_child_demo_adds_exact_transfer_for_eligible_descendant(engine):
    payload = valid_payload(
        household={
            "dependants": [
                {
                    "id": "33333333-3333-4333-8333-333333333333",
                    "age": 8,
                    "relationship": "child",
                    "disabilityBand": "none",
                    "sharedCustody": False,
                    "dependentForTaxPurposes": True,
                }
            ]
        },
        scenarioIds=[BASELINE_ID, DEMO_CHILD_ID],
    )
    result = engine.compare(ComparisonRequest.model_validate(payload), "scenario-child")
    baseline, demo = result.scenario_results
    assert demo.annual.cash_benefits - baseline.annual.cash_benefits == 120_000
    assert demo.change_from_baseline.total_disposable_income == 120_000
    assert demo.scenario_name.startswith("DEMO —")


def test_child_demo_excludes_unknown_tax_dependent(engine):
    payload = valid_payload(
        household={
            "dependants": [
                {
                    "id": "33333333-3333-4333-8333-333333333333",
                    "age": 8,
                    "relationship": "child",
                    "disabilityBand": "unknown",
                    "sharedCustody": False,
                    "dependentForTaxPurposes": "unknown",
                }
            ]
        },
        scenarioIds=[BASELINE_ID, DEMO_CHILD_ID],
    )
    result = engine.compare(ComparisonRequest.model_validate(payload), "scenario-unknown")
    assert result.scenario_results[1].change_from_baseline.benefits == 0
    assert result.input_completeness == "incomplete"


def test_component_change_reconciles_to_disposable_change(engine):
    payload = valid_payload(
        household={
            "dependants": [
                {
                    "id": "33333333-3333-4333-8333-333333333333",
                    "age": 4,
                    "relationship": "child",
                    "disabilityBand": "none",
                    "sharedCustody": False,
                    "dependentForTaxPurposes": True,
                }
            ]
        },
        scenarioIds=[BASELINE_ID, DEMO_TAX_ID, DEMO_CHILD_ID],
    )
    result = engine.compare(ComparisonRequest.model_validate(payload), "reconcile")
    for scenario in result.scenario_results:
        change = scenario.change_from_baseline
        expected = (
            change.gross_income
            + change.benefits
            - change.social_security_contributions
            - change.state_irpf
            - change.autonomous_irpf
        )
        assert change.total_disposable_income == expected


def test_same_input_produces_same_numerical_results(engine, comparison_request):
    first = engine.compare(comparison_request, "request-one")
    second = engine.compare(comparison_request, "request-two")
    assert [item.annual for item in first.scenario_results] == [item.annual for item in second.scenario_results]
    assert first.request_id != second.request_id
