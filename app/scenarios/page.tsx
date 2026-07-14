"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Filter, Search } from "lucide-react";
import { Eyebrow, StatusBadge } from "@/components/Ui";
import { SCENARIOS } from "@/lib/policy-catalog";

export default function ScenariosPage() {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"all" | "reference" | "demo">("all");
  const scenarios = useMemo(
    () =>
      SCENARIOS.filter((scenario) => {
        const matchesQuery = `${scenario.publicName} ${scenario.shortDescription} ${scenario.sponsor}`
          .toLocaleLowerCase("es")
          .includes(query.toLocaleLowerCase("es"));
        const matchesKind =
          kind === "all" || (kind === "demo" ? scenario.synthetic : !scenario.synthetic);
        return matchesQuery && matchesKind;
      }),
    [query, kind],
  );

  return (
    <div className="shell page-shell scenario-directory">
      <div className="page-header">
        <Eyebrow>Registro público · Git versionado</Eyebrow>
        <h1 className="page-title">Políticas que se pueden inspeccionar.</h1>
        <p className="page-intro">
          Cada escenario hereda una misma referencia, cambia solo parámetros declarados y
          publica fuentes, supuestos, pruebas y estado de validación.
        </p>
      </div>
      <div className="scenario-filters" aria-label="Filtros de escenarios">
        <label>
          <Search size={17} aria-hidden="true" />
          <span className="sr-only">Buscar escenario</span>
          <input
            type="search"
            placeholder="Buscar por nombre u origen"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label>
          <Filter size={17} aria-hidden="true" />
          <span className="sr-only">Filtrar tipo</span>
          <select value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}>
            <option value="all">Todos los tipos</option>
            <option value="reference">Referencia</option>
            <option value="demo">Sintéticos DEMO</option>
          </select>
        </label>
        <span>{scenarios.length} resultado(s)</span>
      </div>
      <div className="directory-grid">
        {scenarios.map((scenario) => (
          <article className="directory-card" key={scenario.id}>
            <div className="directory-card-top">
              <StatusBadge tone={scenario.synthetic ? "demo" : "warning"}>
                {scenario.synthetic ? "DEMO SINTÉTICA" : "REFERENCIA PENDIENTE"}
              </StatusBadge>
              <span>{scenario.taxYear}</span>
            </div>
            <h2>{scenario.publicName}</h2>
            <p>{scenario.shortDescription}</p>
            <dl>
              <div><dt>Estado</dt><dd>{scenario.status}</dd></div>
              <div><dt>Validación</dt><dd>{scenario.validationStatus}</dd></div>
              <div><dt>Versión</dt><dd>{scenario.policyVersion}</dd></div>
              <div><dt>Origen</dt><dd>{scenario.sponsor}</dd></div>
            </dl>
            <Link href={`/scenarios/${scenario.slug}`}>
              Ver ficha completa <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </article>
        ))}
      </div>
      {scenarios.length === 0 ? (
        <div className="empty-state"><p>No hay escenarios que coincidan con los filtros.</p></div>
      ) : null}
    </div>
  );
}
