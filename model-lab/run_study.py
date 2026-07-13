#!/usr/bin/env python3
"""Reproducible large-scale statistical validation of the exact fiscal engine.

The study deliberately separates:

* exact policy calculations (the oracle and public source of truth), and
* learned surrogates (diagnostics, sensitivity and latency research only).

Money enters the fiscal engine as integer euro cents. Model features and metrics
are stored in euros to keep coefficients numerically well-conditioned.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import platform
import shutil
import sys
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Tuple
from uuid import UUID


ROOT = Path(__file__).resolve().parents[1]
API_ROOT = ROOT / "services" / "simulation-api"
sys.path.insert(0, str(API_ROOT))

import joblib  # noqa: E402
import numpy as np  # noqa: E402
import scipy  # noqa: E402
import sklearn  # noqa: E402
from sklearn.ensemble import ExtraTreesRegressor, HistGradientBoostingRegressor  # noqa: E402
from sklearn.inspection import permutation_importance  # noqa: E402
from sklearn.linear_model import Ridge  # noqa: E402
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score  # noqa: E402
from sklearn.pipeline import make_pipeline  # noqa: E402
from sklearn.preprocessing import StandardScaler  # noqa: E402


FEATURES: Tuple[str, ...] = (
    "community_index",
    "adult_count",
    "marital_code",
    "filing_code",
    "single_parent",
    "primary_age",
    "secondary_age",
    "employment_income_primary_eur",
    "employment_income_secondary_eur",
    "self_employment_income_eur",
    "unemployment_benefits_eur",
    "pension_income_eur",
    "other_taxable_income_eur",
    "exempt_income_eur",
    "months_worked_primary",
    "months_worked_secondary",
    "multiple_jobs_count",
    "adult_disability_score",
    "eligible_descendants",
    "dependants_under_3",
    "dependants_disabled",
    "shared_custody_count",
    "interest_dividends_eur",
    "property_income_eur",
    "capital_gains_net_eur",
    "taxable_household_benefits_eur",
    "exempt_household_benefits_eur",
    "annual_rent_eur",
    "mortgage_exists",
    "contribution_base_override_eur",
)

TARGETS: Tuple[str, ...] = (
    "baseline_disposable_income_eur",
    "baseline_final_irpf_eur",
    "baseline_social_security_eur",
    "family_relief_change_eur",
    "child_transfer_change_eur",
)

POLICY_IDS = (
    "baseline-2027-common-reference",
    "demo-family-tax-relief-2027",
    "demo-child-transfer-2027",
)

COMMON_CODES = (
    "01",
    "02",
    "03",
    "04",
    "05",
    "06",
    "07",
    "08",
    "09",
    "10",
    "11",
    "12",
    "13",
    "14",
    "17",
)
MARITAL = (
    "single",
    "married",
    "separated",
    "divorced",
    "widowed",
    "domestic_partnership",
)
FIXED_IDS = tuple(
    UUID(f"00000000-0000-4000-8000-{index:012d}") for index in range(1, 20)
)


def _round_euros(cents: int) -> float:
    return float(cents) / 100.0


def _person(
    *,
    index: int,
    age: int,
    relationship: str,
    employment: int,
    self_employment: int,
    unemployment: int,
    pension: int,
    other_taxable: int,
    exempt: int,
    months: int,
    disability: int,
    multiple_jobs: bool,
    contribution_override: int,
):
    from app.models import PersonInput

    if employment and self_employment:
        employment_status = "mixed"
        social_category = "general_employee"
    elif employment:
        employment_status = "employee"
        social_category = "general_employee"
    elif self_employment:
        employment_status = "self_employed"
        social_category = "self_employed"
    elif pension:
        employment_status = "retired"
        social_category = "other"
    elif unemployment:
        employment_status = "unemployed"
        social_category = "other"
    else:
        employment_status = "inactive"
        social_category = "other"
    disability_band = (
        "none"
        if disability == 0
        else ("broad_lower_band" if disability == 1 else "broad_higher_band")
    )
    return PersonInput.model_construct(
        id=FIXED_IDS[index],
        age=age,
        relationship_to_household=relationship,
        employment_status=employment_status,
        annual_gross_employment_income=employment,
        annual_self_employment_net_income=self_employment,
        annual_unemployment_benefits=unemployment,
        annual_pension_income=pension,
        annual_other_taxable_benefits=other_taxable,
        annual_exempt_income=exempt,
        disability_band=disability_band,
        social_security_category=social_category,
        months_worked=months,
        multiple_jobs=multiple_jobs,
        contribution_base_override=contribution_override or None,
        data_quality="exact",
    )


def _sample_household(rng: np.random.Generator):
    from app.models import (
        CapitalIncomeInput,
        DependantInput,
        HouseholdBenefitInput,
        HouseholdInput,
        HousingInput,
        ResidenceInput,
    )

    community_index = int(rng.integers(0, len(COMMON_CODES)))
    adult_count = 1 if rng.random() < 0.58 else 2
    marital_code = int(rng.integers(0, len(MARITAL)))
    if adult_count == 1 and marital_code == 1:
        marital_code = 0
    if adult_count == 2 and marital_code == 1:
        secondary_relationship = "spouse_partner"
    else:
        secondary_relationship = "other_adult"

    dependant_count = int(min(6, rng.poisson(1.15)))
    single_parent = bool(
        adult_count == 1
        and dependant_count > 0
        and marital_code in {0, 2, 3, 4}
        and rng.random() < 0.48
    )
    ages = [int(rng.integers(18, 91)), 0]
    if adult_count == 2:
        ages[1] = int(rng.integers(18, 91))
    employment = [0, 0]
    self_employment = [0, 0]
    unemployment = [0, 0]
    pension = [0, 0]
    other_taxable = [0, 0]
    exempt = [0, 0]
    months = [0, 0]
    disability = [0, 0]
    multiple_jobs = [False, False]
    contribution_override = [0, 0]

    for index in range(adult_count):
        status = int(rng.choice(6, p=(0.56, 0.13, 0.07, 0.10, 0.06, 0.08)))
        if status in {0, 1, 2}:
            months[index] = int(rng.integers(1, 13))
        if status in {0, 2}:
            employment[index] = int(
                round(min(240_000, rng.lognormal(math.log(31_000), 0.72)) * 100)
            )
            multiple_jobs[index] = bool(rng.random() < 0.09)
        if status in {1, 2}:
            self_employment[index] = int(
                round(min(220_000, rng.lognormal(math.log(24_000), 0.85)) * 100)
            )
        if status == 3:
            pension[index] = int(
                round(min(90_000, rng.lognormal(math.log(20_000), 0.55)) * 100)
            )
        if status == 4:
            unemployment[index] = int(round(rng.uniform(1_500, 22_000) * 100))
        if rng.random() < 0.12:
            other_taxable[index] = int(round(rng.uniform(250, 14_000) * 100))
        if rng.random() < 0.10:
            exempt[index] = int(round(rng.uniform(100, 9_000) * 100))
        disability[index] = int(rng.choice(3, p=(0.91, 0.07, 0.02)))
        if months[index] and rng.random() < 0.08:
            monthly_override = rng.uniform(1_000, 5_100)
            contribution_override[index] = int(
                round(monthly_override * months[index] * 100)
            )

    adults = [
        _person(
            index=0,
            age=ages[0],
            relationship="primary",
            employment=employment[0],
            self_employment=self_employment[0],
            unemployment=unemployment[0],
            pension=pension[0],
            other_taxable=other_taxable[0],
            exempt=exempt[0],
            months=months[0],
            disability=disability[0],
            multiple_jobs=multiple_jobs[0],
            contribution_override=contribution_override[0],
        )
    ]
    if adult_count == 2:
        adults.append(
            _person(
                index=1,
                age=ages[1],
                relationship=secondary_relationship,
                employment=employment[1],
                self_employment=self_employment[1],
                unemployment=unemployment[1],
                pension=pension[1],
                other_taxable=other_taxable[1],
                exempt=exempt[1],
                months=months[1],
                disability=disability[1],
                multiple_jobs=multiple_jobs[1],
                contribution_override=contribution_override[1],
            )
        )

    dependants = []
    dependant_under_3 = 0
    dependant_disabled = 0
    shared_custody = 0
    eligible_descendants = 0
    for index in range(dependant_count):
        relationship = "ascendant" if rng.random() < 0.09 else "child"
        age = (
            int(rng.integers(66, 96))
            if relationship == "ascendant"
            else int(rng.integers(0, 31))
        )
        disabled = int(rng.choice(3, p=(0.92, 0.06, 0.02)))
        eligible = bool(
            rng.random() < (0.92 if relationship == "child" and age < 25 else 0.62)
        )
        custody = bool(relationship == "child" and rng.random() < 0.13)
        if eligible and relationship == "child":
            eligible_descendants += 1
            dependant_under_3 += int(age < 3)
            dependant_disabled += int(disabled > 0)
            shared_custody += int(custody)
        dependants.append(
            DependantInput.model_construct(
                id=FIXED_IDS[2 + index],
                age=age,
                relationship=relationship,
                disability_band="none"
                if disabled == 0
                else ("broad_lower_band" if disabled == 1 else "broad_higher_band"),
                shared_custody=custody,
                dependent_for_tax_purposes=eligible,
            )
        )

    # The fiscal engine only recognises a single-parent joint unit when at
    # least one minor child is present. Derive filing eligibility from the
    # sampled household instead of the earlier dependant count alone.
    single_parent = bool(
        single_parent
        and any(
            dependant.relationship == "child" and dependant.age < 18
            for dependant in dependants
        )
    )
    joint_eligible = (adult_count == 2 and marital_code == 1) or single_parent
    filing_code = int(rng.integers(0, 3 if joint_eligible else 2))
    filing = ("calculate_best", "individual", "joint")[filing_code]

    interest_dividends = int(
        round((rng.exponential(2_500) if rng.random() < 0.42 else 0) * 100)
    )
    property_income = int(
        round((rng.uniform(1_000, 32_000) if rng.random() < 0.16 else 0) * 100)
    )
    capital_gains = int(
        round((rng.exponential(7_000) if rng.random() < 0.18 else 0) * 100)
    )
    capital_losses = int(
        round((rng.exponential(4_000) if rng.random() < 0.10 else 0) * 100)
    )
    taxable_benefit = int(
        round((rng.uniform(200, 10_000) if rng.random() < 0.20 else 0) * 100)
    )
    exempt_benefit = int(
        round((rng.uniform(200, 10_000) if rng.random() < 0.18 else 0) * 100)
    )
    annual_rent = int(
        round((rng.uniform(3_000, 24_000) if rng.random() < 0.38 else 0) * 100)
    )
    mortgage_exists = bool(annual_rent == 0 and rng.random() < 0.29)

    benefits = []
    if taxable_benefit:
        benefits.append(
            HouseholdBenefitInput.model_construct(
                benefit_type="taxable_support",
                annual_amount=taxable_benefit,
                tax_treatment="taxable",
                data_quality="exact",
            )
        )
    if exempt_benefit:
        benefits.append(
            HouseholdBenefitInput.model_construct(
                benefit_type="exempt_support",
                annual_amount=exempt_benefit,
                tax_treatment="exempt",
                data_quality="exact",
            )
        )

    household = HouseholdInput.model_construct(
        residence=ResidenceInput.model_construct(
            autonomous_community_code=COMMON_CODES[community_index],
            municipality_code=None,
            fiscal_regime="common",
        ),
        filing_preference=filing,
        marital_status=MARITAL[marital_code],
        single_parent_household=single_parent,
        adults=adults,
        dependants=dependants,
        housing=HousingInput.model_construct(
            tenure="renter"
            if annual_rent
            else ("owner_with_mortgage" if mortgage_exists else "owner_no_mortgage"),
            annual_rent=annual_rent or None,
            mortgage_exists=mortgage_exists,
            mortgage_start_year=2018 if mortgage_exists else None,
            primary_residence=True,
            protected_housing=False,
        ),
        household_benefits=benefits,
        broad_capital_income=CapitalIncomeInput.model_construct(
            annual_interest=interest_dividends // 2,
            annual_dividends=interest_dividends - interest_dividends // 2,
            annual_property_income=property_income,
            annual_capital_gains=capital_gains,
            annual_capital_losses=capital_losses,
            values_are_estimated=False,
        ),
        user_confirmed_assumptions=[],
    )

    feature_row = np.asarray(
        [
            community_index,
            adult_count,
            marital_code,
            filing_code,
            int(single_parent),
            ages[0],
            ages[1],
            employment[0] / 100,
            employment[1] / 100,
            sum(self_employment) / 100,
            sum(unemployment) / 100,
            sum(pension) / 100,
            sum(other_taxable) / 100,
            sum(exempt) / 100,
            months[0],
            months[1],
            sum(multiple_jobs),
            sum(disability),
            eligible_descendants,
            dependant_under_3,
            dependant_disabled,
            shared_custody,
            interest_dividends / 100,
            property_income / 100,
            (capital_gains - capital_losses) / 100,
            taxable_benefit / 100,
            exempt_benefit / 100,
            annual_rent / 100,
            int(mortgage_exists),
            sum(contribution_override) / 100,
        ],
        dtype=np.float32,
    )
    return household, feature_row


def _worker(
    shard_index: int, count: int, seed: int
) -> Tuple[int, np.ndarray, np.ndarray, Dict[str, Any]]:
    from app.config import load_settings
    from app.engine import calculate_raw_scenario
    from app.registry import PolicyRegistry

    os.environ.update(
        {
            "APP_ENV": "test",
            "POLICY_REGISTRY_PATH": str(ROOT / "policy-registry"),
            "ENABLE_SYNTHETIC_SCENARIOS": "true",
            "ALLOW_SYNTHETIC_SCENARIOS_IN_PRODUCTION": "false",
            "ENABLE_CALCULATION_TRACE": "false",
            "CORS_ORIGINS": "",
        }
    )
    registry = PolicyRegistry(load_settings())
    policies = [registry.get_policy(policy_id) for policy_id in POLICY_IDS]
    parameters = [registry.resolve_parameters(policy_id) for policy_id in POLICY_IDS]
    rng = np.random.default_rng(np.random.SeedSequence([seed, shard_index]))
    x = np.empty((count, len(FEATURES)), dtype=np.float32)
    y = np.empty((count, len(TARGETS)), dtype=np.float32)
    family_nonnegative = 0
    child_exact = 0
    start = time.perf_counter()
    for row_index in range(count):
        household, feature_row = _sample_household(rng)
        try:
            raw = [
                calculate_raw_scenario(household, params, policy)
                for params, policy in zip(parameters, policies)
            ]
        except Exception as exc:
            code = getattr(exc, "code", "unclassified")
            raise RuntimeError(
                f"study calculation failed at shard={shard_index}, "
                f"row={row_index}, type={type(exc).__name__}, code={code}"
            ) from None
        baseline = raw[0].annual
        family_delta = (
            raw[1].annual.estimated_disposable_income
            - baseline.estimated_disposable_income
        )
        child_delta = (
            raw[2].annual.estimated_disposable_income
            - baseline.estimated_disposable_income
        )
        expected_child = int(feature_row[18]) * 120_000
        family_nonnegative += int(family_delta >= 0)
        child_exact += int(child_delta == expected_child)
        x[row_index] = feature_row
        y[row_index] = (
            _round_euros(baseline.estimated_disposable_income),
            _round_euros(baseline.final_irpf),
            _round_euros(baseline.social_security_contributions),
            _round_euros(family_delta),
            _round_euros(child_delta),
        )
    elapsed = time.perf_counter() - start
    return (
        shard_index,
        x,
        y,
        {
            "households": count,
            "scenarioEvaluations": count * len(POLICY_IDS),
            "elapsedSeconds": elapsed,
            "familyReliefNonnegative": family_nonnegative,
            "childTransferExact": child_exact,
        },
    )


def _generate_dataset(
    cases: int, workers: int, shard_size: int, seed: int, work_dir: Path
):
    x_path = work_dir / "features.float32.mmap"
    y_path = work_dir / "targets.float32.mmap"
    x = np.memmap(x_path, dtype=np.float32, mode="w+", shape=(cases, len(FEATURES)))
    y = np.memmap(y_path, dtype=np.float32, mode="w+", shape=(cases, len(TARGETS)))
    shards = [
        (index, min(shard_size, cases - start), start)
        for index, start in enumerate(range(0, cases, shard_size))
    ]
    stats: List[Dict[str, Any]] = []
    wall_start = time.perf_counter()
    with ProcessPoolExecutor(max_workers=workers) as pool:
        futures = {
            pool.submit(_worker, index, count, seed): (index, start)
            for index, count, start in shards
        }
        completed = 0
        for future in as_completed(futures):
            index, start = futures[future]
            returned_index, shard_x, shard_y, shard_stats = future.result()
            if returned_index != index:
                raise RuntimeError("worker returned the wrong shard")
            stop = start + len(shard_x)
            x[start:stop] = shard_x
            y[start:stop] = shard_y
            stats.append(shard_stats)
            completed += len(shard_x)
            print(f"exact sweep: {completed:,}/{cases:,} households", flush=True)
    x.flush()
    y.flush()
    return (
        x,
        y,
        {
            "wallSeconds": time.perf_counter() - wall_start,
            "workerCpuSeconds": sum(item["elapsedSeconds"] for item in stats),
            "scenarioEvaluations": sum(item["scenarioEvaluations"] for item in stats),
            "familyReliefNonnegativeViolations": cases
            - sum(item["familyReliefNonnegative"] for item in stats),
            "childTransferExactViolations": cases
            - sum(item["childTransferExact"] for item in stats),
        },
    )


def _metric_block(actual: np.ndarray, predicted: np.ndarray) -> Dict[str, float]:
    error = np.abs(actual - predicted)
    return {
        "maeEur": round(float(mean_absolute_error(actual, predicted)), 4),
        "rmseEur": round(float(math.sqrt(mean_squared_error(actual, predicted))), 4),
        "p95AbsoluteErrorEur": round(float(np.quantile(error, 0.95)), 4),
        "p99AbsoluteErrorEur": round(float(np.quantile(error, 0.99)), 4),
        "maxAbsoluteErrorEur": round(float(np.max(error)), 4),
        "r2": round(float(r2_score(actual, predicted)), 8),
    }


def _fit_models(
    x_train: np.ndarray,
    y_train: np.ndarray,
    x_test: np.ndarray,
    y_test: np.ndarray,
    artifacts: Path,
    seed: int,
):
    model_metrics: Dict[str, Any] = {}
    fitted: Dict[str, Any] = {}

    candidates: Dict[str, Any] = {
        "ridge_linear": make_pipeline(StandardScaler(), Ridge(alpha=1.0)),
        "extra_trees": ExtraTreesRegressor(
            n_estimators=72,
            max_depth=22,
            min_samples_leaf=2,
            max_features=0.85,
            random_state=seed,
            n_jobs=-1,
        ),
    }
    for name, model in candidates.items():
        if name == "ridge_linear":
            fit_x = x_train.astype(np.float64)
            fit_y = y_train.astype(np.float64)
            predict_x = x_test.astype(np.float64)
        else:
            fit_x = x_train
            fit_y = y_train
            predict_x = x_test
        started = time.perf_counter()
        model.fit(fit_x, fit_y)
        fit_seconds = time.perf_counter() - started
        started = time.perf_counter()
        prediction = model.predict(predict_x)
        predict_seconds = time.perf_counter() - started
        model_metrics[name] = {
            "fitSeconds": round(fit_seconds, 4),
            "batchPredictionSeconds": round(predict_seconds, 4),
            "meanBatchMicrosecondsPerHousehold": round(
                predict_seconds * 1_000_000 / len(x_test), 4
            ),
            "targets": {
                target: _metric_block(y_test[:, index], prediction[:, index])
                for index, target in enumerate(TARGETS)
            },
        }
        fitted[name] = model

    hist_models = []
    hist_prediction = np.empty_like(y_test)
    hist_fit_seconds = 0.0
    hist_predict_seconds = 0.0
    for target_index in range(len(TARGETS)):
        model = HistGradientBoostingRegressor(
            learning_rate=0.08,
            max_iter=240,
            max_leaf_nodes=63,
            l2_regularization=0.8,
            random_state=seed + target_index,
        )
        started = time.perf_counter()
        model.fit(x_train, y_train[:, target_index])
        hist_fit_seconds += time.perf_counter() - started
        started = time.perf_counter()
        hist_prediction[:, target_index] = model.predict(x_test)
        hist_predict_seconds += time.perf_counter() - started
        hist_models.append(model)
    model_metrics["hist_gradient_boosting"] = {
        "fitSeconds": round(hist_fit_seconds, 4),
        "batchPredictionSeconds": round(hist_predict_seconds, 4),
        "meanBatchMicrosecondsPerHousehold": round(
            hist_predict_seconds * 1_000_000 / len(x_test), 4
        ),
        "targets": {
            target: _metric_block(y_test[:, index], hist_prediction[:, index])
            for index, target in enumerate(TARGETS)
        },
    }
    fitted["hist_gradient_boosting"] = hist_models

    # HGB is intentionally persisted: compact, deterministic and fast. The exact
    # policy engine remains authoritative and is not replaced by this artifact.
    joblib.dump(
        {"features": FEATURES, "targets": TARGETS, "models": hist_models},
        artifacts / "diagnostic-surrogate.joblib",
        compress=3,
    )
    return model_metrics, fitted


def _sensitivity(
    model: Any, x: np.ndarray, y: np.ndarray, seed: int
) -> List[Dict[str, Any]]:
    sample_count = min(25_000, len(x))
    sample_x = np.asarray(x[:sample_count])
    sample_y = np.asarray(y[:sample_count])
    result = permutation_importance(
        model,
        sample_x,
        sample_y,
        scoring="neg_mean_absolute_error",
        n_repeats=2,
        random_state=seed,
        n_jobs=-1,
    )
    rows = []
    for index, feature in enumerate(FEATURES):
        column = sample_x[:, index]
        target_column = sample_y
        correlation = 0.0
        if float(np.std(column)) > 0 and float(np.std(target_column)) > 0:
            correlation = float(np.corrcoef(column, target_column)[0, 1])
        rows.append(
            {
                "feature": feature,
                "permutationMaeIncreaseEur": round(
                    float(max(0.0, result.importances_mean[index])), 4
                ),
                "permutationStdEur": round(float(result.importances_std[index]), 4),
                "pearsonDirection": round(correlation, 6),
                "observedMin": round(float(np.min(column)), 4),
                "observedMax": round(float(np.max(column)), 4),
            }
        )
    return sorted(rows, key=lambda row: row["permutationMaeIncreaseEur"], reverse=True)


def _single_prediction_latency(
    model: Any, x: np.ndarray, iterations: int = 750
) -> Dict[str, float]:
    timings = np.empty(iterations, dtype=np.float64)
    for index in range(iterations):
        row = np.asarray(x[index % len(x) : index % len(x) + 1])
        started = time.perf_counter_ns()
        if isinstance(model, list):
            for target_model in model:
                target_model.predict(row)
        else:
            model.predict(row)
        timings[index] = (time.perf_counter_ns() - started) / 1_000_000
    return {
        "medianMilliseconds": round(float(np.median(timings)), 4),
        "p95Milliseconds": round(float(np.quantile(timings, 0.95)), 4),
        "p99Milliseconds": round(float(np.quantile(timings, 0.99)), 4),
        "maximumMilliseconds": round(float(np.max(timings)), 4),
    }


def _digest_inputs(paths: Iterable[Path]) -> str:
    digest = hashlib.sha256()
    for path in sorted(paths):
        digest.update(path.relative_to(ROOT).as_posix().encode("utf-8"))
        digest.update(b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()


def _study_input_paths() -> Tuple[Path, ...]:
    candidates = [
        Path(__file__),
        ROOT / "model-lab" / "requirements.txt",
        API_ROOT / "requirements.txt",
        API_ROOT / "constraints.txt",
        *(API_ROOT / "app").glob("*.py"),
        *(ROOT / "policy-registry").rglob("*.json"),
        *(ROOT / "policy-registry").rglob("*.md"),
    ]
    return tuple(sorted({path.resolve() for path in candidates}))


def _file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--cases", type=int, default=2_000_000)
    parser.add_argument("--train-cases", type=int, default=400_000)
    parser.add_argument("--test-cases", type=int, default=500_000)
    parser.add_argument(
        "--workers", type=int, default=max(1, min(8, os.cpu_count() or 1))
    )
    parser.add_argument("--shard-size", type=int, default=20_000)
    parser.add_argument("--seed", type=int, default=20270713)
    parser.add_argument("--allow-small-report", action="store_true")
    parser.add_argument("--keep-work", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.cases < 10_000:
        raise SystemExit("--cases must be at least 10,000")
    if args.train_cases + args.test_cases > args.cases:
        raise SystemExit("train-cases + test-cases cannot exceed cases")
    if args.cases < 2_000_000 and not args.allow_small_report:
        raise SystemExit(
            "Reference report requires at least 2,000,000 households; use --allow-small-report for development only"
        )

    artifacts = ROOT / "model-lab" / "artifacts"
    work_dir = ROOT / "model-lab" / "work"
    artifacts.mkdir(parents=True, exist_ok=True)
    if work_dir.exists():
        shutil.rmtree(work_dir)
    work_dir.mkdir(parents=True)

    x, y, sweep = _generate_dataset(
        args.cases, args.workers, args.shard_size, args.seed, work_dir
    )
    rng = np.random.default_rng(args.seed + 1)
    indices = rng.choice(
        args.cases, size=args.train_cases + args.test_cases, replace=False
    )
    train_index = indices[: args.train_cases]
    test_index = indices[args.train_cases :]
    x_train = np.asarray(x[train_index])
    y_train = np.asarray(y[train_index])
    x_test = np.asarray(x[test_index])
    y_test = np.asarray(y[test_index])

    metrics, fitted = _fit_models(
        x_train, y_train, x_test, y_test, artifacts, args.seed
    )
    hist_models = fitted["hist_gradient_boosting"]
    baseline_hgb = hist_models[0]
    sensitivity = _sensitivity(baseline_hgb, x_test, y_test[:, 0], args.seed)
    latency = _single_prediction_latency(hist_models, x_test)
    surrogate_path = artifacts / "diagnostic-surrogate.joblib"

    study_inputs = _study_input_paths()
    report = {
        "schemaVersion": "1.0",
        "studyId": f"cifra-civica-statistical-study-{args.seed}",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "status": "reference" if args.cases >= 2_000_000 else "development-only",
        "purpose": "Validación, sensibilidad y aceleración experimental; el motor fiscal exacto sigue siendo la fuente de verdad.",
        "seed": args.seed,
        "inputFiles": [path.relative_to(ROOT).as_posix() for path in study_inputs],
        "inputDigestSha256": _digest_inputs(study_inputs),
        "coverage": {
            "syntheticHouseholdsEvaluated": args.cases,
            "exactScenarioEvaluations": sweep["scenarioEvaluations"],
            "policyIds": list(POLICY_IDS),
            "featureCount": len(FEATURES),
            "features": list(FEATURES),
            "targetCount": len(TARGETS),
            "targets": list(TARGETS),
            "trainHouseholds": args.train_cases,
            "holdoutHouseholds": args.test_cases,
        },
        "exactSweep": {
            **sweep,
            "householdsPerWallSecond": round(args.cases / sweep["wallSeconds"], 2),
            "meanExactScenarioMicroseconds": round(
                sweep["wallSeconds"]
                * args.workers
                * 1_000_000
                / sweep["scenarioEvaluations"],
                4,
            ),
            "invariantsPassed": sweep["familyReliefNonnegativeViolations"] == 0
            and sweep["childTransferExactViolations"] == 0,
        },
        "modelComparison": metrics,
        "selectedDiagnosticModel": {
            "name": "hist_gradient_boosting",
            "artifact": "diagnostic-surrogate.joblib",
            "artifactSha256": _file_sha256(surrogate_path),
            "artifactBytes": surrogate_path.stat().st_size,
            "authoritativeForPublicResults": False,
            "singlePredictionLatency": latency,
            "interactiveRecommendation": "Usar el motor fiscal exacto; es más rápido y no introduce error de aproximación.",
        },
        "baselineDisposableIncomeSensitivity": sensitivity,
        "environment": {
            "python": platform.python_version(),
            "platform": platform.platform(),
            "numpy": np.__version__,
            "scipy": scipy.__version__,
            "scikitLearn": sklearn.__version__,
            "joblib": joblib.__version__,
            "workers": args.workers,
        },
        "limitations": [
            "Los hogares son sintéticos y no representan microdatos del INE ni de la AEAT.",
            "La importancia por permutación describe este diseño de muestreo, no causalidad política.",
            "Los modelos estadísticos aproximan salidas del motor y nunca sustituyen sus reglas fechadas.",
            "La referencia 2027 arrastra parámetros oficiales revisados de 2025 y 2026 y debe actualizarse antes de uso electoral.",
        ],
    }
    report_path = artifacts / "study-report.json"
    report_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"wrote {report_path}")
    print(
        json.dumps(
            {
                "coverage": report["coverage"],
                "exactSweep": report["exactSweep"],
                "selected": report["selectedDiagnosticModel"],
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    if not args.keep_work:
        del x
        del y
        shutil.rmtree(work_dir)


if __name__ == "__main__":
    main()
