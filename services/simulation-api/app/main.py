"""FastAPI application for Cifra Civica's ephemeral fiscal calculations."""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, Query, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import Settings, load_settings
from .engine import DomainError, FiscalEngine
from .manifest import build_manifest
from .middleware import PrivacySafeAccessLogMiddleware, RequestSizeLimitMiddleware
from .models import ComparisonRequest, SafeError, SimulationComparison
from .registry import PolicyRegistry

logger = logging.getLogger("cifra_civica.api")


COMMUNITIES: Dict[str, Dict[str, Any]] = {
    "01": {"name": "Andalucía", "fiscalRegime": "common", "calculationSupport": "supported"},
    "02": {"name": "Aragón", "fiscalRegime": "common", "calculationSupport": "supported"},
    "03": {
        "name": "Principado de Asturias",
        "fiscalRegime": "common",
        "calculationSupport": "supported",
    },
    "04": {"name": "Illes Balears", "fiscalRegime": "common", "calculationSupport": "supported"},
    "05": {"name": "Canarias", "fiscalRegime": "common", "calculationSupport": "partial"},
    "06": {"name": "Cantabria", "fiscalRegime": "common", "calculationSupport": "supported"},
    "07": {"name": "Castilla y León", "fiscalRegime": "common", "calculationSupport": "supported"},
    "08": {
        "name": "Castilla-La Mancha",
        "fiscalRegime": "common",
        "calculationSupport": "supported",
    },
    "09": {"name": "Cataluña", "fiscalRegime": "common", "calculationSupport": "supported"},
    "10": {
        "name": "Comunitat Valenciana",
        "fiscalRegime": "common",
        "calculationSupport": "supported",
    },
    "11": {"name": "Extremadura", "fiscalRegime": "common", "calculationSupport": "supported"},
    "12": {"name": "Galicia", "fiscalRegime": "common", "calculationSupport": "supported"},
    "13": {
        "name": "Comunidad de Madrid",
        "fiscalRegime": "common",
        "calculationSupport": "supported",
    },
    "14": {"name": "Región de Murcia", "fiscalRegime": "common", "calculationSupport": "supported"},
    "15": {
        "name": "Comunidad Foral de Navarra",
        "fiscalRegime": "foral_navarre",
        "calculationSupport": "unsupported",
    },
    "16": {
        "name": "País Vasco",
        "fiscalRegime": "foral_basque",
        "calculationSupport": "unsupported",
    },
    "17": {"name": "La Rioja", "fiscalRegime": "common", "calculationSupport": "supported"},
    "18": {"name": "Ceuta", "fiscalRegime": "special", "calculationSupport": "unsupported"},
    "19": {"name": "Melilla", "fiscalRegime": "special", "calculationSupport": "unsupported"},
}


MAP_METRICS: Dict[str, Dict[str, Any]] = {
    "official-income-context": {
        "id": "official-income-context",
        "publicName": "Contexto oficial de renta",
        "dataClass": "official",
        "availability": "metadata_only",
        "unit": "euro",
        "warning": (
            "Los valores y geometrías se publican mediante el pipeline geográfico, no desde solicitudes personales."
        ),
    },
    "demo-disposable-impact": {
        "id": "demo-disposable-impact",
        "publicName": "DEMO — impacto fiscal territorial sintético",
        "dataClass": "synthetic_demo",
        "availability": "metadata_only",
        "unit": "euro_per_household_year",
        "warning": (
            "DEMO — sin valores agregados publicados hasta completar calibración, "
            "incertidumbre y controles de divulgación."
        ),
    },
}


def _request_id(request: Request) -> str:
    return str(request.scope.get("state", {}).get("request_id", "unknown"))


def _error_response(error: SafeError, status_code: int) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content=error.model_dump(by_alias=True, exclude_none=True),
        headers={"Cache-Control": "no-store"},
    )


def create_app(
    *,
    settings: Optional[Settings] = None,
    registry: Optional[PolicyRegistry] = None,
) -> FastAPI:
    active_settings = settings or load_settings()
    if active_settings.calculation_timeout_seconds <= 0:
        raise ValueError("CALCULATION_TIMEOUT_SECONDS must be greater than zero")
    active_registry = registry or PolicyRegistry(active_settings)
    engine = FiscalEngine(active_registry, active_settings)

    application = FastAPI(
        title="Cifra Cívica — API de simulación fiscal",
        version="0.1.0",
        description=(
            "API determinista e informativa. No es una declaración tributaria, asesoramiento "
            "legal ni un cálculo oficial. Las entradas personales no se almacenan."
        ),
        openapi_url="/api/v1/openapi.json",
        docs_url="/api/v1/docs",
        redoc_url=None,
    )
    application.state.settings = active_settings
    application.state.registry = active_registry
    application.state.engine = engine
    if active_settings.cors_origins:
        application.add_middleware(
            CORSMiddleware,
            allow_origins=list(active_settings.cors_origins),
            allow_credentials=False,
            allow_methods=["GET", "POST", "OPTIONS"],
            allow_headers=["Content-Type", "Accept"],
            expose_headers=["X-Request-ID"],
            max_age=600,
        )
    application.add_middleware(RequestSizeLimitMiddleware, max_bytes=active_settings.max_request_bytes)
    application.add_middleware(PrivacySafeAccessLogMiddleware)

    @application.exception_handler(DomainError)
    async def handle_domain_error(request: Request, exc: DomainError) -> JSONResponse:
        return _error_response(
            SafeError(code=exc.code, message=exc.message, request_id=_request_id(request)),
            exc.status_code,
        )

    @application.exception_handler(RequestValidationError)
    async def handle_validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        safe_details: List[Dict[str, str]] = []
        for error in exc.errors()[:20]:
            safe_details.append(
                {
                    "field": ".".join(str(part) for part in error.get("loc", [])),
                    "type": str(error.get("type", "validation_error")),
                }
            )
        return _error_response(
            SafeError(
                code="incomplete_household",
                message="Revise los campos indicados; la solicitud fiscal no está completa.",
                request_id=_request_id(request),
                details=safe_details,
            ),
            422,
        )

    @application.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
        logger.error(
            "calculation_failed requestId=%s exceptionType=%s",
            _request_id(request),
            type(exc).__name__,
        )
        return _error_response(
            SafeError(
                code="calculation_failed",
                message="No se pudo completar el cálculo. Inténtelo de nuevo más tarde.",
                request_id=_request_id(request),
            ),
            500,
        )

    @application.get("/api/v1/health")
    async def health() -> Dict[str, Any]:
        return {
            "status": "ok",
            "service": "simulation-api",
            "modelVersion": active_settings.model_version,
            "policyRegistryVersion": active_registry.registry_version,
            "policyRegistryLoaded": True,
            "dataRetention": "not_stored",
        }

    @application.get("/api/v1/model")
    async def model() -> Dict[str, Any]:
        return {
            "modelVersion": active_settings.model_version,
            "apiContractVersion": active_settings.api_contract_version,
            "policyRegistryVersion": active_registry.registry_version,
            "supportedTaxYears": [active_registry.baseline.tax_year],
            "parameterReview": active_registry.parameter_review_dates,
            "territorialCoverage": {
                "commonRegimeCommunityCodes": [
                    code for code, community in COMMUNITIES.items() if community["fiscalRegime"] == "common"
                ],
                "unsupportedCodes": ["15", "16", "18", "19"],
            },
            "calculationArchitecture": "deterministic_dated_variable_graph",
            "arithmetic": "integer_euro_cents_no_llm",
            "visiblePolicyCount": len(active_registry.public_policies()),
            "inventory": build_manifest(active_registry, active_settings),
            "warnings": [
                "2027 utiliza un traslado explícito de referencias oficiales 2025/2026 y tiene incertidumbre alta.",
                "La cobertura no equivale a fidelidad de una declaración tributaria completa.",
            ],
        }

    @application.get("/api/v1/ready")
    async def readiness() -> Dict[str, Any]:
        baseline = active_registry.baseline
        parameters = active_registry.resolve_parameters(baseline.id)
        return {
            "status": "ready",
            "modelVersion": active_settings.model_version,
            "policyRegistryVersion": active_registry.registry_version,
            "baselineScenarioId": baseline.id,
            "parameterSet": parameters["id"],
            "personalDataChecked": False,
        }

    @application.get("/api/v1/scenarios")
    async def scenarios() -> Dict[str, Any]:
        summaries = []
        for policy in active_registry.public_policies():
            raw = policy.raw
            summaries.append(
                {
                    "id": policy.id,
                    "slug": raw["slug"],
                    "publicName": raw["publicName"],
                    "shortDescription": raw["shortDescription"],
                    "taxYear": raw["taxYear"],
                    "status": raw["status"],
                    "validationStatus": raw["validationStatus"],
                    "policyVersion": raw["policyVersion"],
                    "isSynthetic": raw["isSynthetic"],
                    "uncertaintyStatus": raw["uncertaintyStatus"],
                    "territorialScope": raw["territorialScope"],
                    "methodologyPath": raw["methodologyPath"],
                }
            )
        return {"registryVersion": active_registry.registry_version, "scenarios": summaries}

    @application.get("/api/v1/scenarios/{scenario_id}")
    async def scenario_detail(scenario_id: str, request: Request) -> Dict[str, Any]:
        try:
            policy = active_registry.get_policy(scenario_id)
        except KeyError as exc:
            raise DomainError("invalid_scenario", "El escenario solicitado no existe.", status_code=404) from exc
        detail = policy.public_dict()
        detail["sourceReferences"] = active_registry.source_references(policy)
        methodology_path = active_registry.root / str(policy.raw["methodologyPath"])
        detail["methodologyMarkdown"] = methodology_path.read_text(encoding="utf-8")
        detail["registryVersion"] = active_registry.registry_version
        return detail

    @application.post(
        "/api/v1/simulations/compare",
        response_model=SimulationComparison,
        response_model_by_alias=True,
    )
    async def compare(
        comparison_request: ComparisonRequest, request: Request, response: Response
    ) -> SimulationComparison:
        response.headers["Cache-Control"] = "no-store"
        response.headers["Pragma"] = "no-cache"
        try:
            return await asyncio.wait_for(
                asyncio.to_thread(
                    engine.compare,
                    comparison_request,
                    _request_id(request),
                ),
                timeout=active_settings.calculation_timeout_seconds,
            )
        except asyncio.TimeoutError as exc:
            raise DomainError(
                "calculation_timeout",
                "El cálculo superó el tiempo máximo permitido. Inténtelo de nuevo.",
                status_code=503,
            ) from exc

    @application.get("/api/v1/geographies/search")
    async def geography_search(q: str = Query(min_length=2, max_length=80)) -> Dict[str, Any]:
        normalized = q.casefold().strip()
        matches = [
            {"code": code, **community, "geographyLevel": "autonomous_community"}
            for code, community in COMMUNITIES.items()
            if normalized in community["name"].casefold() or normalized == code
        ]
        return {"results": matches[:10], "dataClass": "official_identifier"}

    @application.get("/api/v1/geographies/{code}")
    async def geography_detail(code: str) -> Dict[str, Any]:
        community = COMMUNITIES.get(code)
        if community is None:
            raise DomainError(
                "unsupported_territory",
                "No existe una geografía soportada con ese código.",
                status_code=404,
            )
        return {"code": code, **community, "geographyLevel": "autonomous_community"}

    @application.get("/api/v1/map/metrics")
    async def map_metrics() -> Dict[str, Any]:
        return {"metrics": list(MAP_METRICS.values()), "containsPersonalData": False}

    @application.get("/api/v1/map/metrics/{metric_id}/metadata")
    async def map_metric_metadata(metric_id: str) -> Dict[str, Any]:
        metadata = MAP_METRICS.get(metric_id)
        if metadata is None:
            raise DomainError("invalid_scenario", "La métrica solicitada no existe.", status_code=404)
        return metadata

    return application


app = create_app()
