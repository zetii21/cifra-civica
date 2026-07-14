import {
  COMMUNITIES,
  createDefaultSettings,
  INSTRUMENTS,
  LAB_MODEL_VERSION,
  SPENDING_PROGRAMS,
  type CommunityCode,
  type PolicySettings,
} from "./fiscal-lab";

/**
 * Codec for carrying a lab scenario outside the page: as an explicit local
 * save (IndexedDB, device-only) or as a URL *fragment* share link. Fragments
 * never reach the server, so a shared scenario stays between the two people
 * exchanging the link. Payloads contain only policy-lever positions — no
 * household data, no identifiers, no timestamps.
 *
 * Decoding never trusts the payload: unknown keys are dropped, values are
 * clamped to each lever's published range and a model-version mismatch
 * rejects the whole payload rather than guessing.
 */

export interface PackedScenario {
  version: string;
  settings: {
    st?: number[];
    sv?: number[];
    au?: Record<string, number>;
    ir?: Record<string, number>;
    irr?: Record<string, Record<string, number>>;
    sm?: Record<string, number>;
    srm?: Record<string, Record<string, number>>;
  };
}

const STATE_DELTA_RANGE: [number, number] = [-5, 5];
const SAVINGS_DELTA_RANGE: [number, number] = [-5, 8];
const AUTONOMOUS_DELTA_RANGE: [number, number] = [-4, 4];

const COMMUNITY_CODES = new Set<string>(COMMUNITIES.map((community) => community.code));
const INSTRUMENT_RANGES = new Map<string, [number, number]>(
  INSTRUMENTS.map((instrument) => [instrument.id, [instrument.minRate, instrument.maxRate]]),
);
const PROGRAM_RANGES = new Map<string, [number, number]>(
  SPENDING_PROGRAMS.map((program) => [program.id, [program.minMultiplier, program.maxMultiplier]]),
);

function clamp(value: number, [min, max]: [number, number]): number {
  return Math.min(max, Math.max(min, value));
}

function packDeltaArray(deltas: number[]): number[] | undefined {
  return deltas.some((delta) => delta !== 0) ? deltas : undefined;
}

function packRecord<Value>(record: Record<string, Value>): Record<string, Value> | undefined {
  return Object.keys(record).length > 0 ? record : undefined;
}

export function packScenario(settings: PolicySettings): PackedScenario {
  const regionalRates: Record<string, Record<string, number>> = {};
  for (const [id, overrides] of Object.entries(settings.instrumentRegionalRates)) {
    if (Object.keys(overrides).length > 0) regionalRates[id] = { ...overrides };
  }
  const regionalMultipliers: Record<string, Record<string, number>> = {};
  for (const [id, overrides] of Object.entries(settings.spendingRegionalMultipliers)) {
    if (Object.keys(overrides).length > 0) regionalMultipliers[id] = { ...overrides };
  }
  return {
    version: LAB_MODEL_VERSION,
    settings: {
      st: packDeltaArray(settings.irpfStateBracketDeltas),
      sv: packDeltaArray(settings.irpfSavingsBracketDeltas),
      au: packRecord(settings.irpfAutonomousDeltas),
      ir: packRecord(settings.instrumentRates),
      irr: packRecord(regionalRates),
      sm: packRecord(settings.spendingMultipliers),
      srm: packRecord(regionalMultipliers),
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readDeltaArray(
  raw: unknown,
  target: number[],
  range: [number, number],
): void {
  if (!Array.isArray(raw)) return;
  for (let index = 0; index < Math.min(raw.length, target.length); index += 1) {
    const value = raw[index];
    if (typeof value === "number" && Number.isFinite(value)) {
      target[index] = clamp(value, range);
    }
  }
}

function readNumberRecord(
  raw: unknown,
  isKnownKey: (key: string) => boolean,
  rangeFor: (key: string) => [number, number] | undefined,
): Record<string, number> {
  const result: Record<string, number> = {};
  if (!isRecord(raw)) return result;
  for (const [key, value] of Object.entries(raw)) {
    if (!isKnownKey(key)) continue;
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    const range = rangeFor(key);
    result[key] = range ? clamp(value, range) : value;
  }
  return result;
}

/** Validates an untrusted payload into usable settings, or null. */
export function unpackScenario(raw: unknown): PolicySettings | null {
  if (!isRecord(raw)) return null;
  if (raw.version !== LAB_MODEL_VERSION) return null;
  if (!isRecord(raw.settings)) return null;
  const payload = raw.settings;

  const settings = createDefaultSettings();
  readDeltaArray(payload.st, settings.irpfStateBracketDeltas, STATE_DELTA_RANGE);
  readDeltaArray(payload.sv, settings.irpfSavingsBracketDeltas, SAVINGS_DELTA_RANGE);

  const autonomous = readNumberRecord(
    payload.au,
    (key) => COMMUNITY_CODES.has(key),
    () => AUTONOMOUS_DELTA_RANGE,
  );
  for (const [code, delta] of Object.entries(autonomous)) {
    if (delta !== 0) settings.irpfAutonomousDeltas[code as CommunityCode] = delta;
  }

  settings.instrumentRates = readNumberRecord(
    payload.ir,
    (key) => INSTRUMENT_RANGES.has(key),
    (key) => INSTRUMENT_RANGES.get(key),
  );
  settings.spendingMultipliers = readNumberRecord(
    payload.sm,
    (key) => PROGRAM_RANGES.has(key),
    (key) => PROGRAM_RANGES.get(key),
  );

  if (isRecord(payload.irr)) {
    for (const [id, overrides] of Object.entries(payload.irr)) {
      if (!INSTRUMENT_RANGES.has(id)) continue;
      const cleaned = readNumberRecord(
        overrides,
        (key) => COMMUNITY_CODES.has(key),
        () => INSTRUMENT_RANGES.get(id),
      );
      if (Object.keys(cleaned).length > 0) {
        settings.instrumentRegionalRates[id] = cleaned as Record<CommunityCode, number>;
      }
    }
  }
  if (isRecord(payload.srm)) {
    for (const [id, overrides] of Object.entries(payload.srm)) {
      if (!PROGRAM_RANGES.has(id)) continue;
      const cleaned = readNumberRecord(
        overrides,
        (key) => COMMUNITY_CODES.has(key),
        () => PROGRAM_RANGES.get(id),
      );
      if (Object.keys(cleaned).length > 0) {
        settings.spendingRegionalMultipliers[id] = cleaned as Record<CommunityCode, number>;
      }
    }
  }

  return settings;
}

/** URL-fragment codec (base64url of the packed JSON; ASCII only). */
export function encodeScenarioFragment(settings: PolicySettings): string {
  const json = JSON.stringify(packScenario(settings));
  return btoa(json).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export function decodeScenarioFragment(fragment: string): PolicySettings | null {
  try {
    const base64 = fragment.replaceAll("-", "+").replaceAll("_", "/");
    const parsed: unknown = JSON.parse(atob(base64));
    return unpackScenario(parsed);
  } catch {
    return null;
  }
}
