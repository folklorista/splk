/** Side menu of Krojařka (D-22). `path` is relative to the signed-in shell. */
export interface MenuItem {
  label: string;
  path: string;
  /** what the section will contain – shown on placeholder pages until it is implemented */
  description: string;
}

export const MENU: readonly MenuItem[] = [
  { label: 'Přehled', path: '', description: 'Co dělat dál: rozpůjčované kroje, pracovní úkoly a běžící inventury.' },
  { label: 'Součástky', path: 'soucastky', description: 'Katalog podle evidenčních řad včetně kompletů.' },
  { label: 'Krojové karty', path: 'krojove-karty', description: 'Lidé s výpůjčkami a jejich krojové karty.' },
  { label: 'Lidé', path: 'lide', description: 'Všechny osoby evidence i bez výpůjček, papírové karty a jejich převod.' },
  { label: 'Výpůjčky', path: 'vypujcky', description: 'Skladové pohyby od nejnovějších.' },
  { label: 'Inventury', path: 'inventury', description: 'Inventury ve skladu, podle lidí a kompletů.' },
  { label: 'Dokumenty', path: 'dokumenty', description: 'Archiv skenů a podkladů: osobní karty, karty a lístky kompletů, kniha zápůjček.' },
  { label: 'Přehledy', path: 'prehledy', description: 'Soupisy k tisku a exportu, náklady na kroje.' },
  { label: 'Hledat', path: 'hledat', description: 'Osoba, komplet nebo řada a číslo.' },
  { label: 'Nastavení', path: 'nastaveni', description: 'Katalog, evidenční řady, uživatelé a pověření.' },
  { label: 'Můj účet', path: 'ucet', description: 'Přihlášená krojařka, heslo a odhlášení.' },
];
