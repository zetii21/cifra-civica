export * from "./types";
export {
  COMMUNITIES,
  COMMUNITY_BY_CODE,
  DECILE_MEAN_GROSS_INCOME_EUR,
  NATIONAL_GDP_MEUR,
  TOTAL_HOUSEHOLDS_THOUSANDS,
  TOTAL_POPULATION_THOUSANDS,
  buildSegments,
} from "./demography";
export {
  INSTRUMENTS,
  INSTRUMENT_BY_ID,
  INSTRUMENT_GROUP_LABELS,
} from "./instruments";
export {
  OTHER_REVENUE_MEUR,
  OTHER_SPENDING_MEUR,
  SPENDING_BY_ID,
  SPENDING_PROGRAMS,
} from "./spending";
export {
  IRPF_TARGET_MEUR,
  applyBracketDeltas,
  applyUniformDelta,
  baselineSchedules,
  calibrateIrpf,
  progressiveTaxEur,
  simulateIrpf,
} from "./irpf";
export { LAB_MODEL_VERSION, createDefaultSettings, simulateNation } from "./engine";
export {
  GOVERNMENT_PRESETS,
  buildPresetSettings,
  getPreset,
  type GovernmentPreset,
  type PresetKind,
} from "./presets";
