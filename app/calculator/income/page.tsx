"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, BriefcaseBusiness, CircleHelp } from "lucide-react";
import { useCalculator } from "@/app/providers";
import { ProgressSteps } from "@/components/ProgressSteps";
import { MoneyInput, Notice } from "@/components/Ui";

export default function IncomePage() {
  const { household, updateHousehold } = useCalculator();

  return (
    <div className="shell page-shell calculator-page">
      <ProgressSteps current={1} />
      <div className="form-header">
        <span>Paso 2 de 4</span>
        <h1>Ingresos de cada persona</h1>
        <p>Introduce importes brutos anuales. Redondear a los cientos de euros es suficiente.</p>
      </div>
      <div className="form-layout">
        <form className="content-card content-card-padding form-card" onSubmit={(event) => event.preventDefault()}>
          {household.adults.map((adult, index) => (
            <fieldset className="adult-income" key={adult.id}>
              <legend>
                <span className="round-icon"><BriefcaseBusiness size={17} aria-hidden="true" /></span>
                Persona adulta {index + 1}
              </legend>
              <div className="field-grid two-columns">
                <div className="field">
                  <label htmlFor={`employment-${adult.id}`}>Situación principal</label>
                  <select
                    id={`employment-${adult.id}`}
                    value={adult.employmentStatus}
                    onChange={(event) =>
                      updateHousehold((current) => ({
                        ...current,
                        adults: current.adults.map((candidate) =>
                          candidate.id === adult.id
                            ? { ...candidate, employmentStatus: event.target.value as typeof candidate.employmentStatus }
                            : candidate,
                        ),
                      }))
                    }
                  >
                    <option value="employee">Trabajo por cuenta ajena</option>
                    <option value="self_employed">Trabajo autónomo</option>
                    <option value="mixed">Varias situaciones</option>
                    <option value="unemployed">Desempleo</option>
                    <option value="retired">Jubilación</option>
                    <option value="student">Estudios</option>
                    <option value="inactive">Sin actividad</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor={`quality-${adult.id}`}>Calidad de la cifra</label>
                  <select
                    id={`quality-${adult.id}`}
                    value={adult.dataQuality}
                    onChange={(event) =>
                      updateHousehold((current) => ({
                        ...current,
                        adults: current.adults.map((candidate) =>
                          candidate.id === adult.id
                            ? { ...candidate, dataQuality: event.target.value as typeof candidate.dataQuality }
                            : candidate,
                        ),
                      }))
                    }
                  >
                    <option value="exact">Exacta o casi exacta</option>
                    <option value="estimated">Estimación</option>
                    <option value="unknown">No estoy seguro/a</option>
                  </select>
                </div>
              </div>
              <div className="field-grid two-columns">
                <MoneyInput
                  id={`salary-${adult.id}`}
                  label="Salario bruto"
                  value={adult.annualGrossEmploymentIncome}
                  onChange={(value) =>
                    updateHousehold((current) => ({
                      ...current,
                      adults: current.adults.map((candidate) =>
                        candidate.id === adult.id
                          ? { ...candidate, annualGrossEmploymentIncome: value }
                          : candidate,
                      ),
                    }))
                  }
                />
                <MoneyInput
                  id={`self-employed-${adult.id}`}
                  label="Rendimiento neto de autónomo/a"
                  value={adult.annualSelfEmploymentNetIncome}
                  help="Después de gastos deducibles, antes de IRPF. La cotización será aproximada."
                  onChange={(value) =>
                    updateHousehold((current) => ({
                      ...current,
                      adults: current.adults.map((candidate) =>
                        candidate.id === adult.id
                          ? { ...candidate, annualSelfEmploymentNetIncome: value }
                          : candidate,
                      ),
                    }))
                  }
                />
                <MoneyInput
                  id={`unemployment-${adult.id}`}
                  label="Prestación por desempleo"
                  value={adult.annualUnemploymentBenefits}
                  onChange={(value) =>
                    updateHousehold((current) => ({
                      ...current,
                      adults: current.adults.map((candidate) =>
                        candidate.id === adult.id
                          ? { ...candidate, annualUnemploymentBenefits: value }
                          : candidate,
                      ),
                    }))
                  }
                />
                <MoneyInput
                  id={`pension-${adult.id}`}
                  label="Pensión"
                  value={adult.annualPensionIncome}
                  onChange={(value) =>
                    updateHousehold((current) => ({
                      ...current,
                      adults: current.adults.map((candidate) =>
                        candidate.id === adult.id
                          ? { ...candidate, annualPensionIncome: value }
                          : candidate,
                      ),
                    }))
                  }
                />
              </div>
              <details className="advanced-details">
                <summary>Añadir más detalles</summary>
                <div className="field-grid two-columns details-body">
                  <MoneyInput
                    id={`taxable-benefit-${adult.id}`}
                    label="Otras prestaciones sujetas"
                    value={adult.annualOtherTaxableBenefits}
                    onChange={(value) =>
                      updateHousehold((current) => ({
                        ...current,
                        adults: current.adults.map((candidate) =>
                          candidate.id === adult.id
                            ? { ...candidate, annualOtherTaxableBenefits: value }
                            : candidate,
                        ),
                      }))
                    }
                  />
                  <MoneyInput
                    id={`exempt-${adult.id}`}
                    label="Ingresos exentos conocidos"
                    value={adult.annualExemptIncome}
                    onChange={(value) =>
                      updateHousehold((current) => ({
                        ...current,
                        adults: current.adults.map((candidate) =>
                          candidate.id === adult.id
                            ? { ...candidate, annualExemptIncome: value }
                            : candidate,
                        ),
                      }))
                    }
                  />
                  <div className="field">
                    <label htmlFor={`months-${adult.id}`}>Meses trabajados</label>
                    <input
                      id={`months-${adult.id}`}
                      type="number"
                      min="0"
                      max="12"
                      value={adult.monthsWorked}
                      onChange={(event) =>
                        updateHousehold((current) => ({
                          ...current,
                          adults: current.adults.map((candidate) =>
                            candidate.id === adult.id
                              ? { ...candidate, monthsWorked: Number(event.target.value) }
                              : candidate,
                          ),
                        }))
                      }
                    />
                  </div>
                  <div className="field">
                    <label htmlFor={`disability-${adult.id}`}>Discapacidad (banda amplia)</label>
                    <select
                      id={`disability-${adult.id}`}
                      value={adult.disabilityBand}
                      onChange={(event) =>
                        updateHousehold((current) => ({
                          ...current,
                          adults: current.adults.map((candidate) =>
                            candidate.id === adult.id
                              ? { ...candidate, disabilityBand: event.target.value as typeof candidate.disabilityBand }
                              : candidate,
                          ),
                        }))
                      }
                    >
                      <option value="none">Ninguna</option>
                      <option value="broad_lower_band">Banda inferior reconocida</option>
                      <option value="broad_higher_band">Banda superior reconocida</option>
                      <option value="unknown">No lo sé</option>
                    </select>
                    <p className="field-help">Solo se usa para mínimos fiscales amplios; nunca se guarda automáticamente.</p>
                  </div>
                </div>
              </details>
            </fieldset>
          ))}

          <div className="form-actions">
            <Link className="button button-quiet" href="/calculator/household">
              <ArrowLeft size={17} aria-hidden="true" /> Volver
            </Link>
            <Link className="button" href="/calculator/housing-benefits">
              Continuar <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </form>
        <aside className="form-aside">
          <Notice tone="info" title="Bruto, no neto">
            El salario bruto aparece en la nómina antes de retenciones. El simulador calcula
            una estimación separada de cotizaciones e IRPF.
          </Notice>
          <div className="aside-card help-card">
            <CircleHelp size={22} aria-hidden="true" />
            <div><strong>¿No sabes la cifra anual?</strong><p>Multiplica una nómina mensual por 12 y añade pagas extra. Marca “estimación” para elevar la incertidumbre.</p></div>
          </div>
        </aside>
      </div>
    </div>
  );
}
