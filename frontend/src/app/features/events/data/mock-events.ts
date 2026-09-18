import { AppEvent } from '../models/event.model';

function relativeDate(daysOffset: number, hour: number, minute: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(hour)}:${pad(minute)}:00`;
}

export const MOCK_EVENTS: AppEvent[] = [
  {
    id: 1,
    ensembleId: 1,
    title: 'Zkouška – celý soubor',
    type: 'rehearsal',
    startsAt: relativeDate(-9, 19, 30),
    endsAt: relativeDate(-9, 21, 30),
    location: 'Kulturní dům, sál č. 2',
    description: 'Pravidelná týdenní zkouška. Nacvičujeme program na festival.',
    targetGroupIds: [1],
    requiresAction: true,
  },
  {
    id: 2,
    ensembleId: 1,
    title: 'Vystoupení – Folklórní festival Strážnice',
    type: 'performance',
    startsAt: relativeDate(9, 14, 0),
    endsAt: relativeDate(9, 16, 0),
    location: 'Strážnice, hlavní pódium',
    description: 'Výjezdní vystoupení na mezinárodním folklorním festivalu.',
    targetGroupIds: [1, 2],
  },
  {
    id: 3,
    ensembleId: 1,
    title: 'Zkouška – taneční skupina',
    type: 'rehearsal',
    startsAt: relativeDate(2, 18, 0),
    endsAt: relativeDate(2, 20, 0),
    location: 'Kulturní dům, zkušebna',
    description: 'Intenzivní nácvik choreografie.',
    targetGroupIds: [2],
    requiresAction: true,
  },
  {
    id: 4,
    ensembleId: 1,
    title: 'Letní soustředění',
    type: 'camp',
    startsAt: relativeDate(16, 15, 0),
    endsAt: relativeDate(20, 17, 0),
    location: 'Luhačovice, Zálesí',
    description: 'Pětidenní soustředění s intenzivními zkouškami a společným programem.',
    targetGroupIds: [1],
  },
  {
    id: 5,
    ensembleId: 1,
    title: 'Schůzka vedení',
    type: 'meeting',
    startsAt: relativeDate(4, 17, 0),
    endsAt: relativeDate(4, 18, 30),
    location: 'Kulturní dům, zasedací místnost',
    description: 'Schůzka vedení souboru – program, finance, plánování.',
    targetGroupIds: [3],
  },
  {
    id: 6,
    ensembleId: 1,
    title: 'Zkouška – hudebníci',
    type: 'rehearsal',
    startsAt: relativeDate(-10, 20, 0),
    endsAt: relativeDate(-10, 22, 0),
    location: 'Kulturní dům, malý sál',
    description: 'Nácvik hudebního doprovodu.',
    targetGroupIds: [4],
  },
];
