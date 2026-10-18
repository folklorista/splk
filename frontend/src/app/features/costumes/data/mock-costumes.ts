import { Member } from '../../../core/models/member.model';
import { GROUP_IDS } from '../../../core/data/mock-groups';
import { MOCK_MEMBERS } from '../../members/data/mock-members';
import { Borrower, CostumeItem, CostumeLoan, CostumeSeries, CostumeState, CostumeWorkOrder } from '../models/costume.model';
import { Inventory, InventoryCheck, InventorySlot, InventoryVisit, emptyScope } from '../models/inventory.model';

// Demo krojový fond Vonice (docs/zadani-pro-robota-krojarna-inventury.md kap. 5):
// mužské i ženské součástky více regionů, varianty v klíči řady i jako atribut kusu, nesouvislá čísla
// a vyřazené kusy; osoby ve více skupinách s více rozdílně očíslovanými kusy; nezapůjčené kusy ve skladu,
// kus v opravě a u švadleny; rozběhnutá inventura „Ženské Kopanice“ s plným termínem a dokončená
// skupinová „Kroje muzikantů“ (vše přineseno / nepředložený kus); uzavřená loňská inventura.
// Držitelé se vybírají podle skupin, aby demo fungovalo s vymyšlenými i s lokálně importovanými členy.
// Data se počítají relativně k dnešku, aby demo nezestárlo.

const ENSEMBLE = 1;
const P = {
  kosile: 1, gate: 2, traslavice: 3, pruclek: 4, klobouk: 5, cizmy: 6,
  rukavce: 7, spodnica: 8, fertuska: 9, satka: 10, kordulka: 11, saky: 12,
};

function daysFromNow(days: number, hour = 12): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

interface SeriesSeed {
  id: number;
  genderId: string;
  regionId: string;
  partTypeId: number;
  variantId?: string;
  // Čísla aktivních kusů a čísla vyřazených kusů (čísla se nerecyklují, mezery jsou validní)
  numbers: number[];
  retired?: number[];
  // Varianta jako atribut jednotlivých kusů: číslo → varianta
  itemVariants?: Record<number, string>;
}

const SERIES: SeriesSeed[] = [
  // Mužské
  { id: 1, genderId: 'male', regionId: 'hornacko', partTypeId: P.kosile, numbers: [1, 2, 3, 4, 6, 7, 8, 9, 11, 12, 14, 15], retired: [5] },
  { id: 2, genderId: 'male', regionId: 'hornacko', partTypeId: P.gate, numbers: [1, 2, 3, 4, 6, 7, 8, 12], retired: [5],
    itemVariants: { 1: 'modre', 2: 'bile', 3: 'bile', 4: 'bile', 6: 'modre', 7: 'modre', 8: 'bile', 12: 'modre', 5: 'bile' } },
  { id: 3, genderId: 'male', regionId: 'hornacko', partTypeId: P.pruclek, numbers: [1, 2, 3, 5, 6] },
  { id: 4, genderId: 'male', regionId: 'hornacko', partTypeId: P.klobouk, numbers: [1, 2, 4, 9, 10] },
  { id: 5, genderId: 'male', regionId: 'hornacko', partTypeId: P.cizmy, numbers: [1, 2, 3] },
  { id: 6, genderId: 'male', regionId: 'kopanice', partTypeId: P.kosile, numbers: [1, 2, 3, 4] },
  { id: 7, genderId: 'male', regionId: 'kopanice', partTypeId: P.gate, numbers: [1, 2, 3] },
  { id: 8, genderId: 'male', regionId: 'kopanice', partTypeId: P.klobouk, numbers: [1, 2] },
  { id: 9, genderId: 'male', regionId: 'slovensko', partTypeId: P.kosile, numbers: [1, 2, 3, 5] },
  { id: 10, genderId: 'male', regionId: 'slovensko', partTypeId: P.gate, variantId: 'modre', numbers: [1, 2, 3, 5] },
  { id: 11, genderId: 'male', regionId: 'slovensko', partTypeId: P.gate, variantId: 'bile', numbers: [1, 2] },
  { id: 12, genderId: 'male', regionId: 'zalesi', partTypeId: P.traslavice, numbers: [1, 2, 3] },
  // Ženské
  { id: 13, genderId: 'female', regionId: 'hornacko', partTypeId: P.rukavce, numbers: [1, 2, 3, 4] },
  { id: 14, genderId: 'female', regionId: 'hornacko', partTypeId: P.spodnica, numbers: [1, 2, 3] },
  { id: 15, genderId: 'female', regionId: 'hornacko', partTypeId: P.fertuska, numbers: [1, 2] },
  { id: 16, genderId: 'female', regionId: 'hornacko', partTypeId: P.satka, numbers: [1, 2, 3] },
  { id: 17, genderId: 'female', regionId: 'hornacko', partTypeId: P.kordulka, numbers: [1, 2] },
  { id: 18, genderId: 'female', regionId: 'kopanice', partTypeId: P.rukavce, numbers: [1, 2, 3, 4, 5, 6, 8, 9, 10, 12], retired: [7, 11] },
  { id: 19, genderId: 'female', regionId: 'kopanice', partTypeId: P.spodnica, numbers: [1, 2, 3, 4, 5, 6, 7] },
  { id: 20, genderId: 'female', regionId: 'kopanice', partTypeId: P.fertuska, numbers: [1, 2, 3, 4, 5, 6, 8],
    itemVariants: { 1: 'nove', 2: 'nove', 3: 'stare', 4: 'stare', 5: 'nove', 6: 'stare', 8: 'nove' } },
  { id: 21, genderId: 'female', regionId: 'kopanice', partTypeId: P.satka, numbers: [1, 2, 3, 4, 5, 6, 7] },
  { id: 22, genderId: 'female', regionId: 'zalesi', partTypeId: P.rukavce, numbers: [1, 2, 3] },
  { id: 23, genderId: 'female', regionId: 'zalesi', partTypeId: P.saky, numbers: [1, 2] },
];

export function seedCostumeState(members: Member[] = MOCK_MEMBERS): CostumeState {
  // --- Kusy ---
  const items: CostumeItem[] = [];
  const itemId = new Map<string, number>();
  for (const s of SERIES) {
    const all = [...s.numbers.map((n) => ({ n, retired: false })), ...(s.retired ?? []).map((n) => ({ n, retired: true }))].sort((a, b) => a.n - b.n);
    for (const { n, retired } of all) {
      const id = items.length + 1;
      items.push({
        id,
        ensembleId: ENSEMBLE,
        seriesId: s.id,
        number: n,
        variantId: s.itemVariants?.[n],
        condition: 'ok',
        issuable: true,
        location: 'store',
        createdAt: '2015-09-01T10:00:00.000Z',
        ...(retired ? { retired: { at: daysFromNow(-400), byMemberId: 0, reason: 'roztrhané, neopravitelné' } } : {}),
      });
      if (!retired) itemId.set(`${s.id}-${n}`, id);
    }
  }
  const I = (seriesId: number, number: number) => itemId.get(`${seriesId}-${number}`)!;
  const item = (id: number) => items.find((i) => i.id === id)!;

  // Nový kus, který ještě nedostal fyzické číslo
  items.push({ id: items.length + 1, ensembleId: ENSEMBLE, seriesId: 21, condition: 'ok', issuable: true, location: 'store', description: 'nově ušitá, čeká na číslo', createdAt: daysFromNow(-5) });
  // Kopaničká fěrtůška 4 v opravě, rukávce 6 u švadleny, spodnica 7 nevydatelná (čeká na praní)
  Object.assign(item(I(20, 4)), { location: 'repair', condition: 'damaged', issuable: false, locationNote: 'oprava lemu' });
  Object.assign(item(I(18, 6)), { location: 'seamstress', condition: 'needs-alteration', locationNote: 'zkrácení rukávů' });
  Object.assign(item(I(19, 7)), { issuable: false, note: 'po akci nevypraná' });
  Object.assign(item(I(1, 3)), { size: 'L', note: 'povolený šev u límce' });

  // --- Lidé podle skupin ---
  const active = members.filter((m) => m.isActive && !m.isExternal).sort((a, b) => a.id - b.id);
  const inGroup = (groupId: number) => active.filter((m) => m.groupIds.includes(groupId));
  const musicians = inGroup(GROUP_IDS.muzika);
  const girls = inGroup(GROUP_IDS.holky).filter((m) => !m.groupIds.includes(GROUP_IDS.sklad));
  const boys = inGroup(GROUP_IDS.kluci).filter((m) => !m.groupIds.includes(GROUP_IDS.muzika));
  const member = (m: Member | undefined): Borrower | undefined => (m ? { kind: 'member', memberId: m.id } : undefined);

  // --- Zápůjčky ---
  const loans: CostumeLoan[] = [];
  const lend = (borrower: Borrower | undefined, ids: number[], daysAgo: number, extra: Partial<CostumeLoan> = {}) => {
    if (!borrower) return [];
    return ids.map((id) => {
      const loan: CostumeLoan = { id: loans.length + 1, ensembleId: ENSEMBLE, itemId: id, borrower, issuedAt: daysFromNow(-daysAgo), issuedByMemberId: 0, ...extra };
      loans.push(loan);
      if (!loan.endedAt) item(id).location = 'holder';
      return loan;
    });
  };

  // Historie: košile 7 měl dřív někdo jiný (vráceno), gatě se jednou měnily
  lend(member(boys[1] ?? boys[0]), [I(1, 7)], 700, { endedAt: daysFromNow(-420), endedByMemberId: 0, endReason: 'returned', endNote: 'odchod z taneční' });

  // Tanečník s více rozdílně očíslovanými kusy ze dvou regionů
  const boy1 = member(boys[0]);
  lend(boy1, [I(1, 7), I(2, 12), I(3, 3), I(4, 9), I(5, 2), I(6, 2)], 300);
  // Druhý tanečník: Horňácko + Slovensko, gatě vyměněné za jiné
  const boy2 = member(boys[1]);
  const [oldGate] = lend(boy2, [I(2, 4)], 500, { endedAt: daysFromNow(-200), endedByMemberId: 0, endReason: 'exchanged', endNote: 'malé v pase' });
  lend(boy2, [I(1, 2), I(9, 1), I(10, 5)], 400);
  if (oldGate) lend(boy2, [I(2, 3)], 200, { replacesLoanId: oldGate.id, note: 'výměna za větší' });

  // Muzikanti (často zároveň v taneční)
  const mus1 = member(musicians[0]);
  const mus2 = member(musicians[1]);
  const mus3 = member(musicians[2]);
  const mus1Items = [I(1, 11), I(2, 1), I(4, 2), I(9, 3), I(10, 2)];
  const mus2Items = [I(1, 14), I(2, 6), I(4, 4)];
  lend(mus1, mus1Items, 600);
  lend(mus2, mus2Items, 350, { dueAt: daysFromNow(60) });
  lend(mus3, [I(1, 15), I(2, 7)], 250);

  // Holky – Kopanice (některé i Horňácko)
  const [g1, g2, g3, g4] = girls.map(member);
  lend(g1, [I(18, 3), I(19, 5), I(20, 2), I(21, 7), I(13, 1)], 280);
  lend(g2, [I(18, 4), I(19, 1), I(20, 6)], 260, { dueAt: daysFromNow(14) });
  lend(g3, [I(18, 8), I(21, 2)], 120);
  lend(g4, [I(18, 9), I(19, 3), I(14, 2)], 90);
  lend(member(girls[4]), [I(13, 2), I(15, 1), I(16, 3), I(17, 1)], 180);

  // Externista po termínu
  lend({ kind: 'external', externalId: 1 }, [I(9, 5)], 30, { dueAt: daysFromNow(-3), note: 'hostování na hodech v Hradčovicích' });

  // --- Pracovní úkoly ---
  const workOrders: CostumeWorkOrder[] = [
    { id: 1, ensembleId: ENSEMBLE, itemId: I(20, 4), kind: 'repair', description: 'Opravit utržený lem', status: 'in-progress', assignee: 'paní Hrušková', dueAt: daysFromNow(10), createdAt: daysFromNow(-20), createdByMemberId: 0 },
    { id: 2, ensembleId: ENSEMBLE, itemId: I(18, 6), kind: 'alteration', description: 'Zkrátit rukávy o 3 cm', status: 'open', assignee: 'švadlena Kunovice', createdAt: daysFromNow(-8), createdByMemberId: 0 },
    { id: 3, ensembleId: ENSEMBLE, itemId: I(1, 3), kind: 'resewing', description: 'Přešít límec', status: 'done', createdAt: daysFromNow(-300), createdByMemberId: 0, closedAt: daysFromNow(-280), resolution: 'hotovo, povolený šev' },
  ];

  // --- Inventury ---
  const inventories: Inventory[] = [];
  const slots: InventorySlot[] = [];
  const visits: InventoryVisit[] = [];
  const checks: InventoryCheck[] = [];
  const check = (inventoryId: number, id: number, at: string, extra: Partial<InventoryCheck> = {}) =>
    checks.push({ id: checks.length + 1, inventoryId, itemId: id, at, byMemberId: 0, mode: 'stock', presented: true, ...extra });
  const activeIds = items.filter((i) => !i.retired && i.number !== undefined).map((i) => i.id);
  const isLoaned = (id: number) => loans.some((l) => l.itemId === id && !l.endedAt);
  const holdersOf = (ids: number[]) => {
    const seen = new Map<string, Borrower>();
    for (const l of loans.filter((l) => !l.endedAt && ids.includes(l.itemId))) seen.set(JSON.stringify(l.borrower), l.borrower);
    return [...seen.values()];
  };

  // 1) Loňská celková inventura – uzavřená výslovně s nesrovnalostmi
  const pastTargets = activeIds.filter((id) => id !== I(9, 5));
  inventories.push({
    id: 1, ensembleId: ENSEMBLE, name: 'Celková inventura 2025', scope: emptyScope(), scopeLabel: 'Celý fond',
    startedAt: daysFromNow(-380), startedByMemberId: 0, targetItemIds: pastTargets, holders: holdersOf(pastTargets), additions: [], slotCapacity: 3,
    closure: { at: daysFromNow(-340), byMemberId: 0, withDiscrepancies: true, reason: 'Dva kusy u bývalých členů, dořeší se v příští inventuře.', verified: pastTargets.length - 2, total: pastTargets.length, notPresented: 2, unchecked: 0 },
  });
  pastTargets.forEach((id, index) => check(1, id, daysFromNow(-370 + (index % 20)), index >= pastTargets.length - 2 ? { presented: false, note: 'nepředloženo' } : { condition: 'ok' }));

  // 2) Ženské Kopanice – rozběhnutá, část skladu nadiktovaná, první termín plný
  const kopanice = activeIds.filter((id) => [18, 19, 20, 21].includes(item(id).seriesId));
  inventories.push({
    id: 2, ensembleId: ENSEMBLE, name: 'Ženské Kopanice – podzim', scope: { ...emptyScope(), genderIds: ['female'], regionIds: ['kopanice'] },
    scopeLabel: 'Ženské / Kopanice', startedAt: daysFromNow(-6), startedByMemberId: 0, targetItemIds: kopanice, holders: holdersOf(kopanice), additions: [], slotCapacity: 3,
  });
  slots.push(
    { id: 1, inventoryId: 2, startsAt: daysFromNow(2, 17), endsAt: daysFromNow(2, 19), capacity: 3, place: 'Krojárna, sokolovna' },
    { id: 2, inventoryId: 2, startsAt: daysFromNow(4, 17), endsAt: daysFromNow(4, 19), capacity: 3, place: 'Krojárna, sokolovna' },
    { id: 3, inventoryId: 2, startsAt: daysFromNow(9, 10), endsAt: daysFromNow(9, 12), capacity: 2, place: 'Krojárna, sokolovna' },
  );
  // Plný první termín: první tři dotčené holky (čtvrtá se už nevejde)
  [g1, g2, g3].filter(Boolean).forEach((b) => visits.push({ id: visits.length + 1, inventoryId: 2, borrower: b!, slotId: 1, status: 'booked', bookedAt: daysFromNow(-5), bookedByMemberId: 0 }));
  if (girls.length < 3) slots[0].capacity = Math.max(1, visits.length);
  for (const n of [1, 2, 5]) check(2, I(18, n), daysFromNow(-1, 18), { condition: undefined });
  check(2, I(21, 1), daysFromNow(-1, 18));

  // 3) Kroje muzikantů – skupinová, návštěvy proběhly
  const musicIds = [...mus1Items, ...mus2Items, ...(mus3 ? [I(1, 15), I(2, 7)] : [])].filter((id) => isLoaned(id));
  inventories.push({
    id: 3, ensembleId: ENSEMBLE, name: 'Kroje muzikantů', scope: { ...emptyScope(), groupIds: [GROUP_IDS.muzika] },
    scopeLabel: 'Celý fond · zapůjčeno skupině Muzika', startedAt: daysFromNow(-14), startedByMemberId: 0, targetItemIds: musicIds, holders: holdersOf(musicIds), additions: [], slotCapacity: 3,
  });
  slots.push({ id: 4, inventoryId: 3, startsAt: daysFromNow(-7, 18), endsAt: daysFromNow(-7, 20), capacity: 3, place: 'Zkušebna muziky' });
  if (mus1) {
    // Přinesl všechno
    const visitId = visits.length + 1;
    visits.push({ id: visitId, inventoryId: 3, borrower: mus1, slotId: 4, status: 'completed', bookedAt: daysFromNow(-12), bookedByMemberId: 0, completedAt: daysFromNow(-7, 19), completedByMemberId: 0 });
    mus1Items.forEach((id) => check(3, id, daysFromNow(-7, 18), { mode: 'person', visitId, condition: 'ok' }));
  }
  if (mus2) {
    // Klobouk nepředložen, košile vyžaduje úpravu – návštěva přesto dokončená
    const visitId = visits.length + 1;
    visits.push({ id: visitId, inventoryId: 3, borrower: mus2, slotId: 4, status: 'completed', bookedAt: daysFromNow(-11), bookedByMemberId: 0, completedAt: daysFromNow(-7, 20), completedByMemberId: 0, note: 'klobouk má doma, přinese příště' });
    check(3, mus2Items[0], daysFromNow(-7, 19), { mode: 'person', visitId, condition: 'needs-alteration', note: 'těsná v ramenou' });
    check(3, mus2Items[1], daysFromNow(-7, 19), { mode: 'person', visitId, condition: 'ok' });
    check(3, mus2Items[2], daysFromNow(-7, 19), { mode: 'person', visitId, presented: false, note: 'nechal doma' });
    item(mus2Items[0]).condition = 'needs-alteration';
    workOrders.push({ id: 4, ensembleId: ENSEMBLE, itemId: mus2Items[0], kind: 'alteration', description: 'Povolit v ramenou', status: 'open', createdAt: daysFromNow(-7, 19), createdByMemberId: 0, inventoryId: 3 });
  }

  const series: CostumeSeries[] = SERIES.map(({ numbers, retired, itemVariants, ...s }) => ({ ...s, ensembleId: ENSEMBLE }));

  return {
    classification: {
      ensembleId: ENSEMBLE,
      genders: [
        { id: 'male', label: 'Mužské' },
        { id: 'female', label: 'Ženské' },
      ],
      regions: [
        { id: 'hornacko', label: 'Horňácko' },
        { id: 'kopanice', label: 'Kopanice' },
        { id: 'zalesi', label: 'Zálesí' },
        { id: 'slovensko', label: 'Slovensko' },
      ],
      variants: [
        { id: 'modre', label: 'modré', partTypeIds: [P.gate] },
        { id: 'bile', label: 'bílé', partTypeIds: [P.gate] },
        { id: 'nove', label: 'nové', partTypeIds: [P.fertuska, P.rukavce] },
        { id: 'stare', label: 'staré', partTypeIds: [P.fertuska, P.rukavce] },
      ],
    },
    partTypes: [
      { id: P.kosile, name: 'Košile', genderId: 'male' },
      { id: P.gate, name: 'Gatě', genderId: 'male' },
      { id: P.traslavice, name: 'Traslavice', genderId: 'male' },
      { id: P.pruclek, name: 'Pruclek', genderId: 'male' },
      { id: P.klobouk, name: 'Klobouk', genderId: 'male' },
      { id: P.cizmy, name: 'Čižmy' },
      { id: P.rukavce, name: 'Rukávce', genderId: 'female' },
      { id: P.spodnica, name: 'Spodnica', genderId: 'female' },
      { id: P.fertuska, name: 'Fěrtůška', genderId: 'female' },
      { id: P.satka, name: 'Šatka', genderId: 'female' },
      { id: P.kordulka, name: 'Kordulka', genderId: 'female' },
      { id: P.saky, name: 'Saky', genderId: 'female' },
    ],
    series,
    items,
    externals: [{ id: 1, name: 'Marie Dvořáková', contact: '777 123 456', note: 'Hradčovice, hostování', createdAt: daysFromNow(-60) }],
    loans,
    workOrders,
    kitTemplates: [
      { id: 1, ensembleId: ENSEMBLE, name: 'Horňácký mužský kroj', genderId: 'male', regionId: 'hornacko', partTypeIds: [P.kosile, P.gate, P.pruclek, P.klobouk, P.cizmy] },
      { id: 2, ensembleId: ENSEMBLE, name: 'Kopaničký mužský kroj', genderId: 'male', regionId: 'kopanice', partTypeIds: [P.kosile, P.gate, P.klobouk] },
      { id: 3, ensembleId: ENSEMBLE, name: 'Slovenský mužský kroj', genderId: 'male', regionId: 'slovensko', partTypeIds: [P.kosile, P.gate] },
      { id: 4, ensembleId: ENSEMBLE, name: 'Horňácký ženský kroj', genderId: 'female', regionId: 'hornacko', partTypeIds: [P.rukavce, P.spodnica, P.fertuska, P.satka, P.kordulka] },
      { id: 5, ensembleId: ENSEMBLE, name: 'Kopaničký ženský kroj', genderId: 'female', regionId: 'kopanice', partTypeIds: [P.rukavce, P.spodnica, P.fertuska, P.satka] },
    ],
    events: [],
    defaultSlotCapacity: 3,
    inventories,
    inventorySlots: slots,
    inventoryVisits: visits,
    inventoryChecks: checks,
  };
}
