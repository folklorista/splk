// Bez backendu se změny demo dat (účast, příspěvky, komentáře…) ukládají jen do prohlížeče,
// aby přežily reload. Úložiště může být nedostupné (anonymní okno, zablokovaná data) –
// pak se data drží jen v paměti.

export const DEMO_STORAGE_PREFIX = 'splk.demo.';

// Zvýšit při změně tvaru mock dat – starší uložená data se pak zahodí místo toho,
// aby rozbila novou verzi aplikace
export const DEMO_DATA_VERSION = 5;

const VERSION_KEY = `${DEMO_STORAGE_PREFIX}version`;

function storageVersionMatches(): boolean {
  if (localStorage.getItem(VERSION_KEY) === String(DEMO_DATA_VERSION)) return true;
  clearDemoData();
  localStorage.setItem(VERSION_KEY, String(DEMO_DATA_VERSION));
  return false;
}

export function demoStorageKey(name: string): string {
  return `${DEMO_STORAGE_PREFIX}${name}`;
}

export function loadDemoData<T>(name: string, seed: () => T): T {
  try {
    if (!storageVersionMatches()) return seed();
    const raw = localStorage.getItem(demoStorageKey(name));
    return raw ? (JSON.parse(raw) as T) : seed();
  } catch {
    return seed();
  }
}

export function saveDemoData<T>(name: string, value: T): void {
  try {
    localStorage.setItem(demoStorageKey(name), JSON.stringify(value));
    localStorage.setItem(VERSION_KEY, String(DEMO_DATA_VERSION));
  } catch {
    // úložiště nedostupné nebo plné – změna platí jen do reloadu
  }
}

// Smaže všechna uložená demo data (přihlášení zůstává)
export function clearDemoData(): void {
  try {
    Object.keys(localStorage)
      .filter((key) => key.startsWith(DEMO_STORAGE_PREFIX))
      .forEach((key) => localStorage.removeItem(key));
  } catch {
    // nic k mazání
  }
}
