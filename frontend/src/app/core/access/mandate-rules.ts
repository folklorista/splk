import { Mandate } from '../models/mandate.model';
import { Member } from '../models/member.model';

// Operaci zamítl kontrolní mechanismus (v demu mock služba, později backend)
export class AccessDeniedError extends Error {
  constructor(message = 'Na tuto operaci nemáte oprávnění.') {
    super(message);
  }
}

// Operace by porušila pravidlo souboru (poslední správce, duplicitní žádost…)
export class RuleViolationError extends Error {}

function activeIds(members: Member[]): Set<number> {
  return new Set(members.filter((m) => m.isActive).map((m) => m.id));
}

export function activeEnsembleAdminIds(mandates: Mandate[], members: Member[]): number[] {
  const active = activeIds(members);
  return [...new Set(mandates.filter((m) => m.kind === 'ensemble-admin' && active.has(m.memberId)).map((m) => m.memberId))];
}

export function groupOwnerIds(mandates: Mandate[], groupId: number): number[] {
  return mandates.filter((m) => m.kind === 'group-owner' && m.groupId === groupId).map((m) => m.memberId);
}

// Vrátí důvod, proč pověření nelze odebrat, nebo null
export function mandateRevocationProblem(mandate: Mandate, mandates: Mandate[], members: Member[]): string | null {
  const rest = mandates.filter((m) => m.id !== mandate.id);
  if (mandate.kind === 'ensemble-admin' && activeEnsembleAdminIds(rest, members).length === 0) {
    return 'Soubor musí mít alespoň jednoho aktivního správce. Nejdřív pověřte jiného člověka.';
  }
  if (mandate.kind === 'group-owner' && groupOwnerIds(rest, mandate.groupId!).length === 0) {
    return 'Skupina nesmí zůstat bez hlavního správce. Nejdřív předejte správu jinému člověku.';
  }
  return null;
}

// Ukončení aktivního členství v souboru – nesmí odejít poslední správce souboru ani jediný hlavní správce skupiny
export function deactivationProblem(memberId: number, mandates: Mandate[], members: Member[], groupName: (id: number) => string): string | null {
  const rest = members.map((m) => (m.id === memberId ? { ...m, isActive: false } : m));
  if (mandates.some((m) => m.memberId === memberId && m.kind === 'ensemble-admin') && activeEnsembleAdminIds(mandates, rest).length === 0) {
    return 'Jde o posledního aktivního správce souboru. Nejdřív pověřte jiného člověka.';
  }
  const soleOwned = mandates
    .filter((m) => m.memberId === memberId && m.kind === 'group-owner')
    .filter((m) => groupOwnerIds(mandates, m.groupId!).length === 1)
    .map((m) => groupName(m.groupId!));
  if (soleOwned.length) {
    return `Nejdřív předejte hlavní správu skupin: ${soleOwned.join(', ')}.`;
  }
  return null;
}

// Odchod / odebrání ze skupiny – jediný hlavní správce musí nejdřív předat odpovědnost
export function groupLeaveProblem(memberId: number, groupId: number, mandates: Mandate[]): string | null {
  const owners = groupOwnerIds(mandates, groupId);
  if (owners.length === 1 && owners[0] === memberId) {
    return 'Hlavní správce nemůže ze skupiny odejít, dokud správu nepředá jinému.';
  }
  return null;
}
