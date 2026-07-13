SHELL := /bin/bash
.DEFAULT_GOAL := help

PYTHON ?= python3
VENV ?= .venv
PY := $(VENV)/bin/python
PIP := $(VENV)/bin/pip
API_DIR := services/simulation-api
GOVERNANCE := .github/scripts/governance_checks.py

.PHONY: help setup dev dev-web dev-api test test-web test-api geo-test lint \
	format-check typecheck model-validate model-study policy-validate benchmark seed tiles build up down \
	logs privacy-check docs-check release-check secret-check audit migration-check ci

help: ## Mostrar comandos disponibles
	@awk 'BEGIN {FS = ":.*## "; print "Cifra Cívica\n"} /^[a-zA-Z0-9_-]+:.*## / {printf "  %-20s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

setup: ## Instalar dependencias web y de la API
	npm ci
	$(PYTHON) -m venv $(VENV)
	$(PIP) install --upgrade pip
	$(PIP) install -r $(API_DIR)/requirements.txt
	@if test -f $(API_DIR)/requirements-dev.txt; then $(PIP) install -r $(API_DIR)/requirements-dev.txt; fi
	@if test -f model-lab/requirements.txt; then $(PIP) install -r model-lab/requirements.txt; fi

dev: ## Ejecutar web (:3000) y API (:8000)
	@test -x $(PY) || { echo "Falta $(VENV); ejecute make setup"; exit 1; }
	@set -m; \
	  (cd $(API_DIR) && ../../$(PY) -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 --no-access-log) & api_pid=$$!; \
	  npm run dev & web_pid=$$!; \
	  trap 'kill $$api_pid $$web_pid 2>/dev/null || true' INT TERM EXIT; \
	  wait $$api_pid $$web_pid

dev-web: ## Ejecutar solo la web
	npm run dev

dev-api: ## Ejecutar solo la API
	cd $(API_DIR) && ../../$(PY) -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 --no-access-log

test: test-web test-api geo-test docs-check privacy-check ## Ejecutar todas las pruebas locales

test-web: ## Ejecutar pruebas web
	npm test

test-api: ## Ejecutar pruebas de la API
	cd $(API_DIR) && ../../$(PY) -m pytest

geo-test: ## Ejecutar pruebas geográficas y de teselas
	@files="$$(find packages/geography/tests pipelines services/tile-service/tests \
	  -type f -name '*.test.ts' 2>/dev/null | sort)"; \
	if test -n "$$files"; then node --import tsx --test $$files; \
	else echo "Sin pruebas geográficas instaladas"; fi

format-check: ## Comprobar formato y espacios en blanco
	npm run --if-present format:check
	$(PY) $(GOVERNANCE) whitespace
	@if $(PY) -c 'import ruff' >/dev/null 2>&1; then $(PY) -m ruff format --check $(API_DIR) model-lab; fi

lint: format-check ## Ejecutar lint web, tipos y lint Python disponible
	npm run lint
	npx tsc --noEmit
	@if $(PY) -c 'import ruff' >/dev/null 2>&1; then $(PY) -m ruff check $(API_DIR) model-lab; fi

typecheck: ## Comprobar tipos TypeScript y Python disponible
	npx tsc --noEmit
	@if $(PY) -c 'import mypy' >/dev/null 2>&1; then $(PY) -m mypy $(API_DIR)/app; fi

model-validate: ## Validar manifiestos exactos de modelo y espacio de estados
	node scripts/validate-coverage.mjs
	node scripts/validate-model-study.mjs
	@if test -f $(API_DIR)/model-manifest.json; then \
	  cd $(API_DIR) && ../../$(PY) -m app.manifest --check model-manifest.json; \
	else echo "Falta $(API_DIR)/model-manifest.json"; exit 1; fi

model-study: ## Ejecutar el estudio estadístico reproducible completo (2M hogares sintéticos)
	npm run model:study

policy-validate: ## Validar políticas, procedencia y reglas de publicación
	@if test -f $(API_DIR)/scripts/validate_policy_registry.py; then \
	  $(PY) $(API_DIR)/scripts/validate_policy_registry.py; \
	else $(PY) $(GOVERNANCE) policies; fi
	npx vitest run tests/policy-catalog-sync.test.ts

benchmark: ## Ejecutar benchmarks versionados cuando estén disponibles
	@if test -d $(API_DIR)/tests/benchmarks; then \
	  cd $(API_DIR) && ../../$(PY) -m pytest tests/benchmarks; \
	else echo "Sin dataset de benchmark instalado; estado: no evaluado"; fi

seed: ## Generar fixtures geográficos DEMO
	node --import tsx pipelines/geography/generate-demo.ts

tiles: ## Construir teselas vectoriales de desarrollo
	node --import tsx pipelines/publishing/build-vector-tiles.ts

build: policy-validate ## Construir artefactos de producción
	npm run build
	$(PY) -m compileall -q $(API_DIR)/app

up: ## Levantar el entorno Docker
	docker compose up --build

down: ## Detener el entorno Docker
	docker compose down --remove-orphans

logs: ## Ver logs operativos del entorno Docker
	docker compose logs --follow --tail=100

privacy-check: ## Ejecutar controles estáticos de privacidad
	$(PY) $(GOVERNANCE) privacy

docs-check: ## Verificar documentación y enlaces locales
	$(PY) $(GOVERNANCE) docs

release-check: ## Verificar metadatos de versión
	$(PY) $(GOVERNANCE) release

secret-check: ## Buscar patrones de secretos antes de publicar
	$(PY) $(GOVERNANCE) secrets

audit: ## Auditar dependencias
	npm audit --audit-level=high
	@if $(PY) -c 'import pip_audit' >/dev/null 2>&1; then \
	  ignores="--ignore-vuln PYSEC-2026-161 --ignore-vuln PYSEC-2026-249 --ignore-vuln PYSEC-2026-248 --ignore-vuln PYSEC-2026-2281 --ignore-vuln PYSEC-2026-2280"; \
	  if ! $(PY) -c 'import sys; raise SystemExit(0 if sys.version_info >= (3, 10) else 1)'; then \
	    ignores="$$ignores --ignore-vuln PYSEC-2026-1845 --ignore-vuln PYSEC-2026-2132 --ignore-vuln PYSEC-2026-2270"; \
	  fi; \
	  $(PY) -m pip_audit -r $(API_DIR)/requirements-dev.txt $$ignores; \
	else echo "pip-audit no instalado; CI lo instala de forma explícita"; fi

migration-check: ## Comprobar que las migraciones versionadas están al día
	@if rg -q 'sqliteTable|pgTable' db/schema.ts; then \
	  npm run db:generate && git diff --exit-code -- drizzle; \
	else echo "Sin tablas persistentes de aplicación: no se requiere migración"; fi

ci: lint typecheck test model-validate policy-validate release-check secret-check migration-check build ## Reproducir las puertas principales de CI
