"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Minus, Plus, Trash2 } from "lucide-react";
import { ProgressSteps } from "@/components/ProgressSteps";
import { Notice } from "@/components/Ui";
import {
  AUTONOMOUS_COMMUNITIES,
  createAdult,
  type DependantInput,
} from "@/lib/domain";
import { useCalculator } from "@/app/providers";

function createDependant(): DependantInput {
  return {
    id: crypto.randomUUID(),
    age: 8,
    relationship: "child",
    disabilityBand: "none",
    sharedCustody: false,
    dependentForTaxPurposes: true,
  };
}

export default function HouseholdPage() {
  const { household, updateHousehold } = useCalculator();
  const community = AUTONOMOUS_COMMUNITIES.find(
    (candidate) => candidate.code === household.residence.autonomousCommunityCode,
  );
  const supported = community?.support !== "unsupported";

  return (
    <div className="shell page-shell calculator-page">
      <ProgressSteps current={0} />
      <div className="form-header">
        <span>Paso 1 de 4</span>
        <h1>¿Quién forma tu hogar?</h1>
        <p>La residencia fiscal y la composición familiar cambian el cálculo.</p>
      </div>

      <div className="form-layout">
        <form className="content-card content-card-padding form-card" onSubmit={(event) => event.preventDefault()}>
          <fieldset>
            <legend>Residencia fiscal</legend>
            <div className="field-grid two-columns">
              <div className="field">
                <label htmlFor="community">Comunidad autónoma</label>
                <select
                  id="community"
                  value={household.residence.autonomousCommunityCode}
                  onChange={(event) => {
                    const selected = AUTONOMOUS_COMMUNITIES.find(
                      (candidate) => candidate.code === event.target.value,
                    );
                    if (!selected) return;
                    updateHousehold((current) => ({
                      ...current,
                      residence: {
                        ...current.residence,
                        autonomousCommunityCode: selected.code,
                        fiscalRegime: selected.fiscalRegime,
                      },
                    }));
                  }}
                >
                  {AUTONOMOUS_COMMUNITIES.map((candidate) => (
                    <option key={candidate.code} value={candidate.code}>
                      {candidate.name}
                    </option>
                  ))}
                </select>
                <p className="field-help">Usa tu residencia fiscal, no tu lugar de nacimiento.</p>
              </div>
              <div className="field">
                <label htmlFor="municipality">Municipio (opcional)</label>
                <input
                  id="municipality"
                  type="text"
                  maxLength={5}
                  inputMode="numeric"
                  placeholder="Código INE de 5 dígitos"
                  value={household.residence.municipalityCode ?? ""}
                  onChange={(event) =>
                    updateHousehold((current) => ({
                      ...current,
                      residence: {
                        ...current.residence,
                        municipalityCode: event.target.value.replace(/\D/g, "").slice(0, 5),
                      },
                    }))
                  }
                />
                <p className="field-help">Solo se usa como contexto; no viaja a una capa de mapa personal.</p>
              </div>
            </div>
            {!supported ? (
              <Notice tone="warning" title="Territorio aún no compatible">
                {community?.name} requiere reglas fiscales propias o tratamiento especial.
                Puedes consultar el método y el mapa, pero no aplicaremos reglas comunes.
              </Notice>
            ) : null}
            {community?.code === "05" ? (
              <Notice tone="info" title="Cobertura parcial de Canarias">
                El cálculo directo no incluye IGIC ni incidencia de impuestos al consumo.
              </Notice>
            ) : null}
          </fieldset>

          <fieldset>
            <legend>Situación familiar</legend>
            <div className="field-grid two-columns">
              <div className="field">
                <label htmlFor="marital-status">Estado civil</label>
                <select
                  id="marital-status"
                  value={household.maritalStatus}
                  onChange={(event) =>
                    updateHousehold((current) => ({
                      ...current,
                      maritalStatus: event.target.value as typeof current.maritalStatus,
                    }))
                  }
                >
                  <option value="single">Soltero/a</option>
                  <option value="married">Casado/a</option>
                  <option value="domestic_partnership">Pareja de hecho</option>
                  <option value="separated">Separado/a</option>
                  <option value="divorced">Divorciado/a</option>
                  <option value="widowed">Viudo/a</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="filing">Modalidad de cálculo</label>
                <select
                  id="filing"
                  value={household.filingPreference}
                  onChange={(event) =>
                    updateHousehold((current) => ({
                      ...current,
                      filingPreference: event.target.value as typeof current.filingPreference,
                    }))
                  }
                >
                  <option value="calculate_best">Comparar y elegir menor IRPF</option>
                  <option value="individual">Individual</option>
                  <option value="joint">Conjunta</option>
                </select>
              </div>
            </div>
            <label className="check-control">
              <input
                type="checkbox"
                checked={household.singleParentHousehold}
                onChange={(event) =>
                  updateHousehold((current) => ({
                    ...current,
                    singleParentHousehold: event.target.checked,
                  }))
                }
              />
              <span>Es un hogar monoparental</span>
            </label>
          </fieldset>

          <fieldset>
            <div className="legend-row">
              <legend>Personas adultas</legend>
              <span>{household.adults.length} de 3</span>
            </div>
            <div className="person-list">
              {household.adults.map((adult, index) => (
                <div className="person-row" key={adult.id}>
                  <div className="person-number">{index + 1}</div>
                  <div className="field">
                    <label htmlFor={`adult-age-${adult.id}`}>Edad</label>
                    <input
                      id={`adult-age-${adult.id}`}
                      type="number"
                      min="18"
                      max="110"
                      value={adult.age}
                      onChange={(event) =>
                        updateHousehold((current) => ({
                          ...current,
                          adults: current.adults.map((candidate) =>
                            candidate.id === adult.id
                              ? { ...candidate, age: Number(event.target.value) }
                              : candidate,
                          ),
                        }))
                      }
                    />
                  </div>
                  <div className="field">
                    <label htmlFor={`adult-relation-${adult.id}`}>Relación</label>
                    <select
                      id={`adult-relation-${adult.id}`}
                      value={adult.relationshipToHousehold}
                      onChange={(event) =>
                        updateHousehold((current) => ({
                          ...current,
                          adults: current.adults.map((candidate) =>
                            candidate.id === adult.id
                              ? {
                                  ...candidate,
                                  relationshipToHousehold: event.target.value as typeof candidate.relationshipToHousehold,
                                }
                              : candidate,
                          ),
                        }))
                      }
                    >
                      <option value="primary">Persona principal</option>
                      <option value="spouse_partner">Cónyuge o pareja</option>
                      <option value="other_adult">Otra persona adulta</option>
                    </select>
                  </div>
                  {index > 0 ? (
                    <button
                      className="icon-button"
                      type="button"
                      aria-label={`Eliminar persona adulta ${index + 1}`}
                      onClick={() =>
                        updateHousehold((current) => ({
                          ...current,
                          adults: current.adults.filter((candidate) => candidate.id !== adult.id),
                        }))
                      }
                    >
                      <Trash2 size={18} aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
            {household.adults.length < 3 ? (
              <button
                className="add-button"
                type="button"
                onClick={() =>
                  updateHousehold((current) => ({
                    ...current,
                    adults: [...current.adults, createAdult(current.adults.length)],
                  }))
                }
              >
                <Plus size={17} aria-hidden="true" /> Añadir otra persona adulta
              </button>
            ) : null}
          </fieldset>

          <fieldset>
            <div className="legend-row">
              <legend>Personas dependientes</legend>
              <span>{household.dependants.length} de 6</span>
            </div>
            <div className="dependant-list">
              {household.dependants.map((dependant, index) => (
                <div className="dependant-row" key={dependant.id}>
                  <span>Dependiente {index + 1}</span>
                  <label>
                    Edad
                    <input
                      type="number"
                      min="0"
                      max="110"
                      value={dependant.age}
                      onChange={(event) =>
                        updateHousehold((current) => ({
                          ...current,
                          dependants: current.dependants.map((candidate) =>
                            candidate.id === dependant.id
                              ? { ...candidate, age: Number(event.target.value) }
                              : candidate,
                          ),
                        }))
                      }
                    />
                  </label>
                  <label className="check-control compact-check">
                    <input
                      type="checkbox"
                      checked={dependant.sharedCustody}
                      onChange={(event) =>
                        updateHousehold((current) => ({
                          ...current,
                          dependants: current.dependants.map((candidate) =>
                            candidate.id === dependant.id
                              ? { ...candidate, sharedCustody: event.target.checked }
                              : candidate,
                          ),
                        }))
                      }
                    />
                    <span>Custodia compartida</span>
                  </label>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={`Eliminar dependiente ${index + 1}`}
                    onClick={() =>
                      updateHousehold((current) => ({
                        ...current,
                        dependants: current.dependants.filter(
                          (candidate) => candidate.id !== dependant.id,
                        ),
                      }))
                    }
                  >
                    <Minus size={18} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
            {household.dependants.length < 6 ? (
              <button
                className="add-button"
                type="button"
                onClick={() =>
                  updateHousehold((current) => ({
                    ...current,
                    dependants: [...current.dependants, createDependant()],
                  }))
                }
              >
                <Plus size={17} aria-hidden="true" /> Añadir persona dependiente
              </button>
            ) : null}
          </fieldset>

          <div className="form-actions">
            <Link className="button button-quiet" href="/calculator">
              <ArrowLeft size={17} aria-hidden="true" /> Volver
            </Link>
            {supported ? (
              <Link className="button" href="/calculator/income">
                Continuar <ArrowRight size={17} aria-hidden="true" />
              </Link>
            ) : (
              <Link className="button" href="/methodology/limitations">
                Ver cobertura territorial <ArrowRight size={17} aria-hidden="true" />
              </Link>
            )}
          </div>
        </form>
        <aside className="form-aside">
          <Notice tone="privacy" title="Por qué lo preguntamos">
            La residencia elige el régimen fiscal. Edad y parentesco determinan mínimos
            personales y familiares. No usamos estos datos para segmentarte.
          </Notice>
          <div className="aside-card">
            <strong>Estado local</strong>
            <p>Los cambios permanecen en memoria mientras navegas. No se guardan automáticamente.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
