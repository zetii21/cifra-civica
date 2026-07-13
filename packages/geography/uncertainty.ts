import type { UncertaintyAssessment, UncertaintyLevel, UncertaintyPattern } from "./types";

export interface UncertaintyInput {
  readonly estimate: number | null;
  readonly samplingStandardError: number | null;
  readonly modelStandardError: number | null;
  readonly approximationCount?: number;
  readonly calibrationStatus?: "calibrated" | "partially_calibrated" | "not_calibrated";
  readonly publisherConfidence?: "high" | "medium" | "low" | "not_assessed";
  readonly confidenceLevel?: number;
}

function patternFor(level: UncertaintyLevel): UncertaintyPattern {
  switch (level) {
    case "low":
      return "solid";
    case "medium":
      return "dots";
    case "high":
      return "diagonal";
    default:
      return "crosshatch";
  }
}

function rank(level: Exclude<UncertaintyLevel, "not_assessed">): number {
  return { low: 0, medium: 1, high: 2 }[level];
}

function maxLevel(
  first: Exclude<UncertaintyLevel, "not_assessed">,
  second: Exclude<UncertaintyLevel, "not_assessed">,
): Exclude<UncertaintyLevel, "not_assessed"> {
  return rank(first) >= rank(second) ? first : second;
}

/** Combines independent sampling and model uncertainty in quadrature. */
export function assessUncertainty(input: UncertaintyInput): UncertaintyAssessment {
  const confidenceLevel = input.confidenceLevel ?? 0.95;
  const reasons: string[] = [];

  if (input.estimate === null || !Number.isFinite(input.estimate)) {
    return {
      level: "not_assessed",
      reasons: ["No hay una estimación publicable."],
      standardError: null,
      relativeStandardError: null,
      lowerBound: null,
      upperBound: null,
      confidenceLevel: null,
      pattern: "crosshatch",
    };
  }

  const sampling = input.samplingStandardError;
  const model = input.modelStandardError;
  const validSampling = sampling !== null && Number.isFinite(sampling) && sampling >= 0;
  const validModel = model !== null && Number.isFinite(model) && model >= 0;

  if (!validSampling && !validModel && !input.publisherConfidence) {
    return {
      level: "not_assessed",
      reasons: ["No se han cuantificado los errores muestral y de modelo."],
      standardError: null,
      relativeStandardError: null,
      lowerBound: null,
      upperBound: null,
      confidenceLevel: null,
      pattern: "crosshatch",
    };
  }

  const standardError = Math.sqrt(
    (validSampling ? sampling ** 2 : 0) + (validModel ? model ** 2 : 0),
  );
  const relativeStandardError =
    Math.abs(input.estimate) < Number.EPSILON
      ? standardError === 0
        ? 0
        : Number.POSITIVE_INFINITY
      : standardError / Math.abs(input.estimate);

  let level: Exclude<UncertaintyLevel, "not_assessed"> =
    relativeStandardError <= 0.1 ? "low" : relativeStandardError <= 0.25 ? "medium" : "high";

  if (input.publisherConfidence && input.publisherConfidence !== "not_assessed") {
    level = maxLevel(level, input.publisherConfidence);
    reasons.push(`Confianza publicada por la fuente: ${input.publisherConfidence}.`);
  }
  if ((input.approximationCount ?? 0) > 0) {
    level = maxLevel(level, (input.approximationCount ?? 0) >= 2 ? "high" : "medium");
    reasons.push(`${input.approximationCount} aproximación(es) de modelo relevante(s).`);
  }
  if (input.calibrationStatus === "partially_calibrated") {
    level = maxLevel(level, "medium");
    reasons.push("Calibración parcial frente a agregados de referencia.");
  } else if (input.calibrationStatus === "not_calibrated") {
    level = "high";
    reasons.push("Estimación no calibrada frente a agregados oficiales.");
  }
  if (validSampling) reasons.push("Incluye incertidumbre muestral.");
  if (validModel) reasons.push("Incluye incertidumbre de modelo.");

  const z = confidenceLevel === 0.9 ? 1.645 : confidenceLevel === 0.99 ? 2.576 : 1.96;
  return {
    level,
    reasons,
    standardError,
    relativeStandardError,
    lowerBound: input.estimate - z * standardError,
    upperBound: input.estimate + z * standardError,
    confidenceLevel,
    pattern: patternFor(level),
  };
}

export function roundForHonestPrecision(value: number, assessment: UncertaintyAssessment): number {
  if (!Number.isFinite(value)) throw new Error("Cannot round a non-finite metric value");
  if (assessment.level === "low") return Math.round(value);
  if (assessment.level === "medium") return Math.round(value / 10) * 10;
  if (assessment.level === "high") return Math.round(value / 50) * 50;
  return Math.round(value / 100) * 100;
}
