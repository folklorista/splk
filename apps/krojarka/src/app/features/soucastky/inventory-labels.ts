import { CompositionState, ItemCondition, ItemLocation, WorkOrderStatus, WorkOrderType } from '@splk/api-contracts';

export const CONDITIONS: Record<ItemCondition, string> = { ok: 'v pořádku', needs_adjustment: 'vyžaduje úpravu', damaged: 'poškozeno' };
export const LOCATIONS: Record<ItemLocation, string> = { store: 'sklad', holder: 'u držitele', seamstress: 'u švadleny', repair: 'v opravě', unknown: 'neznámé' };
export const COMPOSITION_STATES: Record<CompositionState, string> = { unverified: 'složení neověřeno', complete: 'úplný', incomplete: 'neúplný', pending_check: 'čeká na kontrolu' };
export const ORDER_TYPES: Record<WorkOrderType, string> = { adjustment: 'úprava', repair: 'oprava', resewing: 'přešití' };
export const ORDER_STATES: Record<WorkOrderStatus, string> = { open: 'otevřený', in_progress: 'rozpracovaný', done: 'hotovo', cancelled: 'zrušeno' };
export const EVENT_LABELS: Record<string, string> = { issued: 'Výdej', returned: 'Vrácení', exchanged: 'Výměna', settled: 'Vypořádání ztrátou', created: 'Založení', condition_changed: 'Změna stavu', location_changed: 'Změna umístění',
  issuable_changed: 'Změna vydatelnosti', number_assigned: 'Změna čísla', details_changed: 'Změna údajů', retired: 'Vyřazení', kit_changed: 'Změna určeného kompletu',
  work_order_created: 'Založení pracovního úkolu', work_order_changed: 'Změna pracovního úkolu' };
export const FIELD_LABELS: Record<string, string> = { seriesId: 'Řada', number: 'Číslo', variant: 'Varianta', size: 'Velikost', description: 'Popis', note: 'Poznámka',
  condition: 'Stav', issuable: 'Vydatelnost', location: 'Umístění', locationNote: 'Poznámka k umístění', acquiredOn: 'Datum pořízení' };
