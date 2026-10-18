import { Unavailability } from '../unavailability.model';

function dateFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

// Demo: dovolená za týden a studijní pobyt (vymyšlení členové, data relativně k dnešku)
export function seedUnavailability(): Unavailability[] {
  const now = new Date().toISOString();
  return [
    { id: 1, ensembleId: 1, memberId: 4, from: dateFromNow(5), to: dateFromNow(12), note: 'Dovolená', createdAt: now, createdById: 4 },
    { id: 2, ensembleId: 1, memberId: 7, from: dateFromNow(20), to: dateFromNow(80), note: 'Studijní pobyt v zahraničí', createdAt: now, createdById: 7 },
  ];
}
