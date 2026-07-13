"""Typed validation boundaries for external fiscal reference systems.

These interfaces deliberately do not scrape public simulators or bundle restricted
microdata. Implementations can be added when access, licensing, and aligned definitions
have been documented.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass
from typing import Any, Protocol


@dataclass(frozen=True)
class GoldenHouseholdCase:
    case_id: str
    tax_year: int
    territory_code: str
    input_payload: Mapping[str, Any]
    expected_intermediates_cents: Mapping[str, int]
    expected_final_irpf_cents: int
    source_reference: str
    checked_at: str
    reviewer: str
    tolerance_cents: int
    known_differences: Sequence[str]


class RentaWebManualReferenceAdapter(Protocol):
    """Read manually reviewed cases; automation of Renta Web is out of scope."""

    def cases(self, tax_year: int) -> Iterable[GoldenHouseholdCase]: ...


@dataclass(frozen=True)
class AggregateBenchmark:
    benchmark_id: str
    source_system: str
    period: str
    definition: str
    observed_value: int
    modelled_value: int
    absolute_tolerance: int
    coverage_notes: Sequence[str]


class EuromodAggregateBenchmarkAdapter(Protocol):
    """Boundary for licensed/aligned EUROMOD aggregate outputs, never raw user inputs."""

    def benchmarks(self, policy_system: str) -> Iterable[AggregateBenchmark]: ...


class OfficialAggregateBenchmarkAdapter(Protocol):
    """Boundary for AEAT, INE, and Social Security aggregate validation tables."""

    def benchmarks(self, tax_year: int) -> Iterable[AggregateBenchmark]: ...


class OpenFiscaMigrationBridge(Protocol):
    """Compatibility boundary for a future reviewed OpenFisca implementation."""

    def calculate_named_variables(
        self,
        *,
        tax_year: int,
        policy_id: str,
        household: Mapping[str, Any],
        variable_names: Sequence[str],
    ) -> Mapping[str, int]: ...
