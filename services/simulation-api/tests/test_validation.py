from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.engine import DomainError
from app.models import ComparisonRequest
from tests.helpers import valid_payload


def test_negative_income_is_rejected():
    with pytest.raises(ValidationError):
        ComparisonRequest.model_validate(valid_payload(household={"adults": [{"annualGrossEmploymentIncome": -1}]}))


def test_impossibly_large_income_is_rejected():
    with pytest.raises(ValidationError):
        ComparisonRequest.model_validate(
            valid_payload(household={"adults": [{"annualGrossEmploymentIncome": 10_000_000_001}]})
        )


def test_income_requires_nonzero_months_worked():
    with pytest.raises(ValidationError):
        ComparisonRequest.model_validate(valid_payload(household={"adults": [{"monthsWorked": 0}]}))


def test_zero_contribution_base_override_is_rejected():
    with pytest.raises(ValidationError):
        ComparisonRequest.model_validate(valid_payload(household={"adults": [{"contributionBaseOverride": 0}]}))


def test_person_ids_must_be_unique():
    adult = valid_payload()["household"]["adults"][0]
    with pytest.raises(ValidationError):
        ComparisonRequest.model_validate(valid_payload(household={"adults": [adult, adult]}))


@pytest.mark.parametrize(
    "code,regime",
    [
        ("15", "foral_navarre"),
        ("16", "foral_basque"),
        ("18", "common"),
        ("19", "common"),
    ],
)
def test_unsupported_territories_never_calculate(engine, code, regime):
    request = ComparisonRequest.model_validate(
        valid_payload(
            household={
                "residence": {
                    "autonomousCommunityCode": code,
                    "fiscalRegime": regime,
                }
            }
        )
    )
    with pytest.raises(DomainError) as captured:
        engine.compare(request, "unsupported")
    assert captured.value.code == "unsupported_territory"


def test_unknown_fiscal_regime_never_calculates(engine):
    request = ComparisonRequest.model_validate(valid_payload(household={"residence": {"fiscalRegime": "unknown"}}))
    with pytest.raises(DomainError) as captured:
        engine.compare(request, "unknown")
    assert captured.value.code == "unsupported_territory"


def test_invalid_tax_year_has_specific_domain_error(engine):
    request = ComparisonRequest.model_validate(valid_payload(taxYear=2026))
    with pytest.raises(DomainError) as captured:
        engine.compare(request, "year")
    assert captured.value.code == "invalid_tax_year"


def test_forced_joint_requires_eligible_family_unit(engine):
    request = ComparisonRequest.model_validate(valid_payload(household={"filingPreference": "joint"}))
    with pytest.raises(DomainError) as captured:
        engine.compare(request, "joint")
    assert captured.value.code == "incomplete_household"
