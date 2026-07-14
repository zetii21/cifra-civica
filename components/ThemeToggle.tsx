"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import {
  loadThemePreference,
  saveThemePreference,
  type ThemePreference,
} from "@/lib/local-store";

const LABELS: Record<ThemePreference, string> = {
  system: "Tema: automático (según tu sistema)",
  light: "Tema: claro",
  dark: "Tema: oscuro",
};

const ORDER: ThemePreference[] = ["system", "light", "dark"];

function resolvedTheme(preference: ThemePreference): "light" | "dark" {
  if (preference !== "system") return preference;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(preference: ThemePreference): void {
  document.documentElement.dataset.theme = resolvedTheme(preference);
}

/**
 * Three-state theme control (system → light → dark). The preference lives in
 * the same device-local IndexedDB used for optional saves; nothing is sent
 * anywhere. An inline bootstrap in the layout applies the system theme before
 * first paint; this component reconciles any stored override afterwards.
 */
export function ThemeToggle() {
  const [preference, setPreference] = useState<ThemePreference>("system");

  useEffect(() => {
    let cancelled = false;
    loadThemePreference()
      .then((stored) => {
        if (cancelled || !stored) return;
        setPreference(stored);
        applyTheme(stored);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (preference !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [preference]);

  const cycle = () => {
    const next = ORDER[(ORDER.indexOf(preference) + 1) % ORDER.length];
    setPreference(next);
    applyTheme(next);
    saveThemePreference(next).catch(() => {});
  };

  const Icon = preference === "system" ? Monitor : preference === "light" ? Sun : Moon;

  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={`${LABELS[preference]}. Pulsar para cambiar.`}
      title={LABELS[preference]}
      onClick={cycle}
    >
      <Icon size={17} aria-hidden="true" />
    </button>
  );
}
