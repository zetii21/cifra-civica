import type { ReactNode } from "react";
import { Eyebrow } from "./Ui";

export function GovernancePage({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <div className="shell page-shell governance-page">
      <div className="page-header">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="page-title">{title}</h1>
        <p className="page-intro">{intro}</p>
      </div>
      <div className="prose-content">{children}</div>
    </div>
  );
}
