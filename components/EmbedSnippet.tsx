"use client";

import { useState, useSyncExternalStore } from "react";
import { Check, Code2, Copy } from "lucide-react";
import { GOVERNMENT_PRESETS } from "@/lib/fiscal-lab";

/**
 * Copy-paste iframe snippet for newsrooms and blogs. The widget route serves
 * only public aggregates, so it is the single route allowed to be framed.
 */
const subscribeNever = () => () => {};

export function EmbedSnippet() {
  const origin = useSyncExternalStore(
    subscribeNever,
    () => window.location.origin,
    () => "https://cifracivica.example",
  );
  const [presetId, setPresetId] = useState("baseline");
  const [copied, setCopied] = useState(false);

  const snippet = `<iframe src="${origin}/widget/${presetId}" width="720" height="640" style="max-width:100%;border:1px solid #cfd4cb;border-radius:12px" title="Laboratorio fiscal de Cifra Cívica" loading="lazy"></iframe>`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <details className="embed-snippet">
      <summary>
        <Code2 size={14} aria-hidden="true" /> Insertar en tu web o medio (widget embebible)
      </summary>
      <div className="embed-snippet-body">
        <div className="field">
          <label htmlFor="embed-preset">Contenido del widget</label>
          <select
            id="embed-preset"
            value={presetId}
            onChange={(event) => setPresetId(event.target.value)}
          >
            <option value="baseline">Referencia sin cambios</option>
            {GOVERNMENT_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>
        </div>
        <label className="sr-only" htmlFor="embed-code">
          Código de inserción
        </label>
        <textarea id="embed-code" readOnly rows={4} value={snippet} />
        <div className="embed-snippet-actions">
          <button type="button" className="button button-quiet" onClick={copy}>
            {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
            {copied ? "Copiado" : "Copiar código"}
          </button>
          <span>Solo agregados públicos; el widget no coloca cookies ni rastreadores.</span>
        </div>
      </div>
    </details>
  );
}
