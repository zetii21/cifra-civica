"use client";

import { useMemo, useState } from "react";
import { House } from "lucide-react";
import {
  AGE_BANDS,
  COMMUNITIES,
  FAMILY_TYPES,
  type AgeBandId,
  type CommunityCode,
  type FamilyTypeId,
  type PolicySettings,
} from "@/lib/fiscal-lab";
import {
  computeSegmentImpacts,
  INCOME_BANDS,
  profileImpact,
} from "@/lib/fiscal-lab/segment-impact";

const signedInteger = new Intl.NumberFormat("es-ES", {
  maximumFractionDigits: 0,
  signDisplay: "exceptZero",
});
const integerFormat = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 });

export function HouseholdProfileCard({
  settings,
  activeChanges,
}: {
  settings: PolicySettings;
  activeChanges: number;
}) {
  const [community, setCommunity] = useState<CommunityCode>("13");
  const [band, setBand] = useState(4);
  const [familyType, setFamilyType] = useState<FamilyTypeId>("pareja_con_hijos");
  const [ageBand, setAgeBand] = useState<AgeBandId>("de_30_a_44");

  const impacts = useMemo(() => computeSegmentImpacts(settings), [settings]);
  const impact = useMemo(
    () => profileImpact(impacts, { community, band, familyType, ageBand }),
    [impacts, community, band, familyType, ageBand],
  );

  const communityName = COMMUNITIES.find((entry) => entry.code === community)?.name ?? "";

  return (
    <div className="lab-household-card">
      <div className="lab-impact-heading">
        <House size={17} aria-hidden="true" />
        <h2>¿Y un hogar como el tuyo?</h2>
      </div>
      <p className="field-help">
        Elige un perfil aproximado. El resultado es la media del segmento sintético, no un
        cálculo personal: para tu declaración usa la calculadora de hogar.
      </p>
      <div className="lab-household-grid">
        <div className="field">
          <label htmlFor="profile-community">Comunidad</label>
          <select
            id="profile-community"
            value={community}
            onChange={(event) => setCommunity(event.target.value as CommunityCode)}
          >
            {COMMUNITIES.map((entry) => (
              <option key={entry.code} value={entry.code}>
                {entry.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="profile-band">Ingresos brutos del hogar</label>
          <select
            id="profile-band"
            value={band}
            onChange={(event) => setBand(Number(event.target.value))}
          >
            {INCOME_BANDS.map((entry, index) => (
              <option key={entry.label} value={index}>
                ≈ {integerFormat.format(entry.meanGrossIncomeEur)} € · {entry.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="profile-family">Tipo de hogar</label>
          <select
            id="profile-family"
            value={familyType}
            onChange={(event) => setFamilyType(event.target.value as FamilyTypeId)}
          >
            {FAMILY_TYPES.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="profile-age">Edad de la persona sustentadora</label>
          <select
            id="profile-age"
            value={ageBand}
            onChange={(event) => setAgeBand(event.target.value as AgeBandId)}
          >
            {AGE_BANDS.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {activeChanges === 0 ? (
        <p className="muted">Mueve una palanca o aplica un paquete para ver el efecto.</p>
      ) : impact ? (
        <div className="lab-household-result" aria-live="polite">
          <strong className={impact.netEur < -0.5 ? "lab-neg" : impact.netEur > 0.5 ? "lab-pos" : ""}>
            {signedInteger.format(Math.round(impact.netEur))} € al año
          </strong>
          <span>
            impuestos {signedInteger.format(Math.round(-impact.taxEur))} € · servicios y
            prestaciones {signedInteger.format(Math.round(impact.benefitEur))} €
          </span>
          <small>
            Media de los ≈ {integerFormat.format(Math.round(impact.households / 100) * 100)}{" "}
            hogares de este segmento en {communityName}. Incluye IRPF exacto por tramos e
            incidencia estimada de consumo, especiales y gasto público.
          </small>
        </div>
      ) : null}
    </div>
  );
}
