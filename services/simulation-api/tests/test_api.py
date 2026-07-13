from __future__ import annotations

import json
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace

from fastapi.testclient import TestClient

from app.main import create_app
from app.registry import PolicyRegistry
from tests.helpers import BASELINE_ID, DEMO_CHILD_ID, DEMO_TAX_ID, valid_payload


def test_health_and_model_endpoints(api_client):
    health = api_client.get("/api/v1/health")
    assert health.status_code == 200
    assert health.json()["dataRetention"] == "not_stored"
    model = api_client.get("/api/v1/model")
    assert model.status_code == 200
    assert model.json()["arithmetic"] == "integer_euro_cents_no_llm"
    assert model.json()["inventory"]["counts"]["namedVariables"] > 0
    ready = api_client.get("/api/v1/ready")
    assert ready.status_code == 200
    assert ready.json()["status"] == "ready"
    assert ready.json()["personalDataChecked"] is False


def test_scenario_directory_and_detail_are_public(api_client):
    response = api_client.get("/api/v1/scenarios")
    assert response.status_code == 200
    scenarios = response.json()["scenarios"]
    assert {scenario["id"] for scenario in scenarios} == {
        BASELINE_ID,
        DEMO_CHILD_ID,
        DEMO_TAX_ID,
    }
    detail = api_client.get(f"/api/v1/scenarios/{DEMO_CHILD_ID}")
    assert detail.status_code == 200
    assert detail.json()["publicName"].startswith("DEMO —")
    assert detail.json()["sourceReferences"]
    assert detail.json()["methodologyMarkdown"].startswith("# DEMO")


def test_compare_contract_returns_annual_monthly_and_provenance(api_client):
    payload = valid_payload(scenarioIds=[BASELINE_ID, DEMO_TAX_ID, DEMO_CHILD_ID], includeTrace=True)
    response = api_client.post("/api/v1/simulations/compare", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert body["requestId"] == response.headers["x-request-id"]
    assert body["dataRetention"] == "not_stored"
    assert body["territorialSupport"] == "supported"
    assert len(body["scenarioResults"]) == 3
    assert body["scenarioResults"][0]["monthlyEquivalent"]["estimatedDisposableIncome"]
    assert body["scenarioResults"][0]["calculationTrace"]
    assert body["provenance"]
    assert response.headers["cache-control"] == "no-store"


def test_unknown_scenario_has_safe_error_contract(api_client):
    response = api_client.post(
        "/api/v1/simulations/compare",
        json=valid_payload(scenarioIds=["does-not-exist"]),
    )
    assert response.status_code == 422
    assert response.json()["code"] == "invalid_scenario"
    assert "traceback" not in response.text.casefold()


def test_invalid_year_has_specific_error_contract(api_client):
    response = api_client.post("/api/v1/simulations/compare", json=valid_payload(taxYear=2026))
    assert response.status_code == 422
    assert response.json()["code"] == "invalid_tax_year"


def test_unsupported_foral_territory_has_safe_error(api_client):
    response = api_client.post(
        "/api/v1/simulations/compare",
        json=valid_payload(
            household={
                "residence": {
                    "autonomousCommunityCode": "15",
                    "fiscalRegime": "foral_navarre",
                }
            }
        ),
    )
    assert response.status_code == 422
    assert response.json()["code"] == "unsupported_territory"
    assert "foral" in response.json()["message"].casefold()


def test_schema_error_does_not_echo_fiscal_value(api_client):
    secret_salary = 9_876_543_210
    response = api_client.post(
        "/api/v1/simulations/compare",
        json=valid_payload(household={"adults": [{"annualGrossEmploymentIncome": secret_salary, "monthsWorked": -1}]}),
    )
    assert response.status_code == 422
    assert response.json()["code"] == "incomplete_household"
    assert str(secret_salary) not in response.text
    assert all(set(detail) == {"field", "type"} for detail in response.json()["details"])


def test_access_log_does_not_contain_request_body(api_client, caplog):
    caplog.set_level("INFO", logger="cifra_civica.access")
    private_amount = 3_141_592
    response = api_client.post(
        "/api/v1/simulations/compare",
        json=valid_payload(household={"adults": [{"annualGrossEmploymentIncome": private_amount}]}),
    )
    assert response.status_code == 200
    messages = " ".join(record.getMessage() for record in caplog.records)
    assert str(private_amount) not in messages
    assert "annualGrossEmploymentIncome" not in messages
    assert "http_request_completed" in messages


def test_request_size_limit_rejects_body_before_validation(settings, registry):
    tiny_settings = replace(settings, max_request_bytes=100)
    with TestClient(create_app(settings=tiny_settings, registry=registry)) as client:
        response = client.post(
            "/api/v1/simulations/compare",
            content=json.dumps(valid_payload()),
            headers={"content-type": "application/json"},
        )
    assert response.status_code == 413
    assert response.json()["code"] == "incomplete_household"


def test_personal_calculation_is_not_accepted_via_get(api_client):
    response = api_client.get("/api/v1/simulations/compare")
    assert response.status_code == 405


def test_geography_and_metric_metadata_endpoints(api_client):
    search = api_client.get("/api/v1/geographies/search", params={"q": "Madrid"})
    assert search.status_code == 200
    assert search.json()["results"][0]["code"] == "13"
    navarre = api_client.get("/api/v1/geographies/15")
    assert navarre.json()["calculationSupport"] == "unsupported"
    metrics = api_client.get("/api/v1/map/metrics")
    assert {metric["dataClass"] for metric in metrics.json()["metrics"]} == {
        "official",
        "synthetic_demo",
    }
    metadata = api_client.get("/api/v1/map/metrics/demo-disposable-impact/metadata")
    assert metadata.json()["availability"] == "metadata_only"


def test_canaries_returns_partial_direct_tax_support(api_client):
    response = api_client.post(
        "/api/v1/simulations/compare",
        json=valid_payload(household={"residence": {"autonomousCommunityCode": "05"}}),
    )
    assert response.status_code == 200
    assert response.json()["territorialSupport"] == "partial"
    assert any("IGIC" in warning for warning in response.json()["scenarioResults"][0]["warnings"])


def test_concurrent_calculations_are_isolated(api_client):
    amounts = [2_000_000, 2_500_000, 3_000_000, 3_500_000, 4_000_000]

    def calculate(amount):
        response = api_client.post(
            "/api/v1/simulations/compare",
            json=valid_payload(household={"adults": [{"annualGrossEmploymentIncome": amount}]}),
        )
        assert response.status_code == 200
        return response.json()

    with ThreadPoolExecutor(max_workers=5) as pool:
        results = list(pool.map(calculate, amounts))
    assert len({result["requestId"] for result in results}) == len(amounts)
    assert [result["scenarioResults"][0]["annual"]["grossHouseholdIncome"] for result in results] == amounts


def test_production_hides_synthetic_scenarios_and_trace(settings):
    production_settings = replace(
        settings,
        app_environment="production",
        enable_synthetic_scenarios=False,
        allow_synthetic_in_production=False,
    )
    production_registry = PolicyRegistry(production_settings)
    with TestClient(create_app(settings=production_settings, registry=production_registry)) as client:
        scenarios = client.get("/api/v1/scenarios").json()["scenarios"]
        response = client.post(
            "/api/v1/simulations/compare",
            json=valid_payload(scenarioIds=[BASELINE_ID], includeTrace=True),
        )
    assert [scenario["id"] for scenario in scenarios] == [BASELINE_ID]
    assert response.status_code == 200
    assert response.json()["scenarioResults"][0]["calculationTrace"] is None


def test_trace_can_be_disabled_outside_production(settings, registry):
    trace_disabled_settings = replace(settings, enable_calculation_trace=False)
    with TestClient(create_app(settings=trace_disabled_settings, registry=registry)) as client:
        response = client.post(
            "/api/v1/simulations/compare",
            json=valid_payload(scenarioIds=[BASELINE_ID], includeTrace=True),
        )
    assert response.status_code == 200
    assert response.json()["scenarioResults"][0]["calculationTrace"] is None


def test_calculation_timeout_returns_safe_error(settings, registry):
    timeout_settings = replace(settings, calculation_timeout_seconds=0.001)
    application = create_app(settings=timeout_settings, registry=registry)
    original_compare = application.state.engine.compare

    def slow_compare(*args, **kwargs):
        time.sleep(0.02)
        return original_compare(*args, **kwargs)

    application.state.engine.compare = slow_compare
    with TestClient(application) as client:
        response = client.post(
            "/api/v1/simulations/compare",
            json=valid_payload(scenarioIds=[BASELINE_ID]),
        )
    assert response.status_code == 503
    assert response.json()["code"] == "calculation_timeout"
    assert "traceback" not in response.text.casefold()


def test_cors_allows_configured_origin_and_rejects_other_origin(api_client):
    allowed = api_client.options(
        "/api/v1/simulations/compare",
        headers={
            "origin": "http://localhost:3000",
            "access-control-request-method": "POST",
            "access-control-request-headers": "content-type",
        },
    )
    assert allowed.status_code == 200
    assert allowed.headers["access-control-allow-origin"] == "http://localhost:3000"
    rejected = api_client.options(
        "/api/v1/simulations/compare",
        headers={
            "origin": "https://untrusted.example",
            "access-control-request-method": "POST",
        },
    )
    assert "access-control-allow-origin" not in rejected.headers
