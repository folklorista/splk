import { Post } from '../models/post.model';
import { GROUP_IDS } from '../../../core/data/mock-groups';
import { demoMember } from '../../members/data/demo-authors';

// Data relativně k dnešku, aby demo nezestárlo
export function daysAgo(days: number, hour: number, minute = 0): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(hour)}:${pad(minute)}:00`;
}

const { vybor, tanecni, muzika, kluci, holky, malaVonica, sklad } = GROUP_IDS;

function post(
  id: number,
  groupId: number,
  authorId: number,
  title: string,
  body: string,
  publishedDaysAgo: number,
  options: Partial<Pick<Post, 'isPinned' | 'requiresAction'>> & { archivedDaysAgo?: number } = {},
): Post {
  const publishedAt = daysAgo(publishedDaysAgo, 9 + (id % 9), 15);
  return {
    id,
    ensembleId: 1,
    title,
    body,
    authorId,
    groupId,
    publishedAt,
    updatedAt: publishedAt,
    isPinned: options.isPinned ?? false,
    requiresAction: options.requiresAction ?? false,
    readers: [],
    ...(options.archivedDaysAgo !== undefined ? { archivedAt: daysAgo(options.archivedDaysAgo, 20) } : {}),
  };
}

// Každá skupina má nástěnku pro svou interní komunikaci. Autoři podle role v dané skupině:
// oznámení pro celý soubor (Taneční) píše výbor, kroje řeší Sklad (krojařky).
export const MOCK_POSTS: Post[] = [
  // Taneční – společné informace pro celý soubor
  post(1, tanecni, demoMember([vybor, tanecni]).id, 'Důležité informace k soustředění',
    'Podzimní soustředění proběhne za tři týdny v Luhačovicích. Přihlaste se prosím do konce měsíce. Doprava bude zajištěna autobusem, odjezd v pátek v 15:00 od kulturního domu.',
    6, { isPinned: true, requiresAction: true }),
  post(2, tanecni, demoMember([vybor, tanecni], 1).id, 'Změna času páteční zkoušky',
    'Páteční nácvik tento týden začne výjimečně až v 19:30, sál je do té doby obsazený. Děkujeme za pochopení.',
    4),
  post(3, tanecni, demoMember([tanecni], 3).id, 'Fotky z vystoupení na hodech',
    'Ve sdíleném albu jsou fotky z neděle. Kdo má další, přidejte je prosím do stejné složky.',
    9),
  post(4, tanecni, demoMember([sklad, tanecni]).id, 'Potřebujete něco z krojového skladu? Napište sem',
    'Kdo potřebuje vyměnit krojovou součástku (jiná velikost, poškozená, chybí), napište sem komentář – co, jakou velikost a do kdy. Ozveme se a domluvíme předání ve skladu.',
    12, { isPinned: true }),

  // Výbor
  post(5, vybor, demoMember([vybor]).id, 'Program schůzky výboru',
    'Schůzka výboru bude ve čtvrtek v 17:00 v zasedačce. Body: plán vystoupení na zimu, rozpočet na nové kroje, ples.',
    3),

  // Muzika – co se hraje, kdo může na kšeft
  post(6, muzika, demoMember([muzika]).id, 'Kšeft v sobotu za 14 dní – kdo může hrát?',
    'Máme poptávku na svatbu v sobotu za 14 dní, hrálo by se od 14 do 18 h. Napište prosím do komentářů, kdo může – potřebujeme aspoň primáš, kontr a basu.',
    2, { requiresAction: true }),
  post(7, muzika, demoMember([muzika], 1).id, 'Repertoár na hody',
    'Návrh pořadí: Dobrú noc, Vínečko bílé, Okolo Hradišťa, verbuňk, na závěr Tancuj, tancuj. Noty jsou ve sdílené složce, případné změny pište sem.',
    8),

  // Kluci – Velikonoční obchůzka (ať to holky nevidí)
  post(8, kluci, demoMember([vybor, kluci]).id, 'Velikonoční obchůzka – trasa a sraz',
    'Sraz v pondělí v 7:30 u kulturního domu. Trasa jako loni: náves, horní konec, pak dolů k mlýnu. Pomlázky si každý plete sám, kdo neumí, ve čtvrtek se pletou ve zkušebně.',
    5, { requiresAction: true }),

  // Holky – dívčí zpěvy
  post(9, holky, demoMember([vybor, holky]).id, 'Dívčí zpěvy – texty k nácviku',
    'Do středy se prosím naučte první dvě sloky:\n\nVínečko bílé, vínečko bílé,\nfrajárko moja, kde máš to své?\n\nNácvik zpěvů ve středu v 18:00 v malém sále, kluci nemusí :)',
    7),

  // Malá Vonica – domluva vedoucích dětského souboru
  post(10, malaVonica, demoMember([malaVonica]).id, 'Rozpis vedení zkoušek na listopad',
    'Posílám návrh, kdo vede které úterní zkoušky v listopadu. Kdo nemůže, napište a vyměníme se.',
    4),

  // Sklad – krojařky, nákupy a údržba krojů
  post(11, sklad, demoMember([sklad]).id, 'Nákup na zimu – sukně a šátky',
    'Z rozpočtu na kroje zbývá na 4 nové spodnice a 6 šátků. Navrhuju objednat u stejné švadleny jako loni. Souhlasíte?',
    3, { requiresAction: true }),

  // Archiv (Taneční)
  post(12, tanecni, demoMember([vybor, tanecni]).id, 'Přihlášky na zájezd do Polska',
    'Přihlášky na zájezd jsou uzavřené, seznam účastníků rozešleme e-mailem. Díky všem!',
    30, { archivedDaysAgo: 20 }),
];
