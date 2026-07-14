"use client";

import { BookOpenCheck, FlaskConical } from "lucide-react";
import { Notice, StatusBadge } from "./Ui";
import { GOVERNMENT_PRESETS, type GovernmentPreset } from "@/lib/fiscal-lab";

export interface GovernmentPresetsProps {
  activePresetId: string | null;
  modified: boolean;
  onApply: (preset: GovernmentPreset) => void;
  onClear: () => void;
}

/**
 * Uniform, neutral tiles for government packages. Deliberately no party
 * logos: brand marks need a rights review, and identical tiles guarantee
 * equal visual treatment. Ordering is alphabetical inside each group.
 */
export function GovernmentPresets({
  activePresetId,
  modified,
  onApply,
  onClear,
}: GovernmentPresetsProps) {
  const historical = GOVERNMENT_PRESETS.filter((preset) => preset.kind === "historical");
  const archetypes = GOVERNMENT_PRESETS.filter((preset) => preset.kind === "archetype");
  const active = GOVERNMENT_PRESETS.find((preset) => preset.id === activePresetId);

  const tile = (preset: GovernmentPreset) => {
    const isActive = preset.id === activePresetId;
    return (
      <button
        key={preset.id}
        type="button"
        className={`preset-tile${isActive ? " active" : ""}`}
        aria-pressed={isActive}
        onClick={() => (isActive ? onClear() : onApply(preset))}
      >
        <span className="preset-mark" style={{ background: preset.color }} aria-hidden="true">
          {preset.tileLabel}
        </span>
        <span className="preset-name">{preset.name}</span>
      </button>
    );
  };

  return (
    <div className="preset-panel">
      <div className="preset-heading">
        <div>
          <span>¿Y si gobierna…?</span>
          <h2>Paquetes de gobierno comparables</h2>
        </div>
        {active ? (
          <StatusBadge tone={modified ? "warning" : "official"}>
            {modified ? "Paquete modificado" : "Paquete aplicado"}
          </StatusBadge>
        ) : null}
      </div>
      <p className="field-help">
        Cada paquete carga un conjunto de palancas que después puedes ajustar libremente.
        Tratamiento visual idéntico y orden alfabético: comparar no es recomendar.
      </p>
      <h3 className="preset-group-title">
        <BookOpenCheck size={14} aria-hidden="true" /> Trayectorias de gobierno documentadas
      </h3>
      <div className="preset-grid">{historical.map(tile)}</div>
      <h3 className="preset-group-title">
        <FlaskConical size={14} aria-hidden="true" /> Arquetipos sintéticos de política fiscal
      </h3>
      <div className="preset-grid">{archetypes.map(tile)}</div>
      {active ? (
        <div className="preset-detail">
          <p>{active.description}</p>
          {active.sourceNotes.length > 0 ? (
            <>
              <strong>Medidas documentadas en que se basa</strong>
              <ul>
                {active.sourceNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </>
          ) : null}
          <Notice
            tone="warning"
            title={
              active.kind === "historical"
                ? "Aplicación ilustrativa, no un programa 2027"
                : "Paquete sintético de demostración"
            }
          >
            <ul className="lab-warning-list">
              {active.caveats.map((caveat) => (
                <li key={caveat}>{caveat}</li>
              ))}
            </ul>
          </Notice>
        </div>
      ) : (
        <p className="preset-footnote">
          Los programas electorales de 2027 podrán añadirse cuando se publiquen, con sus
          fuentes y su estado de revisión; esta plataforma nunca recomienda voto.
        </p>
      )}
    </div>
  );
}
