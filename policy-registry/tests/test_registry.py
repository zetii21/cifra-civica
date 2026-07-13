from __future__ import annotations

import json
import shutil
from dataclasses import replace

import pytest

from app.registry import PolicyRegistry, RegistryConfigurationError, RegistryError


def test_registry_validates_every_checked_in_entry(registry):
    assert registry.baseline.id == "baseline-2027-common-reference"
    assert len(registry.public_policies()) == 3
    assert len(registry.registry_version) == 16


def test_every_published_policy_has_sources_and_methodology(registry):
    for policy in registry.public_policies():
        assert registry.source_references(policy)
        methodology = registry.root / policy.raw["methodologyPath"]
        assert methodology.is_file()
        assert methodology.read_text(encoding="utf-8").startswith("#")


def test_synthetic_scenarios_are_unambiguously_labelled(registry):
    synthetic = [policy for policy in registry.public_policies() if policy.is_synthetic]
    assert len(synthetic) == 2
    for policy in synthetic:
        assert policy.raw["publicName"].startswith("DEMO —")
        assert "no es" in " ".join(policy.raw["knownLimitations"]).casefold()


def test_reference_records_carry_forward_and_high_uncertainty(registry):
    baseline = registry.baseline
    assert baseline.raw["carryForwardFromTaxYear"] == 2026
    assert baseline.raw["uncertaintyStatus"] == "high"
    assert baseline.raw["status"] == "simulated"
    assert "2027" in baseline.raw["publicName"]


def test_parameter_vintages_are_explicit(registry):
    review = registry.parameter_review_dates
    assert review["reviewedAt"] == "2026-07-13"
    assert review["referenceTaxYears"] == {
        "stateIrpf": 2026,
        "autonomousIrpf": 2025,
        "socialSecurity": 2026,
    }


def test_production_requires_explicit_acknowledgement_for_synthetic(settings):
    unsafe = replace(
        settings,
        app_environment="production",
        enable_synthetic_scenarios=True,
        allow_synthetic_in_production=False,
    )
    with pytest.raises(RegistryConfigurationError):
        PolicyRegistry(unsafe)


def test_missing_source_reference_fails_registry_load(settings, tmp_path):
    copied = tmp_path / "policy-registry"
    shutil.copytree(settings.policy_registry_path, copied)
    scenario_path = copied / "scenarios" / "demo-child-transfer-2027.json"
    scenario = json.loads(scenario_path.read_text(encoding="utf-8"))
    scenario["legalOrProposalSources"] = ["source-not-real"]
    scenario_path.write_text(json.dumps(scenario), encoding="utf-8")
    with pytest.raises(RegistryError, match="unknown sources"):
        PolicyRegistry(replace(settings, policy_registry_path=copied))


def test_public_draft_fails_registry_load(settings, tmp_path):
    copied = tmp_path / "policy-registry"
    shutil.copytree(settings.policy_registry_path, copied)
    scenario_path = copied / "scenarios" / "demo-child-transfer-2027.json"
    scenario = json.loads(scenario_path.read_text(encoding="utf-8"))
    scenario["status"] = "draft"
    scenario_path.write_text(json.dumps(scenario), encoding="utf-8")
    with pytest.raises(RegistryError, match="cannot be public"):
        PolicyRegistry(replace(settings, policy_registry_path=copied))


def test_inheritance_cycle_fails_registry_load(settings, tmp_path):
    copied = tmp_path / "policy-registry"
    shutil.copytree(settings.policy_registry_path, copied)
    baseline_path = copied / "baseline" / "baseline-2027-common-reference.json"
    baseline = json.loads(baseline_path.read_text(encoding="utf-8"))
    baseline["inheritedBaseline"] = "demo-child-transfer-2027"
    baseline_path.write_text(json.dumps(baseline), encoding="utf-8")
    with pytest.raises(RegistryError, match="cycle"):
        PolicyRegistry(replace(settings, policy_registry_path=copied))
