from __future__ import annotations

from app.batch import BatchCase, benchmark_batch, calculate_batch, progressive_tax_many
from app.engine import progressive_tax
from app.models import ComparisonRequest
from tests.helpers import BASELINE_ID, DEMO_TAX_ID, valid_payload


def test_batch_progressive_kernel_matches_scalar(registry):
    scale = registry.resolve_parameters(BASELINE_ID)["irpf"]["stateGeneralScale"]
    amounts = [0, 1, 1_245_000, 2_020_000, 3_520_001, 30_000_000, 100_000_000]
    assert progressive_tax_many(amounts, scale) == [progressive_tax(amount, scale) for amount in amounts]


def test_batch_stream_contract_matches_case_policy_product(registry):
    request = ComparisonRequest.model_validate(valid_payload())
    cases = [
        BatchCase(case_id="case-a", household=request.household),
        BatchCase(case_id="case-b", household=request.household),
    ]
    results = list(calculate_batch(cases, [BASELINE_ID, DEMO_TAX_ID], registry))
    assert len(results) == 4
    assert [(result.case_id, result.policy_id) for result in results] == [
        ("case-a", BASELINE_ID),
        ("case-a", DEMO_TAX_ID),
        ("case-b", BASELINE_ID),
        ("case-b", DEMO_TAX_ID),
    ]
    assert all(result.annual.estimated_disposable_income > 0 for result in results)


def test_batch_benchmark_emits_no_personal_or_fiscal_values(registry):
    request = ComparisonRequest.model_validate(valid_payload())
    metrics = benchmark_batch(
        [BatchCase(case_id="case-a", household=request.household)],
        [BASELINE_ID],
        registry,
    )
    assert metrics["calculationCount"] == 1
    assert metrics["containsPersonalInputs"] is False
    assert metrics["containsFiscalOutputs"] is False
    assert "annual" not in metrics
