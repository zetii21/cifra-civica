"""Generated and verifiable model inventory."""

from __future__ import annotations

import argparse
import ast
import json
from collections.abc import Iterable, Mapping
from pathlib import Path
from typing import Any, Dict

from .config import Settings, load_settings
from .engine import FORMULA_REGISTRY, NAMED_VARIABLES
from .registry import PolicyRegistry


def _numeric_leaf_count(value: Any) -> int:
    if isinstance(value, bool):
        return 0
    if isinstance(value, int):
        return 1
    if isinstance(value, Mapping):
        return sum(_numeric_leaf_count(child) for child in value.values())
    if isinstance(value, list):
        return sum(_numeric_leaf_count(child) for child in value)
    return 0


def _test_function_count(paths: Iterable[Path]) -> int:
    count = 0
    for path in paths:
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        count += sum(
            isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name.startswith("test_")
            for node in ast.walk(tree)
        )
    return count


def _record_count(paths: Iterable[Path], collection_key: str) -> int:
    count = 0
    for path in paths:
        payload = json.loads(path.read_text(encoding="utf-8"))
        records = payload.get(collection_key, [])
        if not isinstance(records, list):
            raise ValueError(f"{path} must contain a {collection_key} array")
        count += len(records)
    return count


def build_manifest(registry: PolicyRegistry, settings: Settings) -> Dict[str, Any]:
    parameter_paths = sorted((registry.root / "parameters").glob("*.json"))
    base_parameter_values = 0
    for path in parameter_paths:
        payload = json.loads(path.read_text(encoding="utf-8"))
        base_parameter_values += sum(
            _numeric_leaf_count(payload[section]) for section in ("irpf", "socialSecurity", "benefits")
        )
    policy_paths = list((registry.root / "baseline").glob("*.json")) + list(
        (registry.root / "scenarios").glob("*.json")
    )
    override_parameter_values = 0
    published_policy_payloads = []
    for path in policy_paths:
        payload = json.loads(path.read_text(encoding="utf-8"))
        override_parameter_values += _numeric_leaf_count(payload["parameterOverrides"])
        if payload["published"] and payload["status"] != "draft":
            published_policy_payloads.append(payload)

    service_root = Path(__file__).resolve().parents[1]
    repository_root = service_root.parents[1]
    test_paths = list((service_root / "tests").glob("test_*.py")) + list(
        (repository_root / "policy-registry" / "tests").glob("test_*.py")
    )
    published_baselines = sum(payload["inheritedBaseline"] is None for payload in published_policy_payloads)
    published_scenarios = sum(payload["inheritedBaseline"] is not None for payload in published_policy_payloads)
    published_synthetic_scenarios = sum(
        payload["inheritedBaseline"] is not None and payload["isSynthetic"] for payload in published_policy_payloads
    )
    golden_case_paths = list((registry.root / "tests").glob("golden-cases*.json"))
    aggregate_benchmark_paths = list((registry.root / "tests").glob("aggregate-benchmarks*.json"))
    return {
        "manifestVersion": 1,
        "modelVersion": settings.model_version,
        "apiContractVersion": settings.api_contract_version,
        "policyRegistryVersion": registry.registry_version,
        "counts": {
            "namedVariables": len(NAMED_VARIABLES),
            "executableFormulas": len(FORMULA_REGISTRY),
            "datedParameterValues": base_parameter_values + override_parameter_values,
            "baseParameterValues": base_parameter_values,
            "scenarioOverrideValues": override_parameter_values,
            "parameterSets": len(parameter_paths),
            "publishedPolicies": len(published_policy_payloads),
            "publishedBaselines": published_baselines,
            "publishedScenarios": published_scenarios,
            "publishedSyntheticScenarios": published_synthetic_scenarios,
            "sourceRecords": len(list((registry.root / "sources").glob("*.json"))),
            "goldenCases": _record_count(golden_case_paths, "goldenCases"),
            "aggregateBenchmarks": _record_count(aggregate_benchmark_paths, "aggregateBenchmarks"),
            "testFunctions": _test_function_count(test_paths),
        },
        "namedVariables": list(NAMED_VARIABLES),
        "formulaIds": sorted(FORMULA_REGISTRY),
        "countingNotes": [
            "datedParameterValues counts integer leaves under irpf, socialSecurity, "
            "benefits, and scenario parameterOverrides",
            "testFunctions counts Python functions whose names start with test_; "
            "parametrized executions are not inflated",
            "goldenCases and aggregateBenchmarks count only checked machine-readable "
            "artifacts, not ordinary unit tests",
            "counts are generated from the checked-in registry and executable formula decorators",
        ],
    }


def _canonical_json(value: Mapping[str, Any]) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate or verify the fiscal model manifest")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--write", type=Path)
    group.add_argument("--check", type=Path)
    args = parser.parse_args()

    settings = load_settings()
    registry = PolicyRegistry(settings)
    rendered = _canonical_json(build_manifest(registry, settings))
    if args.write:
        args.write.write_text(rendered, encoding="utf-8")
        return 0
    existing = args.check.read_text(encoding="utf-8")
    if existing != rendered:
        print("Model manifest is stale. Regenerate it with --write.")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
