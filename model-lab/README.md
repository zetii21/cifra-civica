# Laboratorio estadístico

El motor normativo de Cifra Cívica es la fuente de verdad. Este laboratorio lo
somete a millones de hogares sintéticos, compara modelos estadísticos sustitutos
y calcula sensibilidad de variables. Ningún modelo aprendido modifica reglas
fiscales ni convierte una aproximación en un resultado oficial.

La ejecución de referencia usa dos millones de hogares y tres políticas: seis
millones de evaluaciones exactas. La semilla, el espacio de entrada, las métricas,
los casos límite y las versiones quedan en `artifacts/study-report.json`.

```bash
python3 -m venv .venv
.venv/bin/pip install -r services/simulation-api/requirements-dev.txt \
  -r model-lab/requirements.txt
.venv/bin/python model-lab/run_study.py --cases 2000000
```

Para una comprobación rápida del pipeline puede usarse `--cases 20000
--train-cases 10000 --test-cases 5000`. Esa ejecución no puede sustituir ni
sobrescribir el informe de referencia sin `--allow-small-report`.

