from __future__ import annotations

import json
from dataclasses import replace

from app.engine import FORMULA_REGISTRY, NAMED_VARIABLES
from app.manifest import build_manifest
from app.registry import PolicyRegistry


def test_manifest_counts_are_generated_from_runtime(registry, settings):
    manifest = build_manifest(registry, settings)
    counts = manifest["counts"]
    assert counts["namedVariables"] == len(NAMED_VARIABLES)
    assert counts["executableFormulas"] == len(FORMULA_REGISTRY)
    assert counts["datedParameterValues"] == (counts["baseParameterValues"] + counts["scenarioOverrideValues"])
    assert counts["publishedBaselines"] == 1
    assert counts["publishedScenarios"] == 2
    assert counts["goldenCases"] == 0
    assert counts["aggregateBenchmarks"] == 0


def test_checked_in_manifest_matches_generated_inventory(registry, settings):
    manifest_path = settings.policy_registry_path.parent / "services" / "simulation-api" / "model-manifest.json"
    checked_in = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert checked_in == build_manifest(registry, settings)


def test_manifest_inventory_is_environment_invariant(registry, settings):
    production_settings = replace(
        settings,
        app_environment="production",
        enable_synthetic_scenarios=False,
        allow_synthetic_in_production=False,
    )
    production_registry = PolicyRegistry(production_settings)
    assert build_manifest(production_registry, production_settings) == build_manifest(registry, settings)
