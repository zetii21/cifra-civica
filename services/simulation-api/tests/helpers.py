from __future__ import annotations

import copy
from typing import Any, Dict

BASELINE_ID = "baseline-2027-common-reference"
DEMO_TAX_ID = "demo-family-tax-relief-2027"
DEMO_CHILD_ID = "demo-child-transfer-2027"


def deep_update(target: Dict[str, Any], override: Dict[str, Any]) -> Dict[str, Any]:
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(target.get(key), dict):
            deep_update(target[key], value)
        elif isinstance(value, list) and isinstance(target.get(key), list):
            merged: list[Any] = []
            for index, item in enumerate(value):
                if index < len(target[key]) and isinstance(item, dict) and isinstance(target[key][index], dict):
                    base_item = copy.deepcopy(target[key][index])
                    deep_update(base_item, item)
                    merged.append(base_item)
                else:
                    merged.append(copy.deepcopy(item))
            target[key] = merged
        else:
            target[key] = value
    return target


def valid_payload(**overrides: Any) -> Dict[str, Any]:
    payload: Dict[str, Any] = {
        "taxYear": 2027,
        "locale": "es-ES",
        "household": {
            "residence": {
                "autonomousCommunityCode": "13",
                "municipalityCode": None,
                "fiscalRegime": "common",
            },
            "filingPreference": "calculate_best",
            "maritalStatus": "single",
            "singleParentHousehold": False,
            "adults": [
                {
                    "id": "11111111-1111-4111-8111-111111111111",
                    "age": 40,
                    "relationshipToHousehold": "primary",
                    "employmentStatus": "employee",
                    "annualGrossEmploymentIncome": 3_000_000,
                    "annualSelfEmploymentNetIncome": 0,
                    "annualUnemploymentBenefits": 0,
                    "annualPensionIncome": 0,
                    "annualOtherTaxableBenefits": 0,
                    "annualExemptIncome": 0,
                    "disabilityBand": "none",
                    "socialSecurityCategory": "general_employee",
                    "monthsWorked": 12,
                    "multipleJobs": False,
                    "contributionBaseOverride": None,
                    "dataQuality": "exact",
                }
            ],
            "dependants": [],
            "housing": {},
            "householdBenefits": [],
            "broadCapitalIncome": {},
            "userConfirmedAssumptions": [],
        },
        "scenarioIds": [BASELINE_ID],
        "includeTrace": False,
    }
    return deep_update(copy.deepcopy(payload), overrides)
