export const REPORT_LABELS: Record<string, string> = {
  "ok": "V pořádku",
  "damaged": "Poškozeno",
  "needs_adjustment": "Vyžaduje úpravu",
  "store": "Sklad",
  "holder": "U držitele",
  "seamstress": "U švadleny",
  "repair": "Oprava",
  "unknown": "Neznámé",
  "handover": "Skutečný výdej",
  "paper_migration": "Převzato z papíru – bez fyzického ověření",
  "issued": "Výdej",
  "returned": "Vrácení",
  "exchanged": "Výměna",
  "settled": "Vypořádání ztrátou",
  "created": "Založení",
  "condition_changed": "Změna stavu",
  "location_changed": "Změna umístění",
  "issuable_changed": "Změna vydatelnosti",
  "number_assigned": "Změna čísla",
  "details_changed": "Změna údajů",
  "retired": "Vyřazení",
  "kit_changed": "Změna určeného kompletu",
  "work_order_created": "Založení úkolu",
  "work_order_changed": "Změna úkolu",
  "inventory_checked": "Inventurní kontrola",
  "inventory_check_cancelled": "Zrušení kontroly",
  "open": "Otevřený",
  "in_progress": "Rozpracovaný",
  "done": "Hotovo",
  "cancelled": "Zrušeno",
  "adjustment": "Úprava",
  "resewing": "Přešití",
  "unverified": "Neověřeno",
  "complete": "Úplný",
  "incomplete": "Neúplný",
  "pending_check": "Čeká na kontrolu",
  "presented": "Předloženo",
  "not_presented": "Nepředloženo",
  "found": "Nalezeno",
  "not_found": "Nenalezeno",
  "quantity_mismatch": "Rozdíl počtu",
  "bulk_not_counted": "Zásoba nespočítána",
  "open_work_order": "Otevřený úkol",
  "composition_mismatch": "Nesoulad složení",
  "location_mismatch": "Nesoulad umístění"
};

const REPORT_FIELDS: Record<string, string> = {"reason": "Důvod", "note": "Poznámka", "description": "Popis", "field": "Změněný údaj", "from": "Před změnou", "to": "Po změně", "number": "Číslo", "result": "Výsledek", "condition": "Stav", "location": "Umístění", "checkedQty": "Zjištěný počet", "expectedQty": "Očekávaný počet", "verifiedQty": "Fyzicky ověřený počet", "loanId": "Výpůjčka", "inventoryId": "Inventura", "checkId": "Kontrola", "workOrderId": "Pracovní úkol", "originalIssuedOn": "Původní datum z papíru", "migratedAt": "Digitalizováno", "cancelledAt": "Kontrola zrušena"};
export function reportDetails(data: Record<string, unknown>): string {
  return Object.entries(REPORT_FIELDS).filter(([key]) => Object.hasOwn(data, key) && (data[key] === null || typeof data[key] !== 'object')).map(([key, label]) => {
    const value = data[key]; return `${label}: ${value === null ? 'neuvedeno' : typeof value === 'boolean' ? value ? 'ano' : 'ne' : REPORT_LABELS[String(value)] ?? String(value)}`;
  }).join(' · ');
}
