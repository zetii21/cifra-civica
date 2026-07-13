from __future__ import annotations

from hypothesis import given
from hypothesis import settings as hypothesis_settings
from hypothesis import strategies as st

from app.engine import progressive_tax
from app.models import ComparisonRequest
from tests.helpers import BASELINE_ID, valid_payload


@given(st.integers(min_value=0, max_value=100_000_000))
def test_progressive_scale_never_returns_negative_or_noninteger(registry, amount):
    scale = registry.resolve_parameters(BASELINE_ID)["irpf"]["stateGeneralScale"]
    result = progressive_tax(amount, scale)
    assert isinstance(result, int)
    assert result >= 0


@given(st.integers(min_value=0, max_value=10_000_000))
@hypothesis_settings(max_examples=40)
def test_disposable_result_is_deterministic_for_income(engine, amount):
    months = 0 if amount == 0 else 12
    status = "inactive" if amount == 0 else "employee"
    category = "unknown" if amount == 0 else "general_employee"
    request = ComparisonRequest.model_validate(
        valid_payload(
            household={
                "adults": [
                    {
                        "annualGrossEmploymentIncome": amount,
                        "monthsWorked": months,
                        "employmentStatus": status,
                        "socialSecurityCategory": category,
                    }
                ]
            }
        )
    )
    first = engine.compare(request, "a").scenario_results[0].annual
    second = engine.compare(request, "b").scenario_results[0].annual
    assert first == second
    assert all(isinstance(value, int) for value in first.model_dump().values())


@given(st.sampled_from(["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "13", "14", "17"]))
def test_every_declared_common_territory_returns_no_misleading_unsupported_state(engine, code):
    request = ComparisonRequest.model_validate(
        valid_payload(household={"residence": {"autonomousCommunityCode": code}})
    )
    response = engine.compare(request, "territory")
    assert response.territorial_support in {"supported", "partial"}
