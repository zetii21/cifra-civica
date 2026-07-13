"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  createDefaultHousehold,
  type HouseholdInput,
  type SimulationComparison,
} from "@/lib/domain";
import { calculateHousehold, SimulationApiError } from "@/lib/api-client";
import {
  deleteLocalHousehold,
  loadHouseholdLocally,
  saveHouseholdLocally,
} from "@/lib/local-store";

interface CalculatorContextValue {
  household: HouseholdInput;
  result: SimulationComparison | null;
  error: string | null;
  isCalculating: boolean;
  updateHousehold: (update: (current: HouseholdInput) => HouseholdInput) => void;
  replaceHousehold: (household: HouseholdInput) => void;
  runSimulation: () => Promise<SimulationComparison | null>;
  resetCalculator: () => void;
  saveLocally: () => Promise<void>;
  restoreLocal: () => Promise<boolean>;
  deleteLocal: () => Promise<void>;
}

const CalculatorContext = createContext<CalculatorContextValue | null>(null);

function messageForError(error: unknown): string {
  const code = error instanceof Error ? error.message : "calculation_failed";
  if (code === "unsupported_territory") {
    return "Este territorio todavía no cuenta con un modelo fiscal completo. No aplicaremos reglas de territorio común por defecto.";
  }
  if (code === "invalid_scenario") {
    return "Uno de los escenarios ya no está disponible. Revisa la selección.";
  }
  if (code === "api_unavailable") {
    return "El motor fiscal no está disponible. No hemos sustituido el cálculo por una aproximación silenciosa; inténtalo de nuevo.";
  }
  return "No hemos podido completar la estimación. Revisa los datos e inténtalo de nuevo.";
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [household, setHousehold] = useState<HouseholdInput>(() =>
    createDefaultHousehold(),
  );
  const [result, setResult] = useState<SimulationComparison | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  const updateHousehold = useCallback(
    (update: (current: HouseholdInput) => HouseholdInput) => {
      setHousehold((current) => update(current));
      setResult(null);
      setError(null);
    },
    [],
  );

  const replaceHousehold = useCallback((nextHousehold: HouseholdInput) => {
    setHousehold(nextHousehold);
    setResult(null);
    setError(null);
  }, []);

  const runSimulation = useCallback(async () => {
    setIsCalculating(true);
    try {
      const nextResult = await calculateHousehold(household);
      setResult(nextResult);
      setError(null);
      return nextResult;
    } catch (simulationError) {
      setError(
        messageForError(
          simulationError instanceof SimulationApiError
            ? new Error(simulationError.code)
            : simulationError,
        ),
      );
      setResult(null);
      return null;
    } finally {
      setIsCalculating(false);
    }
  }, [household]);

  const resetCalculator = useCallback(() => {
    setHousehold(createDefaultHousehold());
    setResult(null);
    setError(null);
  }, []);

  const value = useMemo<CalculatorContextValue>(
    () => ({
      household,
      result,
      error,
      isCalculating,
      updateHousehold,
      replaceHousehold,
      runSimulation,
      resetCalculator,
      saveLocally: () => saveHouseholdLocally(household),
      restoreLocal: async () => {
        const saved = await loadHouseholdLocally();
        if (!saved) return false;
        replaceHousehold(saved);
        return true;
      },
      deleteLocal: deleteLocalHousehold,
    }),
    [
      household,
      result,
      error,
      isCalculating,
      updateHousehold,
      replaceHousehold,
      runSimulation,
      resetCalculator,
    ],
  );

  return (
    <CalculatorContext.Provider value={value}>
      {children}
    </CalculatorContext.Provider>
  );
}

export function useCalculator(): CalculatorContextValue {
  const context = useContext(CalculatorContext);
  if (!context) {
    throw new Error("useCalculator must be used within AppProviders");
  }
  return context;
}
