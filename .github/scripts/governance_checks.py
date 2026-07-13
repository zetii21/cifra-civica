#!/usr/bin/env python3
"""Dependency-light repository governance checks.

These checks are intentionally conservative and complement, rather than replace,
runtime privacy tests, fiscal review, jsonschema validation, and a dedicated
secret scanner in a release environment.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import os
import re
import subprocess
import sys
from datetime import date
from pathlib import Path
from typing import Any, Iterable, Optional
from urllib.parse import unquote


ROOT = Path(__file__).resolve().parents[2]
IGNORED_PARTS = {
    ".git",
    ".next",
    ".mypy_cache",
    ".vinext",
    ".venv",
    ".wrangler",
    "coverage",
    "coverage-api",
    "dist",
    "node_modules",
    "playwright-report",
    "test-results",
    "__pycache__",
}
TEXT_SUFFIXES = {
    ".css",
    ".html",
    ".js",
    ".json",
    ".jsx",
    ".md",
    ".mjs",
    ".py",
    ".sh",
    ".ts",
    ".tsx",
    ".txt",
    ".yaml",
    ".yml",
}
TEXT_NAMES = {
    ".dockerignore",
    ".env.example",
    ".gitignore",
    "Dockerfile",
    "LICENSE",
    "Makefile",
}


def fail(issues: Iterable[str]) -> None:
    collected = list(issues)
    if not collected:
        return
    for issue in collected:
        print(f"ERROR: {issue}", file=sys.stderr)
    raise SystemExit(1)


def relative(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def is_ignored(path: Path) -> bool:
    return bool(set(path.relative_to(ROOT).parts) & IGNORED_PARTS)


def text_files() -> Iterable[Path]:
    for path in sorted(ROOT.rglob("*")):
        if not path.is_file() or is_ignored(path):
            continue
        if path.suffix.lower() in TEXT_SUFFIXES or path.name in TEXT_NAMES:
            if path.stat().st_size <= 2_000_000:
                yield path


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def check_whitespace() -> None:
    issues: list[str] = []
    for path in text_files():
        content = read_text(path)
        if content and not content.endswith("\n"):
            issues.append(f"{relative(path)} has no final newline")
        for number, line in enumerate(content.splitlines(), start=1):
            if line.endswith((" ", "\t")):
                issues.append(f"{relative(path)}:{number} has trailing whitespace")
    fail(issues)
    print("Whitespace check passed")


REQUIRED_DOCS = {
    "README.md",
    "CONTRIBUTING.md",
    "CHANGELOG.md",
    "SECURITY.md",
    "LICENSE",
    ".env.example",
    "docs/architecture.md",
    "docs/accessibility.md",
    "docs/deployment.md",
    "docs/feedback-corrections.md",
    "docs/incident-response.md",
    "docs/observability.md",
    "docs/operations.md",
    "docs/policy-authoring.md",
    "docs/release-metadata.md",
    "docs/data-dictionary/README.md",
    "docs/methodology/data-sources.md",
    "docs/methodology/limitations.md",
    "docs/methodology/model.md",
    "docs/methodology/model-inventory.md",
    "docs/privacy/README.md",
    "docs/privacy/dpia.md",
    "docs/privacy/retention-matrix.md",
    "docs/security/security-checklist.md",
    "docs/security/dependency-exceptions.md",
    "docs/security/third-party-inventory.md",
    "docs/security/threat-model.md",
    "docs/validation/validation-plan.md",
    "docs/validation/statistical-lab.md",
}
MARKDOWN_LINK = re.compile(r"(?<!!)\[[^\]]+\]\(([^)]+)\)")


def check_docs() -> None:
    issues = [f"required documentation is missing: {item}" for item in sorted(REQUIRED_DOCS) if not (ROOT / item).exists()]
    for path in text_files():
        if path.suffix.lower() != ".md":
            continue
        for match in MARKDOWN_LINK.finditer(read_text(path)):
            raw_target = match.group(1).strip()
            if raw_target.startswith("<") and raw_target.endswith(">"):
                raw_target = raw_target[1:-1]
            raw_target = raw_target.split(maxsplit=1)[0]
            if raw_target.startswith(("http://", "https://", "mailto:", "#")):
                continue
            target_without_anchor = unquote(raw_target.split("#", 1)[0])
            if not target_without_anchor:
                continue
            target = (path.parent / target_without_anchor).resolve()
            try:
                target.relative_to(ROOT)
            except ValueError:
                issues.append(f"{relative(path)} links outside repository: {raw_target}")
                continue
            if not target.exists():
                issues.append(f"{relative(path)} has broken local link: {raw_target}")
    fail(issues)
    print(f"Documentation check passed ({len(REQUIRED_DOCS)} required artifacts)")


CODE_ROOTS = ("app", "worker", "services", "packages", "pipelines", "db")
SENSITIVE = (
    r"annualGross|annualRent|annualPension|annual.*Benefit|disability|"
    r"householdBenefits|dependants|municipalityCode|capitalIncome|"
    r"contributionBase|request\.body|response\.body|model_dump\("
)
LOG_CALL = re.compile(
    rf"(?is)(console\.(?:log|info|warn|error)|logger\.(?:debug|info|warning|error|exception)|"
    rf"logging\.(?:debug|info|warning|error|exception)|print|process\.stdout\.write)"
    rf"\s*\([^)]{{0,800}}(?:{SENSITIVE})"
)
URL_SENSITIVE = re.compile(
    rf"(?is)(?:searchParams|URLSearchParams|query)\s*[\s\S]{{0,300}}(?:{SENSITIVE})"
)
TRACKER = re.compile(
    r"(?i)(googletagmanager|google-analytics|doubleclick|facebook(?:\.net)?/tr|"
    r"hotjar|fullstory|mouseflow|mixpanel|segment\.com|clarity\.ms)"
)


def source_files() -> Iterable[Path]:
    for root_name in CODE_ROOTS:
        root = ROOT / root_name
        if not root.exists():
            continue
        for path in sorted(root.rglob("*")):
            if not path.is_file() or is_ignored(path):
                continue
            if "tests" in path.parts or "__snapshots__" in path.parts:
                continue
            if path.suffix.lower() in {".js", ".jsx", ".mjs", ".py", ".ts", ".tsx"}:
                yield path


def check_privacy() -> None:
    issues: list[str] = []
    for path in source_files():
        content = read_text(path)
        if LOG_CALL.search(content):
            issues.append(f"{relative(path)} may log a prohibited fiscal/household field")
        if URL_SENSITIVE.search(content):
            issues.append(f"{relative(path)} may place a fiscal/household field in a URL/query")
        if TRACKER.search(content):
            issues.append(f"{relative(path)} references a prohibited/unreviewed tracking endpoint")
        if path.parts[:1] == ("app",) and "localStorage" in content:
            issues.append(f"{relative(path)} uses localStorage; structured personal saves require explicit IndexedDB review")

    schema_path = ROOT / "db" / "schema.ts"
    if schema_path.exists() and re.search(SENSITIVE, read_text(schema_path), re.IGNORECASE):
        issues.append("db/schema.ts appears to define persistent personal fiscal fields")

    fail(issues)
    print("Static privacy regression check passed")


SECRET_PATTERNS = {
    "private key": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    "AWS access key": re.compile(r"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b"),
    "GitHub token": re.compile(r"\bgh[oprsu]_[A-Za-z0-9_]{30,}\b"),
    "OpenAI key": re.compile(r"\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b"),
    "Slack token": re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{20,}\b"),
}


def check_secrets() -> None:
    issues: list[str] = []
    for path in text_files():
        if path.name == ".env.example" or "docs" in path.parts or "fixtures" in path.parts:
            continue
        content = read_text(path)
        for label, pattern in SECRET_PATTERNS.items():
            if pattern.search(content):
                issues.append(f"{relative(path)} contains a possible {label}")
    fail(issues)
    print("Basic secret-pattern check passed")


def load_json(path: Path) -> Any:
    try:
        return json.loads(read_text(path))
    except (json.JSONDecodeError, UnicodeDecodeError) as error:
        raise ValueError(f"{relative(path)} is not valid JSON: {error}") from error


def check_policies() -> None:
    registry = ROOT / "policy-registry"
    issues: list[str] = []
    if not registry.is_dir():
        fail(["policy-registry directory is missing"])

    source_records: dict[str, dict[str, Any]] = {}
    for path in sorted((registry / "sources").glob("*.json")):
        try:
            record = load_json(path)
            source_records[str(record["id"])] = record
        except (ValueError, KeyError, TypeError) as error:
            issues.append(str(error))

    parameter_ids: set[str] = set()
    for path in sorted((registry / "parameters").glob("*.json")):
        try:
            parameter_ids.add(str(load_json(path)["id"]))
        except (ValueError, KeyError, TypeError) as error:
            issues.append(str(error))

    policies: dict[str, dict[str, Any]] = {}
    for directory in ("baseline", "scenarios"):
        for path in sorted((registry / directory).glob("*.json")):
            try:
                policy = load_json(path)
                policy_id = str(policy["id"])
            except (ValueError, KeyError, TypeError) as error:
                issues.append(str(error))
                continue
            if policy_id in policies:
                issues.append(f"duplicate policy id: {policy_id}")
            policies[policy_id] = policy

            if policy.get("published") and not policy.get("legalOrProposalSources"):
                issues.append(f"{policy_id}: published policy has no source")
            missing_sources = set(policy.get("legalOrProposalSources", [])) - set(source_records)
            if missing_sources:
                issues.append(f"{policy_id}: unknown sources {sorted(missing_sources)}")
            if policy.get("parameterSet") not in parameter_ids:
                issues.append(f"{policy_id}: unknown parameter set {policy.get('parameterSet')}")
            methodology = registry / str(policy.get("methodologyPath", ""))
            if policy.get("published") and not methodology.is_file():
                issues.append(f"{policy_id}: published policy has no methodology page")
            if policy.get("status") == "draft" and policy.get("published"):
                issues.append(f"{policy_id}: a draft cannot be published")
            if policy.get("status") == "validated" and policy.get("validationStatus") not in {
                "aggregate_tested",
                "production_validated",
            }:
                issues.append(f"{policy_id}: validated label lacks aggregate/production evidence")
            if policy.get("isSynthetic"):
                public_text = f"{policy.get('publicName', '')} {policy.get('shortDescription', '')}".lower()
                if "demo" not in public_text or ("no es" not in public_text and "not official" not in public_text):
                    issues.append(f"{policy_id}: synthetic policy lacks an explicit DEMO/not-official label")
            try:
                start = date.fromisoformat(str(policy["effectiveFrom"]))
                end_raw = policy.get("effectiveTo")
                if end_raw and date.fromisoformat(str(end_raw)) < start:
                    issues.append(f"{policy_id}: effectiveTo precedes effectiveFrom")
            except (KeyError, ValueError):
                issues.append(f"{policy_id}: invalid effective date")

    root_baselines = [
        policy for policy in policies.values()
        if policy.get("published") and policy.get("inheritedBaseline") is None
    ]
    if len(root_baselines) != 1:
        issues.append(f"expected exactly one published root baseline, found {len(root_baselines)}")
    for policy_id, policy in policies.items():
        parent = policy.get("inheritedBaseline")
        if parent is not None and parent not in policies:
            issues.append(f"{policy_id}: unknown inherited baseline {parent}")

    official_invalid = [
        source_id
        for source_id, record in source_records.items()
        if record.get("sourceType") != "synthetic_methodology"
        and str(record.get("url", "")).endswith(".invalid")
    ]
    if official_invalid:
        issues.append(f"official source records use placeholder URLs: {official_invalid}")

    # The runtime loader performs full jsonschema and cross-reference checks.
    api_path = ROOT / "services" / "simulation-api"
    if (api_path / "app" / "registry.py").is_file() and importlib.util.find_spec("jsonschema"):
        snippet = (
            "from pathlib import Path;"
            "from app.config import Settings;"
            "from app.registry import PolicyRegistry;"
            f"root=Path({str(registry)!r});"
            "settings=Settings(app_environment='test',policy_registry_path=root,"
            "enable_synthetic_scenarios=True,allow_synthetic_in_production=False,"
            "enable_calculation_trace=False,calculation_timeout_seconds=10,"
            "max_request_bytes=65536,model_version='governance-check',api_contract_version='v1',"
            "cors_origins=());"
            "PolicyRegistry(settings)"
        )
        completed = subprocess.run(
            [sys.executable, "-c", snippet],
            cwd=api_path,
            text=True,
            capture_output=True,
            check=False,
        )
        if completed.returncode:
            issues.append(f"runtime policy validation failed: {completed.stderr.strip()}")

    fail(issues)
    print(
        f"Policy validation passed ({len(policies)} policies, "
        f"{len(parameter_ids)} parameter sets, {len(source_records)} sources)"
    )


RELEASE_REQUIRED = {
    "schemaVersion",
    "applicationVersion",
    "sourceCommit",
    "contractVersion",
    "calculationBackend",
    "modelVersion",
    "policyRegistryCommit",
    "dataPipelineVersion",
    "geographyVersion",
    "buildDate",
    "syntheticFixturesEnabled",
    "artifactDigests",
    "modelInventory",
    "validationSummary",
    "knownLimitations",
}
INVENTORY_REQUIRED = {
    "namedVariables",
    "executableFormulas",
    "datedParameterValues",
    "publishedBaselines",
    "publishedScenarios",
    "publishedSyntheticScenarios",
    "sourceRecords",
    "goldenCases",
    "aggregateBenchmarks",
    "addressableValidationStates",
}


def check_release() -> None:
    issues: list[str] = []
    environment = os.getenv("APP_ENV", "development").lower()
    synthetic = os.getenv("ENABLE_SYNTHETIC_SCENARIOS", "true").lower() in {"1", "true", "yes"}
    allow_synthetic = os.getenv("ALLOW_SYNTHETIC_SCENARIOS_IN_PRODUCTION", "false").lower() in {
        "1",
        "true",
        "yes",
    }
    traces = os.getenv("ENABLE_CALCULATION_TRACE", "false").lower() in {"1", "true", "yes"}
    if environment == "production":
        if synthetic and not allow_synthetic:
            issues.append("production enables synthetic scenarios without explicit acknowledgement")
        if traces:
            issues.append("production enables calculation traces")

    api_dir = ROOT / "services" / "simulation-api"
    manifest = api_dir / "model-manifest.json"
    if (api_dir / "app" / "manifest.py").is_file():
        if not manifest.is_file():
            issues.append("app.manifest exists but services/simulation-api/model-manifest.json is missing")
        else:
            manifest_environment = os.environ.copy()
            manifest_environment.update(
                {
                    "APP_ENV": "test",
                    "ENABLE_SYNTHETIC_SCENARIOS": "true",
                    "ALLOW_SYNTHETIC_SCENARIOS_IN_PRODUCTION": "false",
                }
            )
            completed = subprocess.run(
                [sys.executable, "-m", "app.manifest", "--check", str(manifest)],
                cwd=api_dir,
                text=True,
                capture_output=True,
                check=False,
                env=manifest_environment,
            )
            if completed.returncode:
                issues.append(f"model manifest drift: {completed.stderr.strip() or completed.stdout.strip()}")

    metadata_path = os.getenv("RELEASE_METADATA_PATH")
    coverage_path = ROOT / "model-manifest" / "coverage.json"
    coverage_count: Optional[int] = None
    if coverage_path.is_file():
        try:
            coverage = load_json(coverage_path)
            coverage_count = int(coverage["declaredStateCount"])
            dimensions = coverage["dimensions"]
            computed = 1
            for dimension in dimensions.values():
                computed *= int(dimension["count"])
            if computed != coverage_count:
                issues.append(
                    f"coverage manifest drift: declared {coverage_count}, computed {computed}"
                )
            target = coverage["targetRange"]
            if not int(target["minimum"]) <= coverage_count <= int(target["maximum"]):
                issues.append("coverage manifest count is outside its declared target range")
        except (ValueError, KeyError, TypeError) as error:
            issues.append(f"invalid coverage manifest: {error}")
    if metadata_path:
        path = Path(metadata_path)
        if not path.is_absolute():
            path = ROOT / path
        try:
            metadata = load_json(path)
            missing = RELEASE_REQUIRED - set(metadata)
            if missing:
                issues.append(f"release metadata missing fields: {sorted(missing)}")
            if metadata.get("calculationBackend") not in {"python_api", "edge_api"}:
                issues.append("release metadata calculationBackend must be python_api or edge_api")
            inventory = metadata.get("modelInventory", {})
            missing_inventory = INVENTORY_REQUIRED - set(inventory)
            if missing_inventory:
                issues.append(f"model inventory missing exact counts: {sorted(missing_inventory)}")
            for key in INVENTORY_REQUIRED & set(inventory):
                if not isinstance(inventory[key], int) or inventory[key] < 0:
                    issues.append(f"model inventory {key} must be a non-negative integer")
            backend = metadata.get("calculationBackend")
            state_count = inventory.get("addressableValidationStates")
            if backend == "python_api" and coverage_count is not None and state_count != coverage_count:
                issues.append("python_api release metadata state count does not match coverage manifest")
            if backend == "edge_api":
                if state_count != 0:
                    issues.append("edge_api cannot claim the python_api addressable state count")
                if metadata.get("validationSummary", {}).get("status") != "not_assessed":
                    issues.append("edge_api validation must remain not_assessed until separate evidence exists")
                if not metadata.get("knownLimitations"):
                    issues.append("edge_api release metadata must publish a known limitation")
            if environment == "production" and metadata.get("syntheticFixturesEnabled") is not False:
                issues.append("production release metadata reports synthetic fixtures enabled")
        except (ValueError, OSError) as error:
            issues.append(str(error))

    fail(issues)
    print("Release-governance check passed")


COMMANDS = {
    "docs": check_docs,
    "policies": check_policies,
    "privacy": check_privacy,
    "release": check_release,
    "secrets": check_secrets,
    "whitespace": check_whitespace,
}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("check", choices=sorted(COMMANDS))
    args = parser.parse_args()
    COMMANDS[args.check]()


if __name__ == "__main__":
    main()
