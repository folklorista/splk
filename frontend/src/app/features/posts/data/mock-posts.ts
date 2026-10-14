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

// Autoři podle role: oznámení na nástěnce píše výbor (pokud je někdo z výboru jejím členem),
// kroje Sklad, dětský soubor Malá Vonica
export const MOCK_POSTS: Post[] = [
  post(1, tanecni, demoMember([vybor, tanecni]).id, 'Důležité informace k soustředění',
    'Podzimní soustředění proběhne za tři týdny v Luhačovicích. Přihlaste se prosím do konce měsíce. Doprava bude zajištěna autobusem, odjezd v pátek v 15:00 od kulturního domu.',
    6, { isPinned: true, requiresAction: true }),
  post(2, tanecni, demoMember([vybor, tanecni], 1).id, 'Změna času páteční zkoušky',
    'Páteční nácvik tento týden začne výjimečně až v 19:30, sál je do té doby obsazený. Děkujeme za pochopení.',
    4),
  post(3, tanecni, demoMember([tanecni], 3).id, 'Fotky z vystoupení na hodech',
    'Ve sdíleném albu jsou fotky z neděle. Kdo má další, přidejte je prosím do stejné složky.',
    9),
  post(4, tanecni, demoMember([sklad, tanecni]).id, 'Krojová přehlídka – potřebujeme pomocníky',
    'Na krojovou přehlídku hledáme 3–4 pomocníky s chystáním a úklidem krojů. Kdo může, napište sem do komentáře.',
    2, { requiresAction: true }),
  post(5, vybor, demoMember([vybor]).id, 'Program schůzky výboru',
    'Schůzka výboru bude ve čtvrtek v 17:00 v zasedačce. Body: plán vystoupení na zimu, rozpočet na nové kroje, ples.',
    3),
  post(6, malaVonica, demoMember([malaVonica]).id, 'Nábor do dětského souboru',
    'Malá Vonica přibírá nové děti od 5 let. Zkoušky jsou každé úterý v 16:30 v malém sále. Pošlete prosím info dál známým.',
    5, { isPinned: true }),
  post(7, kluci, demoMember([vybor, kluci]).id, 'Verbuňk – nácvik navíc',
    'Kluci, před soutěží verbířů přidáváme nácvik ve středu v 19:00. Účast nutná pro všechny, kdo jedou.',
    1, { requiresAction: true }),
  post(8, holky, demoMember([vybor, holky]).id, 'Šátky a pentle na vystoupení',
    'Na vystoupení budeme mít jednotné šátky. Kdo nemá vlastní, vyzvedne si ve skladu.',
    7),
  post(9, muzika, demoMember([muzika]).id, 'Nové noty na podzimní program',
    'Noty k novým písničkám jsou ve sdílené složce. Prosím projděte si je do příští zkoušky.',
    8),
  post(10, sklad, demoMember([sklad]).id, 'Inventura krojů',
    'V sobotu dopoledne děláme inventuru. Kdo má doma kroj ze skladu, vraťte ho prosím do pátku.',
    10),
  post(11, tanecni, demoMember([vybor, tanecni]).id, 'Přihlášky na zájezd do Polska',
    'Přihlášky na zájezd jsou uzavřené, seznam účastníků rozešleme e-mailem. Díky všem!',
    30, { archivedDaysAgo: 20 }),
];
