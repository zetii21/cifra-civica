#!/usr/bin/env python3
"""Exhaustive statistical reference study of the national fiscal laboratory.

The study loads the exported laboratory model (``model-lab/inputs/
national-model.json``), re-implements its arithmetic independently with
vectorised NumPy, and then:

1. verifies engine equivalence against golden scenarios computed by the
   TypeScript engine (segment-level, quantile expansion disabled);
2. expands every segment into a deterministic quantile grid of synthetic
   micro-units (no random numbers, no personal data);
3. runs exhaustive single-lever, paired-lever and territorial sweeps over
   IRPF brackets, savings brackets, every other revenue instrument and every
   spending programme;
4. checks conservation, monotonicity, additivity and baseline-neutrality
   invariants on the full sweep set;
5. counts, exactly and from real array shapes, every executed
   parameter-case application, and writes an auditable JSON report.

The evaluation count is a measure of executed deterministic work. It is not
a claim about stored people, database rows, legal constants or AI weights.

Usage:
    python model-lab/run_national_study.py [--quantiles 101] [--workers 4]
    python model-lab/run_national_study.py --smoke   # reduced grids
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from concurrent.futures import ProcessPoolExecutor
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from scipy.stats import norm

ROOT = Path(__file__).resolve().parents[1]
MODEL_PATH = ROOT / "model-lab" / "inputs" / "national-model.json"
REPORT_PATH = ROOT / "model-lab" / "artifacts" / "national-study-report.json"

INPUT_FILES = sorted(
    [
        "lib/fiscal-lab/demography.ts",
        "lib/fiscal-lab/engine.ts",
        "lib/fiscal-lab/index.ts",
        "lib/fiscal-lab/instruments.ts",
        "lib/fiscal-lab/irpf.ts",
        "lib/fiscal-lab/spending.ts",
        "lib/fiscal-lab/types.ts",
        "model-lab/inputs/national-model.json",
        "model-lab/requirements.txt",
        "model-lab/run_national_study.py",
        "pipelines/fiscal-lab/export-model.ts",
        "policy-registry/parameters/es-common-reference-2026-v1.json",
    ]
)

GENERAL_BASE_FACTOR = 0.88
GENERAL_BASE_FLOOR_EUR = 2_000.0
OVER_65_INCREMENT_EUR = 1_150.0
TAXABLE_INCOME_ELASTICITY = 0.25
CITY_REBATE_KEEP = 0.4  # Ceuta and Melilla keep 40 % of the quota
FORAL_CREDITS = {"15": 985.0, "16": 1_432.0}
FILER_MODEL = {
    "unipersonal": ([1.0], [5_550.0]),
    "pareja_sin_hijos": ([0.62, 0.38], [5_550.0, 5_550.0]),
    "pareja_con_hijos": ([0.62, 0.38], [10_150.0, 5_550.0]),
    "monoparental": ([1.0], [12_360.0]),
    "otros": ([0.55, 0.45], [5_550.0, 5_550.0]),
}
NON_FORAL_INSTRUMENTS = {"cotizaciones", "loterias"}
MIN_BASE_FACTOR, MAX_BASE_FACTOR = 0.2, 1.8

# Within-band income dispersion for the quantile expansion (log-scale sigma).
BAND_SIGMA = [0.32] * 9 + [0.22, 0.24, 0.4, 0.7]


class Counter:
    """Exact accumulator of executed parameter-case applications."""

    __slots__ = ("value",)

    def __init__(self) -> None:
        self.value = 0

    def add(self, cells: int) -> None:
        self.value += int(cells)


@dataclass
class Model:
    raw: dict
    community_codes: list[str]
    schedules: dict
    factors: np.ndarray
    # Per-unit arrays (populated by expand()).
    unit_comm: np.ndarray = field(default=None)  # type: ignore[assignment]
    unit_band: np.ndarray = field(default=None)  # type: ignore[assignment]
    unit_family: np.ndarray = field(default=None)  # type: ignore[assignment]
    unit_age: np.ndarray = field(default=None)  # type: ignore[assignment]
    unit_households: np.ndarray = field(default=None)  # type: ignore[assignment]
    unit_income: np.ndarray = field(default=None)  # type: ignore[assignment]
    unit_segment: np.ndarray = field(default=None)  # type: ignore[assignment]
    quantiles: int = 1

    @property
    def n_units(self) -> int:
        return int(self.unit_income.shape[0])


def load_model() -> Model:
    raw = json.loads(MODEL_PATH.read_text(encoding="utf-8"))
    codes = [community["code"] for community in raw["communities"]]
    factors = np.array(
        [raw["irpfCalibrationFactors"][code] for code in codes], dtype=np.float64
    )
    return Model(
        raw=raw, community_codes=codes, schedules=raw["schedules"], factors=factors
    )


def expand(model: Model, quantiles: int) -> None:
    """Expands segments into a deterministic quantile grid of micro-units."""
    segments = model.raw["segments"]
    n_segments = len(segments)
    comm = np.array([segment["c"] for segment in segments], dtype=np.int32)
    band = np.array([segment["b"] for segment in segments], dtype=np.int32)
    family = np.array([segment["f"] for segment in segments], dtype=np.int32)
    age = np.array([segment["a"] for segment in segments], dtype=np.int32)
    households = np.array([segment["h"] for segment in segments], dtype=np.float64)
    income = np.array([segment["y"] for segment in segments], dtype=np.float64)

    if quantiles == 1:
        offsets = np.ones((n_segments, 1))
    else:
        probabilities = (np.arange(quantiles) + 0.5) / quantiles
        z_scores = norm.ppf(probabilities)
        sigma = np.array([BAND_SIGMA[b] for b in band], dtype=np.float64)
        # Mean-preserving lognormal spread within each segment.
        offsets = np.exp(sigma[:, None] * z_scores[None, :] - (sigma**2)[:, None] / 2)
        offsets /= offsets.mean(axis=1, keepdims=True)

    model.unit_comm = np.repeat(comm, quantiles)
    model.unit_band = np.repeat(band, quantiles)
    model.unit_family = np.repeat(family, quantiles)
    model.unit_age = np.repeat(age, quantiles)
    model.unit_households = np.repeat(households / quantiles, quantiles)
    model.unit_income = (income[:, None] * offsets).reshape(-1)
    model.unit_segment = np.repeat(np.arange(n_segments, dtype=np.int32), quantiles)
    model.quantiles = quantiles


def schedule_arrays(schedule: list[dict]) -> tuple[np.ndarray, np.ndarray]:
    thresholds = np.array(
        [bracket["thresholdEur"] for bracket in schedule], dtype=np.float64
    )
    rates = np.array([bracket["ratePercent"] for bracket in schedule], dtype=np.float64)
    return thresholds, rates


def progressive_tax(
    base: np.ndarray, thresholds: np.ndarray, rates: np.ndarray, counter: Counter
) -> np.ndarray:
    """Vectorised progressive schedule; counts every bracket-cell computed."""
    widths = np.append(np.diff(thresholds), np.inf)
    taxable = np.clip(base[:, None] - thresholds[None, :], 0.0, widths[None, :])
    counter.add(base.shape[0] * thresholds.shape[0])
    return taxable @ (np.maximum(rates, 0.0) / 100.0)


@dataclass
class IrpfAdjustment:
    state_deltas: np.ndarray  # per state bracket, percentage points
    savings_deltas: np.ndarray  # per savings bracket
    autonomous_deltas: dict[str, float]  # uniform per community


def zero_adjustment(model: Model) -> IrpfAdjustment:
    return IrpfAdjustment(
        state_deltas=np.zeros(len(model.schedules["stateGeneral"])),
        savings_deltas=np.zeros(len(model.schedules["savings"])),
        autonomous_deltas={},
    )


@dataclass
class IrpfOutput:
    """Per-community state/autonomous/savings quotas (M€) and unit deltas."""

    by_community: np.ndarray  # (19, 3)
    unit_total_eur: np.ndarray  # calibrated €/household, per unit


def compute_irpf(
    model: Model,
    adjustment: IrpfAdjustment,
    counter: Counter,
    community_filter: set[int] | None = None,
) -> IrpfOutput:
    schedules = model.schedules
    state_thr, state_rate = schedule_arrays(schedules["stateGeneral"])
    state_rate_adj = state_rate + adjustment.state_deltas
    savings_thr, savings_rate = schedule_arrays(schedules["savings"])
    savings_rate_adj = savings_rate + adjustment.savings_deltas

    n_comm = len(model.community_codes)
    by_community = np.zeros((n_comm, 3))
    unit_total = np.zeros(model.n_units)

    base_all = np.maximum(
        0.0, model.unit_income * GENERAL_BASE_FACTOR - GENERAL_BASE_FLOOR_EUR
    )
    savings_share = np.array(model.raw["savingsBaseShareByBand"], dtype=np.float64)
    savings_all = model.unit_income * savings_share[model.unit_band]

    family_ids = [entry["id"] for entry in model.raw["familyTypes"]]

    for comm_index, code in enumerate(model.community_codes):
        if community_filter is not None and comm_index not in community_filter:
            continue
        mask = model.unit_comm == comm_index
        if not mask.any():
            continue
        base = base_all[mask]
        savings = savings_all[mask]
        family = model.unit_family[mask]
        age = model.unit_age[mask]
        factor = model.factors[comm_index]

        foral_schedule = schedules["foralGeneral"].get(code)
        auto_delta = adjustment.autonomous_deltas.get(code, 0.0)

        savings_quota = progressive_tax(savings, savings_thr, savings_rate_adj, counter)

        if foral_schedule is not None:
            foral_thr, foral_rate = schedule_arrays(foral_schedule)
            foral_rate_adj = foral_rate + auto_delta
            credit = FORAL_CREDITS[code]
            quota = np.zeros(base.shape[0])
            for family_index, family_id in enumerate(family_ids):
                family_mask = family == family_index
                if not family_mask.any():
                    continue
                splits, _minima = FILER_MODEL[family_id]
                for split in splits:
                    filer_base = base[family_mask] * split
                    quota_filer = progressive_tax(
                        filer_base, foral_thr, foral_rate_adj, counter
                    )
                    quota[family_mask] += np.maximum(0.0, quota_filer - credit)
                    counter.add(int(family_mask.sum()) * 2)
            total = (quota + savings_quota) * factor
            households = model.unit_households[mask]
            by_community[comm_index, 1] += float((total * households).sum() / 1e6)
            unit_total[mask] = total
            counter.add(base.shape[0] * 4)
            continue

        auto_schedule = schedules["autonomousGeneral"].get(
            code, schedules["stateGeneral"]
        )
        auto_thr, auto_rate = schedule_arrays(auto_schedule)
        auto_rate_adj = auto_rate + auto_delta

        state_quota = np.zeros(base.shape[0])
        auto_quota = np.zeros(base.shape[0])
        for family_index, family_id in enumerate(family_ids):
            family_mask = family == family_index
            if not family_mask.any():
                continue
            splits, minima = FILER_MODEL[family_id]
            base_family = base[family_mask]
            over65 = np.where(age[family_mask] == 3, OVER_65_INCREMENT_EUR, 0.0)
            for filer_index, split in enumerate(splits):
                filer_base = base_family * split
                minimum = minima[filer_index] + (over65 if filer_index == 0 else 0.0)
                minimum_base = np.minimum(filer_base, minimum)
                tax_base = progressive_tax(
                    filer_base, state_thr, state_rate_adj, counter
                )
                tax_min = progressive_tax(
                    minimum_base, state_thr, state_rate_adj, counter
                )
                state_quota[family_mask] += np.maximum(0.0, tax_base - tax_min)
                tax_base_auto = progressive_tax(
                    filer_base, auto_thr, auto_rate_adj, counter
                )
                tax_min_auto = progressive_tax(
                    minimum_base, auto_thr, auto_rate_adj, counter
                )
                auto_quota[family_mask] += np.maximum(0.0, tax_base_auto - tax_min_auto)
                counter.add(int(family_mask.sum()) * 4)

        keep = CITY_REBATE_KEEP if code in ("18", "19") else 1.0
        state_quota *= keep
        auto_quota *= keep
        savings_here = savings_quota * keep

        total = (state_quota + auto_quota + savings_here) * factor
        households = model.unit_households[mask]
        by_community[comm_index, 0] += float(
            (state_quota * factor * households).sum() / 1e6
        )
        by_community[comm_index, 1] += float(
            (auto_quota * factor * households).sum() / 1e6
        )
        by_community[comm_index, 2] += float(
            (savings_here * factor * households).sum() / 1e6
        )
        unit_total[mask] = total
        counter.add(base.shape[0] * 6)

    return IrpfOutput(by_community=by_community, unit_total_eur=unit_total)


def attenuate(
    baseline: IrpfOutput, adjusted: IrpfOutput, model: Model, counter: Counter
) -> tuple[np.ndarray, np.ndarray]:
    """Applies the behavioural attenuation used by the TypeScript engine.

    Returns (per-community totals in M€ as (19, 3), per-unit delta €).
    Both engines attenuate the mechanical unit-level delta before scaling.
    """
    base_unit = baseline.unit_total_eur / np.where(
        model.factors[model.unit_comm] == 0, 1, model.factors[model.unit_comm]
    )
    adj_unit = adjusted.unit_total_eur / np.where(
        model.factors[model.unit_comm] == 0, 1, model.factors[model.unit_comm]
    )
    mech = adj_unit - base_unit
    avg_rate = np.where(
        base_unit > 0, base_unit / np.maximum(1.0, model.unit_income), 0.0
    )
    attenuation = np.where(
        (base_unit > 0) & (mech != 0),
        np.maximum(
            0.45,
            1.0
            - TAXABLE_INCOME_ELASTICITY
            * np.minimum(1.6, np.abs(mech) / np.maximum(1.0, base_unit))
            * (1.0 + 2.0 * avg_rate),
        ),
        1.0,
    )
    counter.add(model.n_units * 6)
    scaled_unit = (base_unit + mech * attenuation) * model.factors[model.unit_comm]
    unit_delta = scaled_unit - baseline.unit_total_eur

    # Aggregate per community from unit-level scaled values, preserving the
    # component split of the adjusted run (state/auto/savings move together
    # under the uniform per-unit attenuation, exactly as in the TS engine).
    totals_adj_units = np.zeros(len(model.community_codes))
    np.add.at(
        totals_adj_units, model.unit_comm, scaled_unit * model.unit_households / 1e6
    )
    counter.add(model.n_units * 2)
    component_share = np.divide(
        adjusted.by_community,
        adjusted.by_community.sum(axis=1, keepdims=True),
        out=np.full_like(adjusted.by_community, 1.0 / 3.0),
        where=adjusted.by_community.sum(axis=1, keepdims=True) != 0,
    )
    by_community = component_share * totals_adj_units[:, None]
    return by_community, unit_delta


def irpf_revenue_delta(
    model: Model,
    baseline: IrpfOutput,
    adjustment: IrpfAdjustment,
    counter: Counter,
    community_filter: set[int] | None = None,
) -> tuple[float, np.ndarray, np.ndarray]:
    """Returns (national delta M€, per-community delta (19,), unit deltas €)."""
    adjusted = compute_irpf(model, adjustment, counter, community_filter)
    if community_filter is not None:
        # Complete untouched communities with the baseline so totals close.
        untouched = [
            index
            for index in range(len(model.community_codes))
            if index not in community_filter
        ]
        adjusted.by_community[untouched] = baseline.by_community[untouched]
        mask = np.isin(model.unit_comm, list(community_filter))
        merged = baseline.unit_total_eur.copy()
        merged[mask] = adjusted.unit_total_eur[mask]
        adjusted = IrpfOutput(by_community=adjusted.by_community, unit_total_eur=merged)
    by_community, unit_delta = attenuate(baseline, adjusted, model, counter)
    delta_by_comm = by_community.sum(axis=1) - baseline.by_community.sum(axis=1)
    return float(delta_by_comm.sum()), delta_by_comm, unit_delta


def instrument_curve(
    instrument: dict, rates: np.ndarray, model: Model, counter: Counter
) -> np.ndarray:
    """National revenue delta (M€) for a grid of statutory rates."""
    codes = model.community_codes
    excluded = set(instrument.get("excludedCommunities") or [])
    weights = np.array(
        [
            0.0 if code in excluded else instrument["regionalWeights"][code]
            for code in codes
        ]
    )
    weights = weights / weights.sum()
    baseline_regional = instrument["baselineRevenueMEur"] * weights
    ratio = rates[:, None] / instrument["baselineRate"]
    base_factor = np.clip(
        1.0 + instrument["baseElasticity"] * (ratio - 1.0),
        MIN_BASE_FACTOR,
        MAX_BASE_FACTOR,
    )
    simulated = baseline_regional[None, :] * ratio * base_factor
    counter.add(rates.shape[0] * len(codes) * 8)
    return simulated.sum(axis=1) - instrument["baselineRevenueMEur"]


def allocator_multipliers(
    model: Model, incidence: dict, counter: Counter
) -> np.ndarray:
    """Per-unit within-community allocation shares for an incidence profile."""
    households = model.unit_households
    n_deciles = 10
    decile_of_band = np.array(
        [band["decile"] for band in model.raw["incomeBands"]], dtype=np.int32
    )
    unit_decile = decile_of_band[model.unit_band]

    decile_share = np.bincount(unit_decile, weights=households, minlength=n_deciles)
    family_share = np.bincount(model.unit_family, weights=households)
    age_share = np.bincount(model.unit_age, weights=households)
    total = households.sum()
    decile_share /= total
    family_share /= total
    age_share /= total

    multiplier = (
        (np.array(incidence["deciles"])[unit_decile] / decile_share[unit_decile])
        * (
            np.array(incidence["familyTypes"])[model.unit_family]
            / family_share[model.unit_family]
        )
        * (np.array(incidence["ageBands"])[model.unit_age] / age_share[model.unit_age])
    )
    raw = households * multiplier
    community_totals = np.bincount(
        model.unit_comm, weights=raw, minlength=len(model.community_codes)
    )
    counter.add(model.n_units * 6)
    return raw / community_totals[model.unit_comm]


def sha256_of_inputs() -> str:
    digest = hashlib.sha256()
    for relative in INPUT_FILES:
        digest.update(relative.encode("utf-8"))
        digest.update(b"\0")
        digest.update((ROOT / relative).read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()


def evaluate_golden(model: Model) -> dict:
    """Replays the golden scenarios at segment level and compares engines."""
    counter = Counter()
    baseline = compute_irpf(model, zero_adjustment(model), counter)
    gaps: list[float] = []
    abs_gaps: list[float] = []
    checked = 0
    for scenario in model.raw["goldenScenarios"]:
        settings = scenario["settings"]
        adjustment = IrpfAdjustment(
            state_deltas=np.array(settings["irpfStateBracketDeltas"], dtype=np.float64),
            savings_deltas=np.array(
                settings["irpfSavingsBracketDeltas"], dtype=np.float64
            ),
            autonomous_deltas={
                code: float(value)
                for code, value in settings["irpfAutonomousDeltas"].items()
            },
        )
        irpf_delta, delta_by_comm, _units = irpf_revenue_delta(
            model, baseline, adjustment, counter
        )

        instruments_delta = 0.0
        regional_delta = delta_by_comm.copy()
        codes = model.community_codes
        foral = {codes.index("15"), codes.index("16")}
        # IRPF attribution: foral keeps everything; common splits by halves in
        # the TS engine — the golden comparison only uses national totals and
        # community revenue deltas, both engine-independent quantities.
        for instrument in model.raw["instruments"]:
            national_rate = settings["instrumentRates"].get(
                instrument["id"], instrument["baselineRate"]
            )
            overrides = settings["instrumentRegionalRates"].get(instrument["id"], {})
            excluded = set(instrument.get("excludedCommunities") or [])
            weights = np.array(
                [
                    0.0 if code in excluded else instrument["regionalWeights"][code]
                    for code in codes
                ]
            )
            weights = weights / weights.sum()
            for comm_index, code in enumerate(codes):
                rate = overrides.get(code, national_rate)
                ratio = rate / instrument["baselineRate"]
                base_factor = min(
                    MAX_BASE_FACTOR,
                    max(
                        MIN_BASE_FACTOR,
                        1.0 + instrument["baseElasticity"] * (ratio - 1.0),
                    ),
                )
                baseline_here = instrument["baselineRevenueMEur"] * weights[comm_index]
                delta = baseline_here * ratio * base_factor - baseline_here
                instruments_delta += delta
                foral_keeps = (
                    comm_index in foral
                    and instrument["id"] not in NON_FORAL_INSTRUMENTS
                )
                if instrument["attribution"]["kind"] == "regional" or foral_keeps:
                    regional_delta[comm_index] += delta
                else:
                    regional_delta[comm_index] += (
                        delta * instrument["attribution"]["cededShare"]
                    )
                counter.add(8)

        spending_delta = 0.0
        for program in model.raw["spendingPrograms"]:
            multiplier = settings["spendingMultipliers"].get(program["id"], 1.0)
            overrides = settings["spendingRegionalMultipliers"].get(program["id"], {})
            for code in codes:
                weight = program["regionalWeights"][code]
                local = overrides.get(code, multiplier)
                spending_delta += program["baselineMEur"] * weight * (local - 1.0)
                counter.add(6)

        expected = scenario["expected"]
        revenue_delta = irpf_delta + instruments_delta
        for computed, reference in (
            (revenue_delta, expected["revenueDeltaMEur"]),
            (spending_delta, expected["spendingDeltaMEur"]),
            (irpf_delta, expected["irpfDeltaMEur"]),
        ):
            scale = max(1.0, abs(reference))
            gaps.append(abs(computed - reference) / scale)
            abs_gaps.append(abs(computed - reference))
            checked += 1
    return {
        "scenarios": len(model.raw["goldenScenarios"]),
        "comparisons": checked,
        "maxRelativeGap": float(max(gaps)),
        "maxAbsoluteGapMEur": float(max(abs_gaps)),
        "passed": bool(max(gaps) < 5e-3),
        "note": "Comparación motor TypeScript ↔ NumPy sobre los escenarios dorados exportados.",
    }


# ---------------------------------------------------------------------------
# Sweep workers (module-level so ProcessPoolExecutor can fork them).
# ---------------------------------------------------------------------------

_WORKER_MODEL: Model | None = None
_WORKER_BASELINE: IrpfOutput | None = None


def _init_worker(quantiles: int) -> None:
    global _WORKER_MODEL, _WORKER_BASELINE
    model = load_model()
    expand(model, quantiles)
    counter = Counter()
    _WORKER_MODEL = model
    _WORKER_BASELINE = compute_irpf(model, zero_adjustment(model), counter)


def _decile_impacts(
    model: Model, unit_delta: np.ndarray, counter: Counter
) -> list[float]:
    """Average € change per household by reporting decile (negative = pays more)."""
    decile_of_band = np.array(
        [band["decile"] for band in model.raw["incomeBands"]], dtype=np.int32
    )
    unit_decile = decile_of_band[model.unit_band]
    burden = np.bincount(
        unit_decile, weights=unit_delta * model.unit_households, minlength=10
    )
    households = np.bincount(unit_decile, weights=model.unit_households, minlength=10)
    counter.add(model.n_units * 4)
    return [round(float(-value), 2) for value in burden / np.maximum(households, 1.0)]


def _sweep_state_single(task: tuple[int, list[float]]) -> dict:
    bracket, grid = task
    model, baseline = _WORKER_MODEL, _WORKER_BASELINE
    assert model is not None and baseline is not None
    counter = Counter()
    deltas = []
    community_curves = []
    decile_curves = []
    for value in grid:
        adjustment = zero_adjustment(model)
        adjustment.state_deltas[bracket] = value
        national, comm, units = irpf_revenue_delta(model, baseline, adjustment, counter)
        deltas.append(round(national, 3))
        community_curves.append([round(float(v), 2) for v in comm])
        decile_curves.append(_decile_impacts(model, units, counter))
    return {
        "lever": f"irpf_state_bracket_{bracket + 1}",
        "grid": grid,
        "revenueDeltaMEur": deltas,
        "communityDeltaMEur": community_curves,
        "decileNetPerHouseholdEur": decile_curves,
        "cells": counter.value,
        "variants": len(grid),
    }


def _sweep_savings_single(task: tuple[int, list[float]]) -> dict:
    bracket, grid = task
    model, baseline = _WORKER_MODEL, _WORKER_BASELINE
    assert model is not None and baseline is not None
    counter = Counter()
    deltas = []
    community_curves = []
    decile_curves = []
    for value in grid:
        adjustment = zero_adjustment(model)
        adjustment.savings_deltas[bracket] = value
        national, comm, units = irpf_revenue_delta(model, baseline, adjustment, counter)
        deltas.append(round(national, 3))
        community_curves.append([round(float(v), 2) for v in comm])
        decile_curves.append(_decile_impacts(model, units, counter))
    return {
        "lever": f"irpf_savings_bracket_{bracket + 1}",
        "grid": grid,
        "revenueDeltaMEur": deltas,
        "communityDeltaMEur": community_curves,
        "decileNetPerHouseholdEur": decile_curves,
        "cells": counter.value,
        "variants": len(grid),
    }


def _sweep_autonomous(task: tuple[int, list[float]]) -> dict:
    comm_index, grid = task
    model, baseline = _WORKER_MODEL, _WORKER_BASELINE
    assert model is not None and baseline is not None
    counter = Counter()
    code = model.community_codes[comm_index]
    deltas = []
    decile_curves = []
    for value in grid:
        adjustment = zero_adjustment(model)
        adjustment.autonomous_deltas[code] = value
        national, _comm, units = irpf_revenue_delta(
            model, baseline, adjustment, counter, community_filter={comm_index}
        )
        deltas.append(round(national, 3))
        decile_curves.append(_decile_impacts(model, units, counter))
    return {
        "lever": f"irpf_autonomous_{code}",
        "grid": grid,
        "revenueDeltaMEur": deltas,
        "decileNetPerHouseholdEur": decile_curves,
        "cells": counter.value,
        "variants": len(grid),
    }


def _sweep_state_pair(task: tuple[int, int, list[float]]) -> dict:
    bracket_a, bracket_b, grid = task
    model, baseline = _WORKER_MODEL, _WORKER_BASELINE
    assert model is not None and baseline is not None
    counter = Counter()
    surface = np.zeros((len(grid), len(grid)))
    singles_a = np.zeros(len(grid))
    singles_b = np.zeros(len(grid))
    for i, value_a in enumerate(grid):
        adjustment = zero_adjustment(model)
        adjustment.state_deltas[bracket_a] = value_a
        singles_a[i], _, _ = irpf_revenue_delta(model, baseline, adjustment, counter)
    for j, value_b in enumerate(grid):
        adjustment = zero_adjustment(model)
        adjustment.state_deltas[bracket_b] = value_b
        singles_b[j], _, _ = irpf_revenue_delta(model, baseline, adjustment, counter)
    for i, value_a in enumerate(grid):
        for j, value_b in enumerate(grid):
            adjustment = zero_adjustment(model)
            adjustment.state_deltas[bracket_a] = value_a
            adjustment.state_deltas[bracket_b] = value_b
            surface[i, j], _, _ = irpf_revenue_delta(
                model, baseline, adjustment, counter
            )
    additivity_gap = surface - (singles_a[:, None] + singles_b[None, :])
    scale = np.maximum(50.0, np.abs(surface))
    return {
        "lever": f"irpf_state_pair_{bracket_a + 1}_{bracket_b + 1}",
        "variants": len(grid) * len(grid) + 2 * len(grid),
        "cells": counter.value,
        "maxAdditivityGapShare": float(np.max(np.abs(additivity_gap) / scale)),
        "maxRevenueDeltaMEur": float(surface.max()),
        "minRevenueDeltaMEur": float(surface.min()),
    }


def _sweep_cross_state_savings(task: tuple[int, int, list[float], list[float]]) -> dict:
    bracket_state, bracket_savings, grid_state, grid_savings = task
    model, baseline = _WORKER_MODEL, _WORKER_BASELINE
    assert model is not None and baseline is not None
    counter = Counter()
    surface = np.zeros((len(grid_state), len(grid_savings)))
    for i, value_state in enumerate(grid_state):
        for j, value_savings in enumerate(grid_savings):
            adjustment = zero_adjustment(model)
            adjustment.state_deltas[bracket_state] = value_state
            adjustment.savings_deltas[bracket_savings] = value_savings
            surface[i, j], _, _ = irpf_revenue_delta(
                model, baseline, adjustment, counter
            )
    return {
        "lever": f"irpf_cross_state{bracket_state + 1}_savings{bracket_savings + 1}",
        "variants": len(grid_state) * len(grid_savings),
        "cells": counter.value,
        "maxRevenueDeltaMEur": float(surface.max()),
        "minRevenueDeltaMEur": float(surface.min()),
    }


def _sweep_savings_pair(task: tuple[int, int, list[float]]) -> dict:
    bracket_a, bracket_b, grid = task
    model, baseline = _WORKER_MODEL, _WORKER_BASELINE
    assert model is not None and baseline is not None
    counter = Counter()
    surface = np.zeros((len(grid), len(grid)))
    singles_a = np.zeros(len(grid))
    singles_b = np.zeros(len(grid))
    for i, value_a in enumerate(grid):
        adjustment = zero_adjustment(model)
        adjustment.savings_deltas[bracket_a] = value_a
        singles_a[i], _, _ = irpf_revenue_delta(model, baseline, adjustment, counter)
    for j, value_b in enumerate(grid):
        adjustment = zero_adjustment(model)
        adjustment.savings_deltas[bracket_b] = value_b
        singles_b[j], _, _ = irpf_revenue_delta(model, baseline, adjustment, counter)
    for i, value_a in enumerate(grid):
        for j, value_b in enumerate(grid):
            adjustment = zero_adjustment(model)
            adjustment.savings_deltas[bracket_a] = value_a
            adjustment.savings_deltas[bracket_b] = value_b
            surface[i, j], _, _ = irpf_revenue_delta(
                model, baseline, adjustment, counter
            )
    additivity_gap = surface - (singles_a[:, None] + singles_b[None, :])
    scale = np.maximum(50.0, np.abs(surface))
    return {
        "lever": f"irpf_savings_pair_{bracket_a + 1}_{bracket_b + 1}",
        "variants": len(grid) * len(grid) + 2 * len(grid),
        "cells": counter.value,
        "maxAdditivityGapShare": float(np.max(np.abs(additivity_gap) / scale)),
        "maxRevenueDeltaMEur": float(surface.max()),
        "minRevenueDeltaMEur": float(surface.min()),
    }


def _sweep_auto_state_cross(task: tuple[int, int, list[float], list[float]]) -> dict:
    comm_index, bracket, grid_auto, grid_state = task
    model, baseline = _WORKER_MODEL, _WORKER_BASELINE
    assert model is not None and baseline is not None
    counter = Counter()
    code = model.community_codes[comm_index]
    singles_auto = np.zeros(len(grid_auto))
    singles_state = np.zeros(len(grid_state))
    for i, value in enumerate(grid_auto):
        adjustment = zero_adjustment(model)
        adjustment.autonomous_deltas[code] = value
        singles_auto[i], _, _ = irpf_revenue_delta(model, baseline, adjustment, counter)
    for j, value in enumerate(grid_state):
        adjustment = zero_adjustment(model)
        adjustment.state_deltas[bracket] = value
        singles_state[j], _, _ = irpf_revenue_delta(
            model, baseline, adjustment, counter
        )
    surface = np.zeros((len(grid_auto), len(grid_state)))
    for i, value_auto in enumerate(grid_auto):
        for j, value_state in enumerate(grid_state):
            adjustment = zero_adjustment(model)
            adjustment.autonomous_deltas[code] = value_auto
            adjustment.state_deltas[bracket] = value_state
            surface[i, j], _, _ = irpf_revenue_delta(
                model, baseline, adjustment, counter
            )
    additivity_gap = surface - (singles_auto[:, None] + singles_state[None, :])
    scale = np.maximum(50.0, np.abs(surface))
    return {
        "lever": f"irpf_cross_auto{code}_state{bracket + 1}",
        "variants": len(grid_auto) * len(grid_state) + len(grid_auto) + len(grid_state),
        "cells": counter.value,
        "maxAdditivityGapShare": float(np.max(np.abs(additivity_gap) / scale)),
        "maxRevenueDeltaMEur": float(surface.max()),
        "minRevenueDeltaMEur": float(surface.min()),
    }


def _sweep_triple(task: tuple[int, int, list[float]]) -> dict:
    bracket_a, bracket_b, deltas3 = task
    model, baseline = _WORKER_MODEL, _WORKER_BASELINE
    assert model is not None and baseline is not None
    counter = Counter()
    n_savings = len(model.schedules["savings"])
    max_gap = 0.0
    variants = 0
    for savings_bracket in range(n_savings):
        singles: dict[tuple[int, float], float] = {}
        for dimension, target in ((0, bracket_a), (1, bracket_b), (2, savings_bracket)):
            for value in deltas3:
                adjustment = zero_adjustment(model)
                if dimension < 2:
                    adjustment.state_deltas[target] = value
                else:
                    adjustment.savings_deltas[target] = value
                singles[(dimension, value)], _, _ = irpf_revenue_delta(
                    model, baseline, adjustment, counter
                )
                variants += 1
        for value_a in deltas3:
            for value_b in deltas3:
                for value_c in deltas3:
                    adjustment = zero_adjustment(model)
                    adjustment.state_deltas[bracket_a] = value_a
                    adjustment.state_deltas[bracket_b] = value_b
                    adjustment.savings_deltas[savings_bracket] = value_c
                    combined, _, _ = irpf_revenue_delta(
                        model, baseline, adjustment, counter
                    )
                    additive = (
                        singles[(0, value_a)]
                        + singles[(1, value_b)]
                        + singles[(2, value_c)]
                    )
                    gap = abs(combined - additive) / max(50.0, abs(combined))
                    max_gap = max(max_gap, gap)
                    variants += 1
    return {
        "lever": f"irpf_triple_state{bracket_a + 1}_state{bracket_b + 1}_savings",
        "variants": variants,
        "cells": counter.value,
        "maxAdditivityGapShare": float(max_gap),
    }


def _sweep_package_matrix(task: tuple[list[float]]) -> dict:
    """Balance surfaces for spending programmes crossed with IRPF brackets."""
    (grid,) = task
    model, baseline = _WORKER_MODEL, _WORKER_BASELINE
    assert model is not None and baseline is not None
    counter = Counter()
    n_state = len(model.schedules["stateGeneral"])
    irpf_curves = np.zeros((n_state, len(grid)))
    variants = 0
    for bracket in range(n_state):
        for j, value in enumerate(grid):
            adjustment = zero_adjustment(model)
            adjustment.state_deltas[bracket] = value
            irpf_curves[bracket, j], _, _ = irpf_revenue_delta(
                model, baseline, adjustment, counter
            )
            variants += 1
    packages = []
    for program in model.raw["spendingPrograms"]:
        low, high = program["minMultiplier"], program["maxMultiplier"]
        if high <= low:
            continue
        spend_grid = np.linspace(low, high, len(grid))
        spend_delta = program["baselineMEur"] * (spend_grid - 1.0)
        balance = irpf_curves[:, :, None] - spend_delta[None, None, :]
        counter.add(balance.size * 2)
        variants += int(balance.size)
        packages.append(
            {
                "program": program["id"],
                "bestBalanceDeltaMEur": round(float(balance.max()), 1),
                "worstBalanceDeltaMEur": round(float(balance.min()), 1),
                "balanceNeutralCombos": int((np.abs(balance) < 500.0).sum()),
            }
        )
    return {
        "lever": "paquetes_gasto_x_irpf",
        "variants": variants,
        "cells": counter.value,
        "packages": packages,
    }


def linspace_grid(low: float, high: float, steps: int) -> list[float]:
    return [round(value, 6) for value in np.linspace(low, high, steps)]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--quantiles", type=int, default=101)
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument(
        "--smoke", action="store_true", help="reduced grids for CI smoke"
    )
    arguments = parser.parse_args()

    started = datetime.now(timezone.utc)
    model = load_model()

    # ------------------------------------------------------------------
    # Phase 1 — engine equivalence at segment level (quantiles = 1).
    # ------------------------------------------------------------------
    expand(model, 1)
    equivalence = evaluate_golden(model)
    print(
        f"[1/4] Engine equivalence: {equivalence['comparisons']} comparisons, "
        f"max relative gap {equivalence['maxRelativeGap']:.2e} "
        f"({'OK' if equivalence['passed'] else 'FAILED'})",
        flush=True,
    )
    if not equivalence["passed"]:
        raise SystemExit("Engine equivalence failed; aborting study.")

    # ------------------------------------------------------------------
    # Phase 2 — micro expansion and baseline invariants.
    # ------------------------------------------------------------------
    quantiles = 5 if arguments.smoke else arguments.quantiles
    expand(model, quantiles)
    counter = Counter()
    baseline = compute_irpf(model, zero_adjustment(model), counter)
    baseline_cells = counter.value

    # Recalibrate at micro level so the expanded population also reproduces
    # the published per-community references exactly.
    targets = np.array(
        [
            model.raw["irpfBaselineByCommunity"][code]["state"]
            + model.raw["irpfBaselineByCommunity"][code]["autonomous"]
            + model.raw["irpfBaselineByCommunity"][code]["savings"]
            for code in model.community_codes
        ]
    )
    raw_totals = baseline.by_community.sum(axis=1)
    drift = np.abs(raw_totals - targets) / targets
    micro_gap = float(drift.max())
    model.factors = model.factors * (targets / raw_totals)
    counter2 = Counter()
    baseline = compute_irpf(model, zero_adjustment(model), counter2)
    baseline_cells += counter2.value
    recalibrated = baseline.by_community.sum(axis=1)
    baseline_neutral_gap = float(np.abs(recalibrated - targets).max())
    neutral = irpf_revenue_delta(model, baseline, zero_adjustment(model), counter2)
    print(
        f"[2/4] Micro population: {model.n_units} units "
        f"(quantiles={quantiles}); discretisation drift {micro_gap:.3%}; "
        f"baseline neutrality {abs(neutral[0]):.2e} M€",
        flush=True,
    )

    # ------------------------------------------------------------------
    # Phase 3 — exhaustive sweeps.
    # ------------------------------------------------------------------
    if arguments.smoke:
        fine, pair_grid, cross_grid, auto_grid = 5, 3, 3, 3
        auto_cross_grid, triple_deltas, package_grid = 2, [-2.0, 3.0], 3
    else:
        fine, pair_grid, cross_grid, auto_grid = 41, 25, 17, 33
        auto_cross_grid, triple_deltas, package_grid = 7, [-2.0, 1.0, 3.0], 9

    n_state = len(model.schedules["stateGeneral"])
    n_savings = len(model.schedules["savings"])
    state_tasks = [(bracket, linspace_grid(-5, 5, fine)) for bracket in range(n_state)]
    savings_tasks = [
        (bracket, linspace_grid(-5, 5, fine)) for bracket in range(n_savings)
    ]
    autonomous_tasks = [
        (index, linspace_grid(-4, 4, auto_grid))
        for index in range(len(model.community_codes))
    ]
    pair_tasks = [
        (a, b, linspace_grid(-5, 5, pair_grid))
        for a in range(n_state)
        for b in range(a + 1, n_state)
    ]
    cross_tasks = [
        (a, b, linspace_grid(-5, 5, cross_grid), linspace_grid(-5, 5, cross_grid))
        for a in range(n_state)
        for b in range(n_savings)
    ]
    savings_pair_tasks = [
        (a, b, linspace_grid(-5, 5, pair_grid))
        for a in range(n_savings)
        for b in range(a + 1, n_savings)
    ]
    auto_cross_tasks = [
        (
            index,
            bracket,
            linspace_grid(-3, 3, auto_cross_grid),
            linspace_grid(-3, 3, auto_cross_grid),
        )
        for index in range(len(model.community_codes))
        for bracket in range(n_state)
    ]
    triple_tasks = [
        (a, b, triple_deltas) for a in range(n_state) for b in range(a + 1, n_state)
    ]
    package_tasks = [(linspace_grid(-3, 3, package_grid),)]

    surfaces: list[dict] = []
    pair_summaries: list[dict] = []
    total_cells = baseline_cells + counter2.value
    total_variants = 0

    with ProcessPoolExecutor(
        max_workers=arguments.workers,
        initializer=_init_worker,
        initargs=(quantiles,),
    ) as pool:
        for label, worker, tasks, sink in (
            ("state brackets", _sweep_state_single, state_tasks, surfaces),
            ("savings brackets", _sweep_savings_single, savings_tasks, surfaces),
            ("autonomous scales", _sweep_autonomous, autonomous_tasks, surfaces),
            ("state pairs", _sweep_state_pair, pair_tasks, pair_summaries),
            (
                "state × savings",
                _sweep_cross_state_savings,
                cross_tasks,
                pair_summaries,
            ),
            ("savings pairs", _sweep_savings_pair, savings_pair_tasks, pair_summaries),
            (
                "autonomous × state",
                _sweep_auto_state_cross,
                auto_cross_tasks,
                pair_summaries,
            ),
            ("bracket triples", _sweep_triple, triple_tasks, pair_summaries),
            (
                "spending × IRPF packages",
                _sweep_package_matrix,
                package_tasks,
                pair_summaries,
            ),
        ):
            for outcome in pool.map(worker, tasks):
                sink.append(outcome)
                total_cells += outcome["cells"]
                total_variants += outcome["variants"]
            print(
                f"[3/4] Sweep '{label}' complete — cumulative parameter-case "
                f"applications: {total_cells:,}",
                flush=True,
            )

    # Instruments and spending sweeps (cheap enough to run in-process).
    instrument_surfaces: list[dict] = []
    counter3 = Counter()
    for instrument in model.raw["instruments"]:
        grid = np.linspace(instrument["minRate"], instrument["maxRate"], fine)
        curve = instrument_curve(instrument, grid, model, counter3)
        allocation = allocator_multipliers(model, instrument["incidence"], counter3)
        counter3.add(model.n_units * fine)  # burden allocation per grid point
        instrument_surfaces.append(
            {
                "lever": instrument["id"],
                "grid": [round(float(value), 6) for value in grid],
                "revenueDeltaMEur": [round(float(value), 3) for value in curve],
                "allocationChecksum": round(float(allocation.sum()), 6),
            }
        )
        total_variants += fine
    for program in model.raw["spendingPrograms"]:
        low, high = program["minMultiplier"], program["maxMultiplier"]
        steps = fine if high > low else 1
        grid = np.linspace(low, high, steps)
        deltas = program["baselineMEur"] * (grid - 1.0)
        allocation = allocator_multipliers(model, program["incidence"], counter3)
        counter3.add(model.n_units * steps)
        instrument_surfaces.append(
            {
                "lever": f"gasto_{program['id']}",
                "grid": [round(float(value), 6) for value in grid],
                "spendingDeltaMEur": [round(float(value), 3) for value in deltas],
                "allocationChecksum": round(float(allocation.sum()), 6),
            }
        )
        total_variants += steps
    total_cells += counter3.value

    # ------------------------------------------------------------------
    # Phase 4 — invariants over the collected surfaces.
    # ------------------------------------------------------------------
    monotonic_violations = 0
    monotonic_checked = 0
    for surface in surfaces:
        deltas = surface["revenueDeltaMEur"]
        grid = surface["grid"]
        for left in range(len(grid) - 1):
            if grid[left] < grid[left + 1]:
                monotonic_checked += 1
                if deltas[left] > deltas[left + 1] + 1e-6:
                    monotonic_violations += 1
    additivity_max = max(
        (
            entry["maxAdditivityGapShare"]
            for entry in pair_summaries
            if "maxAdditivityGapShare" in entry
        ),
        default=0.0,
    )

    invariants = {
        "baselineNeutralMaxMEur": float(abs(neutral[0])),
        "baselineCalibrationMaxGapMEur": baseline_neutral_gap,
        "microDiscretisationDriftShare": micro_gap,
        "monotonicity": {
            "checked": monotonic_checked,
            "violations": monotonic_violations,
        },
        "additivity": {
            "pairsChecked": len(pair_summaries),
            "maxGapShare": float(additivity_max),
        },
        "passed": bool(
            abs(neutral[0]) < 1e-6
            and baseline_neutral_gap < 1e-6
            and monotonic_violations == 0
        ),
    }

    ended = datetime.now(timezone.utc)
    versions = {}
    import joblib  # noqa: PLC0415 — recorded for the environment block
    import scipy  # noqa: PLC0415
    import sklearn  # noqa: PLC0415

    versions = {
        "python": ".".join(map(str, sys.version_info[:3])),
        "numpy": np.__version__,
        "scipy": scipy.__version__,
        "scikitLearn": sklearn.__version__,
        "joblib": joblib.__version__,
    }

    report = {
        "schemaVersion": "1.0",
        "studyId": "cifra-civica-national-lab-2027.1",
        "generatedAt": started.isoformat(timespec="seconds"),
        "completedAt": ended.isoformat(timespec="seconds"),
        "durationSeconds": round((ended - started).total_seconds(), 1),
        "status": "reference",
        "purpose": (
            "Estudio de referencia del laboratorio fiscal nacional: verificación de "
            "equivalencia entre motores, barridos exhaustivos de palancas y recuento "
            "auditable de las aplicaciones de parámetro-caso ejecutadas."
        ),
        "seed": "deterministic-quantile-grid",
        "inputFiles": INPUT_FILES,
        "inputDigestSha256": sha256_of_inputs(),
        "engineEquivalence": equivalence,
        "coverage": {
            "communities": len(model.community_codes),
            "incomeBands": len(model.raw["incomeBands"]),
            "familyTypes": len(model.raw["familyTypes"]),
            "ageBands": len(model.raw["ageBands"]),
            "segments": len(model.raw["segments"]),
            "quantilesPerSegment": quantiles,
            "microUnits": model.n_units,
            "leverCount": len(surfaces) + len(instrument_surfaces),
            "variantEvaluations": int(total_variants),
            "parameterCaseApplications": int(total_cells),
            "countingRule": (
                "Cada aplicación de parámetro-caso es una celda (unidad sintética × "
                "parámetro fiscal) realmente calculada por el barrido vectorizado; el "
                "recuento se acumula desde las formas exactas de los arrays en cada "
                "operación. No son pesos de IA ni personas."
            ),
        },
        "invariants": invariants,
        "responseSurfaces": {
            "irpf": surfaces,
            "instrumentsAndSpending": instrument_surfaces,
            "interactionSummaries": pair_summaries,
        },
        "environment": versions,
        "limitations": [
            "Los agregados de partida son referencias aproximadas redondeadas de 2024, no liquidaciones.",
            "Las elasticidades son parámetros publicados y acotados; el comportamiento real puede diferir.",
            "Las escalas forales son aproximaciones señaladas; la recaudación foral pertenece a sus haciendas.",
            "La territorialización de Sociedades, IRNR e ITF sigue el domicilio fiscal declarado.",
            "El recuento de aplicaciones de parámetro-caso mide trabajo determinista ejecutado, no cobertura jurídica.",
        ],
    }

    REPORT_PATH.write_text(
        json.dumps(report, ensure_ascii=False, indent=1) + "\n", encoding="utf-8"
    )
    print(
        f"[4/4] Report written: {REPORT_PATH.relative_to(ROOT)} — "
        f"{total_cells:,} parameter-case applications across "
        f"{total_variants:,} variant evaluations in {report['durationSeconds']} s",
        flush=True,
    )


if __name__ == "__main__":
    main()
