import type { ReactNode } from "react";
import { CircleAlert, Info, LockKeyhole, ShieldCheck } from "lucide-react";

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="eyebrow">{children}</p>;
}

export function Notice({
  children,
  tone = "info",
  title,
}: {
  children: ReactNode;
  tone?: "info" | "warning" | "privacy" | "success";
  title?: string;
}) {
  const Icon =
    tone === "warning"
      ? CircleAlert
      : tone === "privacy"
        ? LockKeyhole
        : tone === "success"
          ? ShieldCheck
          : Info;
  return (
    <div className={`notice notice-${tone}`} role={tone === "warning" ? "alert" : "note"}>
      <Icon size={20} aria-hidden="true" />
      <div>
        {title ? <strong>{title}</strong> : null}
        <div>{children}</div>
      </div>
    </div>
  );
}

export function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "demo" | "official" | "warning" | "good";
}) {
  return <span className={`status-badge status-${tone}`}>{children}</span>;
}

export function MoneyInput({
  id,
  label,
  value,
  onChange,
  help,
  max = 10_000_000,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (cents: number) => void;
  help?: string;
  max?: number;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="money-input">
        <input
          id={id}
          type="number"
          min="0"
          max={max}
          step="100"
          inputMode="numeric"
          value={Math.round(value / 100) || ""}
          placeholder="0"
          onChange={(event) => {
            const euros = Number(event.target.value);
            onChange(Number.isFinite(euros) ? Math.round(euros * 100) : 0);
          }}
        />
        <span aria-hidden="true">€ / año</span>
      </div>
      {help ? <p className="field-help">{help}</p> : null}
    </div>
  );
}
