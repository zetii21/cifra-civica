"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Info, RotateCcw, Undo2 } from "lucide-react";
import type { ActiveChange } from "./labChanges";

const integerFormat = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 });
const signedInteger = new Intl.NumberFormat("es-ES", {
  maximumFractionDigits: 0,
  signDisplay: "exceptZero",
});
const decimalFormat = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 });

export interface LabScoreboardProps {
  revenueDeltaMEur: number;
  revenueBaselineMEur: number;
  spendingDeltaMEur: number;
  spendingBaselineMEur: number;
  balanceDeltaMEur: number;
  deficitBeforeShare: number;
  deficitAfterShare: number;
  evaluationCount: number;
  changes: ActiveChange[];
  onUndo: (change: ActiveChange) => void;
  onResetAll: () => void;
}

/** Fixed 0–6 % of GDP scale so the gauge is comparable across scenarios. */
const GAUGE_MAX_SHARE = 6;

function gaugePosition(share: number): number {
  return Math.max(0, Math.min(100, (Math.abs(share) / GAUGE_MAX_SHARE) * 100));
}

function DeficitGauge({
  before,
  after,
  compact = false,
}: {
  before: number;
  after: number;
  compact?: boolean;
}) {
  const improves = Math.abs(after) < Math.abs(before) - 0.005;
  const worsens = Math.abs(after) > Math.abs(before) + 0.005;
  const left = Math.min(gaugePosition(before), gaugePosition(after));
  const width = Math.abs(gaugePosition(after) - gaugePosition(before));
  const description = `Déficit público: ${decimalFormat.format(Math.abs(before))} % del PIB antes, ${decimalFormat.format(Math.abs(after))} % después. ${improves ? "Mejora." : worsens ? "Empeora." : "Sin cambio apreciable."}`;
  return (
    <div className={`deficit-gauge${compact ? " compact" : ""}`} role="img" aria-label={description}>
      <div className="deficit-gauge-track">
        <i
          className={`deficit-gauge-span${improves ? " good" : worsens ? " bad" : ""}`}
          style={{ left: `${left}%`, width: `${Math.max(0.5, width)}%` }}
        />
        <span className="deficit-gauge-marker before" style={{ left: `${gaugePosition(before)}%` }} />
        <span
          className={`deficit-gauge-marker after${improves ? " good" : worsens ? " bad" : ""}`}
          style={{ left: `${gaugePosition(after)}%` }}
        />
      </div>
      {compact ? null : (
        <small>
          déficit {decimalFormat.format(Math.abs(before))} % → {decimalFormat.format(Math.abs(after))} % del PIB{" "}
          <b className={improves ? "lab-pos" : worsens ? "lab-neg" : ""}>
            {improves ? "▲ mejora" : worsens ? "▼ empeora" : "· igual"}
          </b>
        </small>
      )}
    </div>
  );
}

export function LabScoreboard({
  revenueDeltaMEur,
  revenueBaselineMEur,
  spendingDeltaMEur,
  spendingBaselineMEur,
  balanceDeltaMEur,
  deficitBeforeShare,
  deficitAfterShare,
  evaluationCount,
  changes,
  onUndo,
  onResetAll,
}: LabScoreboardProps) {
  const anchorRef = useRef<HTMLElement | null>(null);
  const [docked, setDocked] = useState(false);

  useEffect(() => {
    const node = anchorRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setDocked(!entry.isIntersecting),
      { rootMargin: "-12px 0px 0px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const changesTray = (idSuffix: string) => (
    <details className="lab-changes">
      <summary aria-label={`${changes.length} cambios activos; abrir lista`}>
        <strong>{changes.length}</strong>
        <ChevronDown size={13} aria-hidden="true" />
      </summary>
      <div className="lab-changes-panel" id={`lab-changes-panel-${idSuffix}`}>
        {changes.length === 0 ? (
          <p className="muted">Sin cambios: estás viendo la referencia.</p>
        ) : (
          <ul>
            {changes.map((change) => (
              <li key={change.id}>
                <div>
                  <b>{change.label}</b>
                  <span>{change.detail}</span>
                </div>
                <button
                  type="button"
                  className="icon-button lever-undo"
                  aria-label={`Deshacer: ${change.label}`}
                  onClick={() => onUndo(change)}
                >
                  <Undo2 size={14} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {changes.length > 0 ? (
          <button type="button" className="button button-quiet" onClick={onResetAll}>
            <RotateCcw size={14} aria-hidden="true" /> Restablecer todo
          </button>
        ) : null}
      </div>
    </details>
  );

  return (
    <>
      <section className="lab-summary" aria-label="Resumen del escenario" ref={anchorRef}>
        <div>
          <span>Ingresos públicos</span>
          <strong className={revenueDeltaMEur < 0 ? "lab-neg" : "lab-pos"}>
            {signedInteger.format(Math.round(revenueDeltaMEur))} M€
          </strong>
          <small>sobre {integerFormat.format(Math.round(revenueBaselineMEur))} M€</small>
        </div>
        <div>
          <span>Gasto público</span>
          <strong className={spendingDeltaMEur > 0 ? "lab-neg" : "lab-pos"}>
            {signedInteger.format(Math.round(spendingDeltaMEur))} M€
          </strong>
          <small>sobre {integerFormat.format(Math.round(spendingBaselineMEur))} M€</small>
        </div>
        <div>
          <span>
            Saldo público{" "}
            <i
              className="lab-info"
              tabIndex={0}
              role="note"
              aria-label={`Cada ajuste recalcula el escenario completo: ${integerFormat.format(evaluationCount)} evaluaciones deterministas por movimiento.`}
              title={`${integerFormat.format(evaluationCount)} evaluaciones deterministas por movimiento`}
            >
              <Info size={12} aria-hidden="true" />
            </i>
          </span>
          <strong className={balanceDeltaMEur < 0 ? "lab-neg" : "lab-pos"}>
            {signedInteger.format(Math.round(balanceDeltaMEur))} M€
          </strong>
          <DeficitGauge before={deficitBeforeShare} after={deficitAfterShare} />
        </div>
        <div>
          <span>Cambios activos</span>
          {changesTray("full")}
          <small>toca un cambio para deshacerlo</small>
        </div>
      </section>

      <div
        className={`lab-scoreboard-sticky${docked ? " visible" : ""}`}
        aria-hidden={!docked}
        role="region"
        aria-label="Resumen fijo del escenario"
      >
        <button
          type="button"
          className="lab-sticky-back"
          onClick={() => anchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
          tabIndex={docked ? 0 : -1}
        >
          Saldo{" "}
          <strong className={balanceDeltaMEur < 0 ? "lab-neg" : "lab-pos"}>
            {signedInteger.format(Math.round(balanceDeltaMEur))} M€
          </strong>
        </button>
        <span className="lab-sticky-deficit">
          déficit {decimalFormat.format(Math.abs(deficitBeforeShare))} →{" "}
          <b
            className={
              Math.abs(deficitAfterShare) < Math.abs(deficitBeforeShare) - 0.005
                ? "lab-pos"
                : Math.abs(deficitAfterShare) > Math.abs(deficitBeforeShare) + 0.005
                  ? "lab-neg"
                  : ""
            }
          >
            {decimalFormat.format(Math.abs(deficitAfterShare))} %
          </b>
        </span>
        <DeficitGauge before={deficitBeforeShare} after={deficitAfterShare} compact />
        <span className="lab-sticky-changes">
          {changes.length === 0 ? "referencia" : `${changes.length} cambios`}
        </span>
        {changes.length > 0 ? (
          <button
            type="button"
            className="icon-button lever-undo"
            aria-label="Restablecer todo"
            title="Restablecer todo"
            onClick={onResetAll}
            tabIndex={docked ? 0 : -1}
          >
            <RotateCcw size={14} aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </>
  );
}
