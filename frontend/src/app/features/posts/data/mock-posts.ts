import { Post } from '../models/post.model';

export const MOCK_POSTS: Post[] = [
  {
    id: 1,
    ensembleId: 1,
    title: 'Důležité informace k soustředění',
    body: 'Letní soustředění proběhne 12.–16. července v Luhačovicích. Přihlašte se prosím do konce května. Doprava bude zajištěna autobusem, odjezd v pátek v 15:00 od kulturního domu.',
    authorId: 10,
    targetGroupIds: [],
    publishedAt: '2026-06-10T09:00:00',
    isPinned: true,
  },
  {
    id: 2,
    ensembleId: 1,
    title: 'Změna termínu zkoušky – 25. června',
    body: 'Zkouška v úterý 25. 6. se přesouvá na 19:30 místo obvyklých 19:00. Prosím všechny, ať si upraví plán.',
    authorId: 10,
    targetGroupIds: [],
    publishedAt: '2026-06-15T14:30:00',
    isPinned: false,
  },
  {
    id: 3,
    ensembleId: 1,
    title: 'Nové fotky z festivalu Strážnice',
    body: 'Do sdíleného alba byly nahrány fotografie z vystoupení na festivalu Strážnice. Odkaz najdete v sekci Dokumenty.',
    authorId: 11,
    targetGroupIds: [],
    publishedAt: '2026-06-18T11:00:00',
    isPinned: false,
  },
  {
    id: 4,
    ensembleId: 1,
    title: 'Krojová přehlídka – potřebujeme dobrovolníky',
    body: 'Hledáme 3–4 dobrovolníky na pomoc s organizací krojové přehlídky dne 5. července. Pokud máte zájem, napište vedoucímu.',
    authorId: 10,
    targetGroupIds: [1],
    publishedAt: '2026-06-20T08:00:00',
    isPinned: false,
  },
];
