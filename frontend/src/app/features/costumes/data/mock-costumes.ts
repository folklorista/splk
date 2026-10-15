import { CostumeItem, CostumeState, Loan } from '../models/costume.model';

// Ukázková krojová evidence pro demo – pokrývá situace ze specifikace (docs/06, kap. 11):
// stejná čísla v různých řadách, znovu použité číslo po vyřazení, samostatně půjčený šátek z kompletu,
// neočíslované mašle, externista, nevrácená věc po termínu, vrácená nevypraná košile.
// Data zápůjček se počítají relativně k dnešku, aby demo nezestárlo.

const SERIES = { hornackaCerna: 1, kopanicka: 2, slovenskaStara: 3 };
const PART = { kosile: 1, kordulka: 2, sukne: 3, satek: 4, fertoch: 5, masle: 6, kalhoty: 7, vesta: 8, klobouk: 9, pentle: 10 };

function daysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(12, 0, 0, 0);
  return date.toISOString();
}

function item(id: number, seriesId: number, number: number | undefined, partTypeId: number, extra: Partial<CostumeItem> = {}): CostumeItem {
  return { id, seriesId, number, partTypeId, ready: true, createdAt: '2026-09-01T10:00:00.000Z', ...extra };
}

export function seedCostumeState(): CostumeState {
  const items: CostumeItem[] = [
    // Komplet 1 – horňácká černá, ženský
    item(1, SERIES.hornackaCerna, 1, PART.kosile, { kitId: 1, size: '38' }),
    item(2, SERIES.hornackaCerna, 1, PART.kordulka, { kitId: 1, size: '38' }),
    item(3, SERIES.hornackaCerna, 1, PART.sukne, { kitId: 1 }),
    item(4, SERIES.hornackaCerna, 1, PART.satek, { kitId: 1, description: 'černý s výšivkou' }),
    item(5, SERIES.hornackaCerna, 1, PART.fertoch, { kitId: 1 }),
    // Komplet 2 – horňácká černá, ženský (svěřen dlouhodobě)
    item(6, SERIES.hornackaCerna, 2, PART.kosile, { kitId: 2, size: '40' }),
    item(7, SERIES.hornackaCerna, 2, PART.kordulka, { kitId: 2, size: '40', note: 'povolený šev u zapínání' }),
    item(8, SERIES.hornackaCerna, 2, PART.sukne, { kitId: 2 }),
    item(9, SERIES.hornackaCerna, 2, PART.satek, { kitId: 2 }),
    // Komplet 3 – kopaničký mužský
    item(10, SERIES.kopanicka, 1, PART.kosile, { kitId: 3, size: 'L' }),
    item(11, SERIES.kopanicka, 1, PART.kalhoty, { kitId: 3, size: 'L' }),
    item(12, SERIES.kopanicka, 1, PART.vesta, { kitId: 3 }),
    item(13, SERIES.kopanicka, 1, PART.klobouk, { kitId: 3, note: 'chybí pero' }),
    // Samostatné součásti
    item(14, SERIES.slovenskaStara, 1, PART.kosile, { size: 'M' }),
    item(15, SERIES.slovenskaStara, 2, PART.kosile, { size: 'S', ready: false, note: 'po vrácení nevypraná' }),
    item(16, SERIES.hornackaCerna, 3, PART.kosile, {
      size: '36',
      retired: { at: '2026-09-20T10:00:00.000Z', byUserId: 0, reason: 'roztržená, neopravitelná' },
    }),
    // Nová košile s uvolněným číslem 3 – historie vyřazené se nespojuje
    item(17, SERIES.hornackaCerna, 3, PART.kosile, { size: '36', createdAt: '2026-10-01T10:00:00.000Z' }),
    // Jedinečná součást, která ještě nedostala fyzické číslo
    item(18, SERIES.kopanicka, undefined, PART.vesta, { description: 'nově ušitá, čeká na číslo' }),
    item(19, SERIES.kopanicka, 14, PART.kordulka, { size: '42' }),
  ];

  const loans: Loan[] = [
    // Šátek z kompletu 1 je samostatně půjčený (komplet je neúplný)
    {
      id: 1,
      borrower: { kind: 'member', memberId: 4 },
      issuedAt: daysFromNow(-12),
      dueAt: daysFromNow(9),
      longTerm: false,
      note: 'na vystoupení',
      issuedByUserId: 0,
      lines: [{ id: 1, itemId: 4, count: 1, fromKitId: 1, returns: [] }],
    },
    // Komplet 2 dlouhodobě svěřený člence včetně dvou mašlí; jedna mašle už se vrátila do kompletu (1 ze 2)
    {
      id: 2,
      borrower: { kind: 'member', memberId: 1 },
      kitId: 2,
      issuedAt: daysFromNow(-60),
      longTerm: true,
      issuedByUserId: 0,
      lines: [
        { id: 1, itemId: 6, count: 1, fromKitId: 2, returns: [] },
        { id: 2, itemId: 7, count: 1, fromKitId: 2, returns: [] },
        { id: 3, itemId: 8, count: 1, fromKitId: 2, returns: [] },
        { id: 4, itemId: 9, count: 1, fromKitId: 2, returns: [] },
        {
          id: 5,
          partTypeId: PART.masle,
          count: 2,
          fromKitId: 2,
          returns: [{ at: daysFromNow(-20), count: 1, note: 'jedna vrácena dřív, druhá zůstává u členky', ready: true, byUserId: 0 }],
        },
      ],
    },
    // Externista – po termínu vrácení
    {
      id: 3,
      borrower: { kind: 'external', externalId: 1 },
      issuedAt: daysFromNow(-30),
      dueAt: daysFromNow(-3),
      longTerm: false,
      note: 'hostování na hodech v Hradčovicích',
      issuedByUserId: 0,
      lines: [{ id: 1, itemId: 14, count: 1, returns: [] }],
    },
    // Vrácená nevypraná košile – zápůjčka uzavřená, košile zatím nepřipravená
    {
      id: 4,
      borrower: { kind: 'member', memberId: 5 },
      issuedAt: daysFromNow(-25),
      dueAt: daysFromNow(-10),
      longTerm: false,
      issuedByUserId: 0,
      lines: [
        { id: 1, itemId: 15, count: 1, returns: [{ at: daysFromNow(-9), count: 1, note: 'vrácena nevypraná', ready: false, byUserId: 0 }] },
      ],
    },
  ];

  return {
    series: [
      { id: SERIES.hornackaCerna, name: 'Horňácká černá' },
      { id: SERIES.kopanicka, name: 'Kopaničká' },
      { id: SERIES.slovenskaStara, name: 'Slovenská stará' },
    ],
    partTypes: [
      { id: PART.kosile, name: 'Košile', numbered: true },
      { id: PART.kordulka, name: 'Kordulka', numbered: true },
      { id: PART.sukne, name: 'Sukně', numbered: true },
      { id: PART.satek, name: 'Šátek', numbered: true },
      { id: PART.fertoch, name: 'Fěrtoch', numbered: true },
      { id: PART.masle, name: 'Úzká mašle do vlasů', numbered: false },
      { id: PART.kalhoty, name: 'Kalhoty', numbered: true },
      { id: PART.vesta, name: 'Vesta', numbered: true },
      { id: PART.klobouk, name: 'Klobouk', numbered: true },
      { id: PART.pentle, name: 'Pentle', numbered: false },
    ],
    items,
    kits: [
      { id: 1, label: 'HČ ženský 1', seriesId: SERIES.hornackaCerna, bulk: [{ partTypeId: PART.masle, required: 2, present: 2 }], createdAt: '2026-09-01T10:00:00.000Z' },
      { id: 2, label: 'HČ ženský 2', seriesId: SERIES.hornackaCerna, bulk: [{ partTypeId: PART.masle, required: 2, present: 1 }], createdAt: '2026-09-01T10:00:00.000Z' },
      { id: 3, label: 'Kopaničký mužský 1', seriesId: SERIES.kopanicka, bulk: [{ partTypeId: PART.pentle, required: 1, present: 1 }], createdAt: '2026-09-01T10:00:00.000Z' },
    ],
    externals: [{ id: 1, name: 'Marie Dvořáková', contact: '777 123 456', note: 'Hradčovice, hostování', createdAt: '2026-09-10T10:00:00.000Z' }],
    loans,
    log: [
      { id: 1, at: '2026-09-20T10:00:00.000Z', byUserId: 0, kind: 'item-retired', itemId: 16, text: 'Vyřazeno: Košile – horňácká černá 3', note: 'roztržená, neopravitelná' },
      { id: 2, at: '2026-10-01T10:00:00.000Z', byUserId: 0, kind: 'item-created', itemId: 17, text: 'Založeno: Košile – horňácká černá 3' },
    ],
    inventories: [],
  };
}
