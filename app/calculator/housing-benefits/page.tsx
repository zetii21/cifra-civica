"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Home, PiggyBank } from "lucide-react";
import { useCalculator } from "@/app/providers";
import { ProgressSteps } from "@/components/ProgressSteps";
import { MoneyInput, Notice } from "@/components/Ui";

export default function HousingBenefitsPage() {
  const { household, updateHousehold } = useCalculator();
  const isRenter = ["renter", "social_renter"].includes(household.housing.tenure);

  return (
    <div className="shell page-shell calculator-page">
      <ProgressSteps current={2} />
      <div className="form-header">
        <span>Paso 3 de 4</span>
        <h1>Vivienda, ayudas y ahorro</h1>
        <p>Estos datos permiten separar prestaciones e ingresos de capital sin pedir documentación.</p>
      </div>
      <div className="form-layout">
        <form className="content-card content-card-padding form-card" onSubmit={(event) => event.preventDefault()}>
          <fieldset>
            <legend><span className="round-icon"><Home size={17} aria-hidden="true" /></span> Vivienda habitual</legend>
            <div className="field-grid two-columns">
              <div className="field">
                <label htmlFor="tenure">Régimen de vivienda</label>
                <select
                  id="tenure"
                  value={household.housing.tenure}
                  onChange={(event) =>
                    updateHousehold((current) => ({
                      ...current,
                      housing: {
                        ...current.housing,
                        tenure: event.target.value as typeof current.housing.tenure,
                        mortgageExists: event.target.value === "owner_with_mortgage",
                      },
                    }))
                  }
                >
                  <option value="renter">Alquiler</option>
                  <option value="social_renter">Alquiler social</option>
                  <option value="owner_with_mortgage">Propiedad con hipoteca</option>
                  <option value="owner_no_mortgage">Propiedad sin hipoteca</option>
                  <option value="living_with_family">Vivo con familiares</option>
                  <option value="other">Otra situación</option>
                </select>
              </div>
              {isRenter ? (
                <MoneyInput
                  id="annual-rent"
                  label="Alquiler pagado"
                  value={household.housing.annualRent}
                  help="Importe total pagado por el hogar durante el año."
                  onChange={(value) =>
                    updateHousehold((current) => ({
                      ...current,
                      housing: { ...current.housing, annualRent: value },
                    }))
                  }
                />
              ) : null}
            </div>
          </fieldset>

          <fieldset>
            <legend>Prestaciones del hogar</legend>
            <MoneyInput
              id="household-benefits"
              label="Ayudas no incluidas antes"
              value={household.householdBenefits}
              help="Por ejemplo, una ayuda familiar o de vivienda. No incluyas aquí salario, pensión o desempleo."
              onChange={(value) =>
                updateHousehold((current) => ({ ...current, householdBenefits: value }))
              }
            />
          </fieldset>

          <fieldset>
            <legend><span className="round-icon"><PiggyBank size={17} aria-hidden="true" /></span> Ahorro y capital</legend>
            <div className="field-grid two-columns">
              <MoneyInput
                id="interest"
                label="Intereses"
                value={household.broadCapitalIncome.annualInterest}
                onChange={(value) =>
                  updateHousehold((current) => ({
                    ...current,
                    broadCapitalIncome: { ...current.broadCapitalIncome, annualInterest: value },
                  }))
                }
              />
              <MoneyInput
                id="dividends"
                label="Dividendos"
                value={household.broadCapitalIncome.annualDividends}
                onChange={(value) =>
                  updateHousehold((current) => ({
                    ...current,
                    broadCapitalIncome: { ...current.broadCapitalIncome, annualDividends: value },
                  }))
                }
              />
            </div>
            <details className="advanced-details">
              <summary>Añadir más detalles de capital</summary>
              <div className="field-grid two-columns details-body">
                <MoneyInput
                  id="property-income"
                  label="Rendimiento inmobiliario"
                  value={household.broadCapitalIncome.annualPropertyIncome}
                  onChange={(value) =>
                    updateHousehold((current) => ({
                      ...current,
                      broadCapitalIncome: { ...current.broadCapitalIncome, annualPropertyIncome: value },
                    }))
                  }
                />
                <MoneyInput
                  id="capital-gains"
                  label="Ganancias patrimoniales"
                  value={household.broadCapitalIncome.annualCapitalGains}
                  onChange={(value) =>
                    updateHousehold((current) => ({
                      ...current,
                      broadCapitalIncome: { ...current.broadCapitalIncome, annualCapitalGains: value },
                    }))
                  }
                />
                <MoneyInput
                  id="capital-losses"
                  label="Pérdidas patrimoniales"
                  value={household.broadCapitalIncome.annualCapitalLosses}
                  onChange={(value) =>
                    updateHousehold((current) => ({
                      ...current,
                      broadCapitalIncome: { ...current.broadCapitalIncome, annualCapitalLosses: value },
                    }))
                  }
                />
                <label className="check-control">
                  <input
                    type="checkbox"
                    checked={household.broadCapitalIncome.valuesAreEstimated}
                    onChange={(event) =>
                      updateHousehold((current) => ({
                        ...current,
                        broadCapitalIncome: {
                          ...current.broadCapitalIncome,
                          valuesAreEstimated: event.target.checked,
                        },
                      }))
                    }
                  />
                  <span>Estas cifras son aproximadas</span>
                </label>
              </div>
            </details>
          </fieldset>

          <div className="form-actions">
            <Link className="button button-quiet" href="/calculator/income">
              <ArrowLeft size={17} aria-hidden="true" /> Volver
            </Link>
            <Link className="button" href="/calculator/scenarios">
              Continuar <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </form>
        <aside className="form-aside">
          <Notice tone="privacy" title="Datos especialmente sensibles">
            Las ayudas y posibles discapacidades nunca se incluyen en exportaciones por
            defecto. El servidor de cálculo tampoco conserva la solicitud.
          </Notice>
          <div className="aside-card"><strong>Fuera del MVP</strong><p>No calculamos patrimonio, sucesiones, IVA, IGIC ni impuestos especiales.</p></div>
        </aside>
      </div>
    </div>
  );
}
