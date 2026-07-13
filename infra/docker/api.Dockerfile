FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1
WORKDIR /app

RUN groupadd --system --gid 10001 cifra \
  && useradd --system --uid 10001 --gid cifra --home-dir /nonexistent cifra

COPY services/simulation-api/requirements.txt services/simulation-api/constraints.txt /tmp/
RUN python -m pip install --upgrade pip \
  && python -m pip install -r /tmp/requirements.txt

COPY --chown=cifra:cifra services/simulation-api /app/services/simulation-api
COPY --chown=cifra:cifra policy-registry /app/policy-registry

USER cifra
EXPOSE 8000
CMD ["python", "-m", "uvicorn", "--app-dir", "services/simulation-api", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--no-access-log"]
