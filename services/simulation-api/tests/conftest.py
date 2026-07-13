from dataclasses import replace

import pytest
from fastapi.testclient import TestClient

from app.config import load_settings
from app.engine import FiscalEngine
from app.main import create_app
from app.models import ComparisonRequest
from app.registry import PolicyRegistry
from tests.helpers import valid_payload


@pytest.fixture(scope="session")
def settings():
    return replace(load_settings(), app_environment="test")


@pytest.fixture(scope="session")
def registry(settings):
    return PolicyRegistry(settings)


@pytest.fixture(scope="session")
def engine(settings, registry):
    return FiscalEngine(registry, settings)


@pytest.fixture()
def api_client(settings, registry):
    with TestClient(create_app(settings=settings, registry=registry)) as client:
        yield client


@pytest.fixture()
def comparison_request():
    return ComparisonRequest.model_validate(valid_payload())
