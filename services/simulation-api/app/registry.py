"""Git-backed, schema-validated policy registry loader."""

from __future__ import annotations

import copy
import hashlib
import json
from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

from jsonschema import Draft202012Validator, FormatChecker

from .config import Settings


class RegistryError(RuntimeError):
    """The checked-in policy registry is invalid or incomplete."""


class RegistryConfigurationError(RegistryError):
    """Runtime policy publication settings are unsafe."""


@dataclass(frozen=True)
class PolicyEntry:
    raw: Mapping[str, Any]

    @property
    def id(self) -> str:
        return str(self.raw["id"])

    @property
    def tax_year(self) -> int:
        return int(self.raw["taxYear"])

    @property
    def is_synthetic(self) -> bool:
        return bool(self.raw["isSynthetic"])

    @property
    def inherited_baseline(self) -> Optional[str]:
        value = self.raw["inheritedBaseline"]
        return str(value) if value is not None else None

    def public_dict(self) -> Dict[str, Any]:
        return copy.deepcopy(dict(self.raw))


def _read_json(path: Path) -> Dict[str, Any]:
    try:
        with path.open("r", encoding="utf-8") as handle:
            value = json.load(handle)
    except (OSError, json.JSONDecodeError) as exc:
        raise RegistryError(f"Cannot load registry file {path.name}: {exc}") from exc
    if not isinstance(value, dict):
        raise RegistryError(f"Registry file {path.name} must contain a JSON object")
    return value


def _validate_json(instance: Mapping[str, Any], schema: Mapping[str, Any], path: Path) -> None:
    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    errors = sorted(validator.iter_errors(instance), key=lambda error: list(error.path))
    if errors:
        first = errors[0]
        location = ".".join(str(part) for part in first.path) or "<root>"
        raise RegistryError(f"{path.name}: {location}: {first.message}")


def _deep_merge(base: Mapping[str, Any], override: Mapping[str, Any]) -> Dict[str, Any]:
    result = copy.deepcopy(dict(base))
    for key, value in override.items():
        if isinstance(value, Mapping) and isinstance(result.get(key), Mapping):
            result[key] = _deep_merge(result[key], value)
        else:
            result[key] = copy.deepcopy(value)
    return result


class PolicyRegistry:
    """Immutable registry view for one process.

    Personal requests are never written here. Only public, version-controlled policy
    metadata and parameters are loaded.
    """

    def __init__(self, settings: Settings):
        self.settings = settings
        self.root = settings.policy_registry_path
        if settings.is_production and settings.enable_synthetic_scenarios:
            if not settings.allow_synthetic_in_production:
                raise RegistryConfigurationError(
                    "Synthetic scenarios cannot be enabled in production without the explicit "
                    "ALLOW_SYNTHETIC_SCENARIOS_IN_PRODUCTION acknowledgement"
                )

        self._policy_schema = _read_json(self.root / "schemas" / "policy.schema.json")
        self._source_schema = _read_json(self.root / "schemas" / "source.schema.json")
        self._parameter_schema = _read_json(self.root / "schemas" / "parameters.schema.json")
        self._sources = self._load_sources()
        self._parameter_sets = self._load_parameters()
        self._policies = self._load_policies()
        self._validate_cross_references()
        self.registry_version = self._calculate_version()

    def _load_sources(self) -> Dict[str, Dict[str, Any]]:
        sources: Dict[str, Dict[str, Any]] = {}
        for path in sorted((self.root / "sources").glob("*.json")):
            source = _read_json(path)
            _validate_json(source, self._source_schema, path)
            source_id = str(source["id"])
            if source_id in sources:
                raise RegistryError(f"Duplicate source id: {source_id}")
            sources[source_id] = source
        if not sources:
            raise RegistryError("Policy registry has no source records")
        return sources

    def _load_parameters(self) -> Dict[str, Dict[str, Any]]:
        parameter_sets: Dict[str, Dict[str, Any]] = {}
        for path in sorted((self.root / "parameters").glob("*.json")):
            parameters = _read_json(path)
            _validate_json(parameters, self._parameter_schema, path)
            parameter_id = str(parameters["id"])
            if parameter_id in parameter_sets:
                raise RegistryError(f"Duplicate parameter set id: {parameter_id}")
            self._validate_parameter_invariants(parameters, path)
            parameter_sets[parameter_id] = parameters
        if not parameter_sets:
            raise RegistryError("Policy registry has no parameter sets")
        return parameter_sets

    @staticmethod
    def _validate_scale(scale: Any, label: str, path: Path) -> None:
        if not isinstance(scale, list) or not scale:
            raise RegistryError(f"{path.name}: {label} must be a non-empty list")
        thresholds: List[int] = []
        for bracket in scale:
            if not isinstance(bracket, dict):
                raise RegistryError(f"{path.name}: {label} bracket must be an object")
            threshold = bracket.get("thresholdCents")
            rate = bracket.get("rateBasisPoints")
            if not isinstance(threshold, int) or threshold < 0:
                raise RegistryError(f"{path.name}: {label} has an invalid threshold")
            if not isinstance(rate, int) or not 0 <= rate <= 10_000:
                raise RegistryError(f"{path.name}: {label} has an invalid rate")
            thresholds.append(threshold)
        if thresholds[0] != 0 or thresholds != sorted(set(thresholds)):
            raise RegistryError(f"{path.name}: {label} thresholds must start at zero and increase")

    def _validate_parameter_invariants(self, parameters: Mapping[str, Any], path: Path) -> None:
        irpf = parameters["irpf"]
        self._validate_scale(irpf["stateGeneralScale"], "stateGeneralScale", path)
        self._validate_scale(irpf["stateSavingsScale"], "stateSavingsScale", path)
        self._validate_scale(irpf["autonomousSavingsScale"], "autonomousSavingsScale", path)
        expected_common_codes = {
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
        }
        scales = irpf["autonomousGeneralScales"]
        if set(scales) != expected_common_codes:
            raise RegistryError(f"{path.name}: autonomous scales must cover common-regime CCAA")
        for community_code, scale in scales.items():
            self._validate_scale(scale, f"autonomousGeneralScales.{community_code}", path)

        referenced_sources = parameters["sources"]
        missing = set(referenced_sources) - set(self._sources)
        if missing:
            raise RegistryError(f"{path.name}: unknown source ids: {sorted(missing)}")

    def _load_policies(self) -> Dict[str, PolicyEntry]:
        policies: Dict[str, PolicyEntry] = {}
        paths: Iterable[Path] = list(sorted((self.root / "baseline").glob("*.json"))) + list(
            sorted((self.root / "scenarios").glob("*.json"))
        )
        for path in paths:
            policy = _read_json(path)
            _validate_json(policy, self._policy_schema, path)
            policy_id = str(policy["id"])
            if policy_id in policies:
                raise RegistryError(f"Duplicate policy id: {policy_id}")
            if policy["status"] == "draft" and policy["published"]:
                raise RegistryError(f"Draft policy {policy_id} cannot be public")
            if policy["status"] == "validated" and policy["validationStatus"] not in {
                "aggregate_tested",
                "production_validated",
            }:
                raise RegistryError(f"Validated policy {policy_id} lacks required validation")
            policies[policy_id] = PolicyEntry(raw=policy)
        if not policies:
            raise RegistryError("Policy registry has no policies")
        return policies

    def _validate_cross_references(self) -> None:
        for policy in self._policies.values():
            raw = policy.raw
            if raw["parameterSet"] not in self._parameter_sets:
                raise RegistryError(f"Policy {policy.id} references an unknown parameter set")
            missing_sources = set(raw["legalOrProposalSources"]) - set(self._sources)
            if missing_sources:
                raise RegistryError(f"Policy {policy.id} has unknown sources: {sorted(missing_sources)}")
            methodology_path = self.root / str(raw["methodologyPath"])
            if raw["published"] and not methodology_path.is_file():
                raise RegistryError(f"Published policy {policy.id} has no methodology page")
            if policy.inherited_baseline and policy.inherited_baseline not in self._policies:
                raise RegistryError(f"Policy {policy.id} inherits an unknown baseline")
            self._assert_no_cycle(policy.id, set())

    def _assert_no_cycle(self, policy_id: str, visited: Set[str]) -> None:
        if policy_id in visited:
            raise RegistryError(f"Policy inheritance cycle involving {policy_id}")
        parent = self._policies[policy_id].inherited_baseline
        if parent is not None:
            self._assert_no_cycle(parent, visited | {policy_id})

    def _calculate_version(self) -> str:
        digest = hashlib.sha256()
        registry_files = (
            ("baseline", "*.json"),
            ("scenarios", "*.json"),
            ("parameters", "*.json"),
            ("sources", "*.json"),
            ("schemas", "*.json"),
            ("methodology", "*.md"),
        )
        for directory, pattern in registry_files:
            for path in sorted((self.root / directory).glob(pattern)):
                digest.update(path.relative_to(self.root).as_posix().encode("utf-8"))
                digest.update(path.read_bytes())
        return digest.hexdigest()[:16]

    @property
    def baseline(self) -> PolicyEntry:
        candidates = [
            policy
            for policy in self._policies.values()
            if policy.inherited_baseline is None and policy.raw["published"]
        ]
        if len(candidates) != 1:
            raise RegistryError("Exactly one published root baseline is required")
        return candidates[0]

    def public_policies(self) -> List[PolicyEntry]:
        policies = [
            policy
            for policy in self._policies.values()
            if policy.raw["published"]
            and policy.raw["status"] != "draft"
            and (self.settings.enable_synthetic_scenarios or not policy.is_synthetic)
        ]
        return sorted(policies, key=lambda policy: (policy.inherited_baseline is not None, policy.id))

    def get_policy(self, policy_id: str, *, public_only: bool = True) -> PolicyEntry:
        policy = self._policies.get(policy_id)
        if policy is None:
            raise KeyError(policy_id)
        if public_only:
            if not policy.raw["published"] or policy.raw["status"] == "draft":
                raise KeyError(policy_id)
            if policy.is_synthetic and not self.settings.enable_synthetic_scenarios:
                raise KeyError(policy_id)
        return policy

    def resolve_parameters(self, policy_id: str) -> Dict[str, Any]:
        policy = self.get_policy(policy_id)
        chain: List[PolicyEntry] = []
        cursor: Optional[PolicyEntry] = policy
        while cursor is not None:
            chain.append(cursor)
            parent_id = cursor.inherited_baseline
            cursor = self._policies[parent_id] if parent_id is not None else None
        chain.reverse()
        parameters = copy.deepcopy(self._parameter_sets[str(chain[0].raw["parameterSet"])])
        for chain_policy in chain:
            parameters = _deep_merge(parameters, chain_policy.raw["parameterOverrides"])
        return parameters

    def source_references(self, policy: PolicyEntry) -> List[Dict[str, Any]]:
        source_ids: List[str] = []
        cursor: Optional[PolicyEntry] = policy
        chain: List[PolicyEntry] = []
        while cursor is not None:
            chain.append(cursor)
            parent_id = cursor.inherited_baseline
            cursor = self._policies[parent_id] if parent_id else None
        for chain_policy in reversed(chain):
            for source_id in chain_policy.raw["legalOrProposalSources"]:
                if source_id not in source_ids:
                    source_ids.append(source_id)
        return [copy.deepcopy(self._sources[source_id]) for source_id in source_ids]

    @property
    def parameter_review_dates(self) -> Dict[str, Any]:
        baseline_parameters = self.resolve_parameters(self.baseline.id)
        return {
            "reviewedAt": baseline_parameters["reviewedAt"],
            "referenceTaxYears": copy.deepcopy(baseline_parameters["referenceTaxYears"]),
        }
