"""Local high-throughput calculation hooks for studies and surrogate training.

This module is intentionally not an HTTP endpoint: large studies should run as offline,
versioned jobs and must not turn the public API into a personal-data collection surface.
"""

from __future__ import annotations

from collections.abc import Iterable, Iterator, Mapping, Sequence
from dataclasses import dataclass
from time import perf_counter
from typing import Any, Dict, List

from .engine import calculate_raw_scenario
from .models import AnnualBreakdown, HouseholdInput
from .registry import PolicyRegistry


@dataclass(frozen=True)
class BatchCase:
    case_id: str
    household: HouseholdInput


@dataclass(frozen=True)
class BatchResult:
    case_id: str
    policy_id: str
    annual: AnnualBreakdown
    filing_mode: str


def progressive_tax_many(amounts_cents: Sequence[int], scale: Sequence[Mapping[str, int]]) -> List[int]:
    """Band-major integer kernel that avoids per-case function dispatch.

    The output order matches the input. Rounding is half-up per statutory band, exactly
    like the scalar engine.
    """

    results = [0] * len(amounts_cents)
    for bracket_index, bracket in enumerate(scale):
        lower = int(bracket["thresholdCents"])
        upper = int(scale[bracket_index + 1]["thresholdCents"]) if bracket_index + 1 < len(scale) else None
        rate = int(bracket["rateBasisPoints"])
        for case_index, amount in enumerate(amounts_cents):
            if amount <= lower:
                continue
            taxable_slice = amount - lower if upper is None else min(amount, upper) - lower
            if taxable_slice > 0:
                results[case_index] += (taxable_slice * rate + 5_000) // 10_000
    return results


def calculate_batch(
    cases: Iterable[BatchCase],
    policy_ids: Sequence[str],
    registry: PolicyRegistry,
) -> Iterator[BatchResult]:
    """Stream deterministic results without request IDs, timestamps, logging, or storage.

    Callers should chunk this iterator across worker processes for multi-million-case
    studies. Inputs are already validated ``HouseholdInput`` objects so Pydantic parsing is
    not repeated inside the policy loop.
    """

    resolved = [(registry.get_policy(policy_id), registry.resolve_parameters(policy_id)) for policy_id in policy_ids]
    for case in cases:
        for policy, parameters in resolved:
            raw = calculate_raw_scenario(case.household, parameters, policy)
            yield BatchResult(
                case_id=case.case_id,
                policy_id=policy.id,
                annual=raw.annual,
                filing_mode=raw.filing_mode,
            )


def benchmark_batch(
    cases: Iterable[BatchCase],
    policy_ids: Sequence[str],
    registry: PolicyRegistry,
) -> Dict[str, Any]:
    """Return coarse throughput only; never include case inputs or fiscal outputs."""

    started = perf_counter()
    calculation_count = sum(1 for _ in calculate_batch(cases, policy_ids, registry))
    elapsed_seconds = perf_counter() - started
    return {
        "calculationCount": calculation_count,
        "elapsedSeconds": elapsed_seconds,
        "calculationsPerSecond": (calculation_count / elapsed_seconds if elapsed_seconds else None),
        "policyCount": len(policy_ids),
        "containsPersonalInputs": False,
        "containsFiscalOutputs": False,
    }
