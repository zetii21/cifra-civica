"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, HardDrive, RotateCcw, Trash2 } from "lucide-react";
import { useCalculator } from "@/app/providers";
import { ProgressSteps } from "@/components/ProgressSteps";
import { Notice, StatusBadge } from "@/components/Ui";
import { AUTONOMOUS_COMMUNITIES } from "@/lib/domain";
import { BASELINE_ID, SCENARIOS } from "@/lib/policy-catalog";
import { formatCents } from "@/lib/format";

export default function ScenarioSelectionPage() {
  const router = useRouter();
  const {
    household,
    updateHousehold,
    runSimulation,
    error,
    isCalculating,
    saveLocally,
    restoreLocal,
    deleteLocal,
  } = useCalculator();
  const [localMessage, setLocalMessage] = useState<string | null>(null);
  const community = AUTONOMOUS_COMMUNITIES.find(
    (candidate) => candidate.code === household.residence.autonomousCommunityCode,
  );
  const gross = household.adults.reduce(
    (sum, adult) =>
      sum + adult.annualGrossEmploymentIncome + adult.annualSelfEmploymentNetIncome + adult.annualPensionIncome + adult.annualUnemploymentBenefits,
    0,
  );

  function toggleScenario(id: string) {
    if (id === BASELINE_ID) return;
    updateHousehold((current) => {
      const selected = current.selectedScenarioIds.includes(id);
      const next = selected
        ? current.selectedScenarioIds.filter((scenarioId) => scenarioId !== id)
        : [...current.selectedScenarioIds, id];
      return {
        ...current,
        selectedScenarioIds: Array.from(new Set([BASELINE_ID, ...next])).slice(0, 3),
      };
    });
  }

  return (
    <div className="shell page-shell calculator-page">
      <ProgressSteps current={3} />
      <div className="form-header">
        <span>Paso 4 de 4</span>
        <h1>Elige qué comparar</h1>
        <p>La referencia siempre aparece primero. Puedes añadir hasta dos escenarios en este MVP.</p>
      </div>
      <div className="form-layout">
        <div className="stack-lg">
          <div className="scenario-selection-grid">
            {SCENARIOS.map((scenario) => {
              const selected = household.selectedScenarioIds.includes(scenario.id);
              return (
                <label
                  className={`scenario-select-card ${selected ? "selected" : ""}`}
                  key={scenario.id}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    disabled={scenario.id === BASELINE_ID}
                    onChange={() => toggleScenario(scenario.id)}
                  />
                  <span className="selection-check"><Check size={17} aria-hidden="true" /></span>
                  <div className="scenario-card-top">
                    <StatusBadge tone={scenario.synthetic ? "demo" : "warning"}>
                      {scenario.synthetic ? "DEMO" : "REFERENCIA"}
                    </StatusBadge>
                    <span>{scenario.policyVersion}</span>
                  </div>
                  <h2>{scenario.publicName}</h2>
                  <p>{scenario.shortDescription}</p>
                  <small>{scenario.assumptions[0]}</small>
                </label>
              );
            })}
          </div>

          <div className="content-card content-card-padding review-card">
            <div className="review-heading">
              <div><span>Resumen local</span><h2>Confirma los datos</h2></div>
              <Link href="/calculator/household">Editar hogar</Link>
            </div>
            <dl className="review-grid">
              <div><dt>Territorio</dt><dd>{community?.name ?? "Sin seleccionar"}</dd></div>
              <div><dt>Hogar</dt><dd>{household.adults.length} adulto(s), {household.dependants.length} dependiente(s)</dd></div>
              <div><dt>Ingresos principales</dt><dd>{formatCents(gross)}</dd></div>
              <div><dt>Escenarios</dt><dd>{household.selectedScenarioIds.length}</dd></div>
            </dl>
            <Notice tone="warning" title="Supuesto material pendiente de confirmar">
              Aceptas que la referencia 2027 usa reglas revisadas de 2025–2026 y una
              escala autonómica proxy hasta completar la validación territorial.
            </Notice>
            {error ? <Notice tone="warning" title="No se pudo calcular">{error}</Notice> : null}
            <div className="form-actions">
              <Link className="button button-quiet" href="/calculator/housing-benefits">
                <ArrowLeft size={17} aria-hidden="true" /> Volver
              </Link>
              <button
                className="button"
                type="button"
                disabled={isCalculating}
                onClick={async () => {
                  const next = await runSimulation();
                  if (next) router.push("/results");
                }}
              >
                {isCalculating ? "Calculando…" : "Calcular comparación"} <ArrowRight size={17} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        <aside className="form-aside">
          <Notice tone="privacy" title="Guardado opcional">
            Nada se guarda por defecto. Si eliges guardarlo, la copia permanece en este navegador mediante IndexedDB.
          </Notice>
          <div className="aside-card local-actions">
            <button
              type="button"
              onClick={async () => {
                await saveLocally();
                setLocalMessage("Datos guardados en este dispositivo.");
              }}
            ><HardDrive size={17} aria-hidden="true" /> Guardar en este dispositivo</button>
            <button
              type="button"
              onClick={async () => {
                const restored = await restoreLocal();
                setLocalMessage(restored ? "Copia local restaurada." : "No hay una copia local.");
              }}
            ><RotateCcw size={17} aria-hidden="true" /> Recuperar copia local</button>
            <button
              type="button"
              onClick={async () => {
                await deleteLocal();
                setLocalMessage("Copia local eliminada.");
              }}
            ><Trash2 size={17} aria-hidden="true" /> Borrar datos locales</button>
            {localMessage ? <p role="status">{localMessage}</p> : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
