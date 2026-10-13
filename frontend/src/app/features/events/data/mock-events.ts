import { AppEvent } from '../models/event.model';

function relativeDate(daysOffset: number, hour: number, minute: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(hour)}:${pad(minute)}:00`;
}

// Počet dní od dneška do nejbližšího daného dne v týdnu (0 = neděle … 6 = sobota), dnešek včetně
function daysUntilWeekday(weekday: number): number {
  return (weekday - new Date().getDay() + 7) % 7;
}

const TUESDAY = 2;
const FRIDAY = 5;
const REHEARSAL_WEEKS_AROUND = 8;
export const FIRST_REHEARSAL_ID = 100;

// Pravidelné nácviky každé úterý (tanečníci) a pátek (celý soubor), ±8 týdnů kolem dneška
function generateRehearsals(): AppEvent[] {
  const rehearsals: AppEvent[] = [];
  let id = FIRST_REHEARSAL_ID;
  for (let week = -REHEARSAL_WEEKS_AROUND; week <= REHEARSAL_WEEKS_AROUND; week++) {
    const tuesday = daysUntilWeekday(TUESDAY) + week * 7;
    rehearsals.push({
      id: id++,
      ensembleId: 1,
      title: 'Nácvik – tanečníci',
      type: 'rehearsal',
      startsAt: relativeDate(tuesday, 18, 0),
      endsAt: relativeDate(tuesday, 20, 0),
      location: 'Kulturní dům, zkušebna',
      description: 'Pravidelný úterní nácvik tanečníků.',
      targetGroupIds: [2],
    });

    const friday = daysUntilWeekday(FRIDAY) + week * 7;
    rehearsals.push({
      id: id++,
      ensembleId: 1,
      title: 'Nácvik – celý soubor',
      type: 'rehearsal',
      startsAt: relativeDate(friday, 19, 0),
      endsAt: relativeDate(friday, 21, 30),
      location: 'Kulturní dům, sál č. 2',
      description: 'Pravidelný páteční nácvik celého souboru.',
      targetGroupIds: [1, 2],
    });
  }
  return rehearsals;
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
  {
    // Záměrně ve stejný den jako páteční nácvik
    id: 7,
    ensembleId: 1,
    title: 'Vystoupení – Hody',
    type: 'performance',
    startsAt: relativeDate(daysUntilWeekday(FRIDAY) + 7, 14, 0),
    endsAt: relativeDate(daysUntilWeekday(FRIDAY) + 7, 16, 0),
    location: 'Náves, pódium u kostela',
    description: 'Vystoupení na hodech, sraz ve 13:15 v krojích.',
    targetGroupIds: [1, 2],
  },
  ...generateRehearsals(),
];
