"""Environment configuration with conservative production defaults."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, Tuple


def _as_bool(value: Optional[str], *, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    app_environment: str
    policy_registry_path: Path
    enable_synthetic_scenarios: bool
    allow_synthetic_in_production: bool
    enable_calculation_trace: bool
    calculation_timeout_seconds: float
    max_request_bytes: int
    model_version: str
    api_contract_version: str
    cors_origins: Tuple[str, ...]

    @property
    def is_production(self) -> bool:
        return self.app_environment == "production"

    @property
    def traces_enabled(self) -> bool:
        return self.enable_calculation_trace and not self.is_production


def load_settings() -> Settings:
    repository_root = Path(__file__).resolve().parents[3]
    environment = os.getenv("APP_ENV", "development").strip().lower()
    if environment not in {"development", "test", "production"}:
        raise ValueError("APP_ENV must be development, test, or production")

    default_cors = "http://localhost:3000" if environment != "production" else ""
    cors_origins = tuple(
        origin.strip().rstrip("/") for origin in os.getenv("CORS_ORIGINS", default_cors).split(",") if origin.strip()
    )
    if "*" in cors_origins or any(not origin.startswith(("http://", "https://")) for origin in cors_origins):
        raise ValueError("CORS_ORIGINS must contain explicit http(s) origins; wildcard is forbidden")

    return Settings(
        app_environment=environment,
        policy_registry_path=Path(os.getenv("POLICY_REGISTRY_PATH", repository_root / "policy-registry")).resolve(),
        enable_synthetic_scenarios=_as_bool(
            os.getenv("ENABLE_SYNTHETIC_SCENARIOS"), default=environment != "production"
        ),
        allow_synthetic_in_production=_as_bool(os.getenv("ALLOW_SYNTHETIC_SCENARIOS_IN_PRODUCTION"), default=False),
        enable_calculation_trace=_as_bool(os.getenv("ENABLE_CALCULATION_TRACE"), default=environment != "production"),
        calculation_timeout_seconds=float(os.getenv("CALCULATION_TIMEOUT_SECONDS", "10")),
        max_request_bytes=int(os.getenv("MAX_REQUEST_BYTES", "65536")),
        model_version=os.getenv("MODEL_VERSION", "es-fiscal-reference-0.1.0"),
        api_contract_version="v1",
        cors_origins=cors_origins,
    )
