import type { HouseholdInput } from "./domain";

const DATABASE_NAME = "cifra-civica-local";
const STORE_NAME = "households";
const KEY = "saved-household";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
  });
}

export async function saveHouseholdLocally(household: HouseholdInput): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(household, KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

export async function loadHouseholdLocally(): Promise<HouseholdInput | null> {
  const database = await openDatabase();
  const result = await new Promise<HouseholdInput | undefined>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(KEY);
    request.onsuccess = () => resolve(request.result as HouseholdInput | undefined);
    request.onerror = () => reject(request.error);
  });
  database.close();
  return result ?? null;
}

export async function deleteLocalHousehold(): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

/**
 * Device-local presentation preference (theme). Not personal data: it never
 * leaves the device and follows the same IndexedDB pattern already reviewed
 * for local saves.
 */
export type ThemePreference = "system" | "light" | "dark";

const THEME_KEY = "theme-preference";

export async function saveThemePreference(preference: ThemePreference): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(preference, THEME_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

export async function loadThemePreference(): Promise<ThemePreference | null> {
  const database = await openDatabase();
  const result = await new Promise<ThemePreference | undefined>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(THEME_KEY);
    request.onsuccess = () => resolve(request.result as ThemePreference | undefined);
    request.onerror = () => reject(request.error);
  });
  database.close();
  return result ?? null;
}
