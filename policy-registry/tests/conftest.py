from dataclasses import replace

import pytest

from app.config import load_settings
from app.registry import PolicyRegistry


@pytest.fixture(scope="session")
def settings():
    return replace(load_settings(), app_environment="test")


@pytest.fixture(scope="session")
def registry(settings):
    return PolicyRegistry(settings)
