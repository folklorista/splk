import { parseEventQuery } from './mentions';
import { activeMentionQuery, decodeMentions, encodeMentions, eventMentionLabel, filterEventCandidates, filterMentionCandidates, insertEventMention, insertMention, parseCommentBody, plainText } from './mentions';
import { Member } from '../../../core/models/member.model';

const member = (id: number, nickname: string): Member => ({
  id, ensembleId: 1, userId: id, firstName: nickname, lastName: '', nickname, groupIds: [], isActive: true, createdAt: '',
});

describe('mentions', () => {
  const kuba = member(1, 'Kuba');
  const kubaD = member(2, 'Kuba D');
  const anycka = member(3, 'Aňyčka');

  describe('activeMentionQuery', () => {
    it('najde rozepsanou zmínku před kurzorem', () => {
      expect(activeMentionQuery('Ahoj @Ku', 8)).toEqual({ start: 5, query: 'Ku', trigger: '@' });
      expect(activeMentionQuery('@', 1)).toEqual({ start: 0, query: '', trigger: '@' });
    });

    it('ignoruje e-mail, zalomení řádku a text bez „@“', () => {
      expect(activeMentionQuery('jana@soubor', 11)).toBeNull();
      expect(activeMentionQuery('@Ku\nba', 6)).toBeNull();
      expect(activeMentionQuery('Ahoj', 4)).toBeNull();
    });
  });

  it('filtruje bez diakritiky, nejdřív shoda na začátku', () => {
    expect(filterMentionCandidates([kubaD, anycka, kuba], 'any').map((m) => m.id)).toEqual([3]);
    expect(filterMentionCandidates([anycka, kubaD], 'd').map((m) => m.id)).toEqual([2]);
    expect(filterMentionCandidates([member(4, 'Eda'), kuba], 'k').map((m) => m.id)).toEqual([1]);
  });

  it('vloží přezdívku místo rozepsaného textu a posune kurzor', () => {
    const text = 'Ahoj @Ku, jak se máš';
    const result = insertMention(text, { start: 5, query: 'Ku', trigger: '@' }, 8, kubaD);
    expect(result.text).toBe('Ahoj @Kuba D , jak se máš');
    expect(result.caret).toBe(13);
  });

  it('při odeslání převede vybraná jména na tokeny, delší přezdívky první', () => {
    const { body, mentionedMemberIds } = encodeMentions('@Kuba D a @Kuba pojďte', [kuba, kubaD]);
    expect(body).toBe('@[member:2] a @[member:1] pojďte');
    expect(mentionedMemberIds).toEqual([2, 1]);
  });

  it('přepsané jméno se jako zmínka neuloží', () => {
    expect(encodeMentions('@Kubo pojď', [kuba])).toEqual({ body: '@Kubo pojď', mentionedMemberIds: [] });
  });

  it('rozdělí uložený text na text a zmínky', () => {
    expect(parseCommentBody('Ahoj @[member:3], díky')).toEqual([
      { type: 'text', text: 'Ahoj ' },
      { type: 'mention', memberId: 3 },
      { type: 'text', text: ', díky' },
    ]);
    expect(parseCommentBody('<b>bez zmínky</b>')).toEqual([{ type: 'text', text: '<b>bez zmínky</b>' }]);
  });

  describe('odkazy na akce (#)', () => {
    const summer = { id: 4, title: 'Letní soustředění', startsAt: '2026-07-12T10:00:00' };
    const autumn = { id: 9, title: 'Podzimní soustředění', startsAt: '2026-11-06T10:00:00' };
    const now = new Date('2026-10-19T12:00:00');

    it('„#“ spustí nabídku akcí; text může obsahovat mezery', () => {
      expect(activeMentionQuery('viz #Letní sou', 14)).toEqual({ start: 4, query: 'Letní sou', trigger: '#' });
      expect(activeMentionQuery('C#', 2)).toBeNull();
    });

    it('nabídka: podle názvu i data, nejdřív nadcházející', () => {
      expect(filterEventCandidates([summer, autumn], 'soustr', 6, now).map((e) => e.id)).toEqual([9, 4]);
      expect(filterEventCandidates([summer, autumn], '12. 7', 6, now).map((e) => e.id)).toEqual([4]);
    });

    it('datum lze psát volně, měsíc slovem i s rokem – i u vzdáleného nácviku', () => {
      const weekly = Array.from({ length: 20 }, (_, i) => ({ id: 100 + i, title: 'Nácvik – tanečníci', startsAt: new Date(2026, 9, 22 + i * 7, 18).toISOString() }));
      const far = weekly[13];
      const d = new Date(far.startsAt);
      const day = d.getDate();
      const month = d.getMonth() + 1;
      for (const q of [`nácvik ${day}.${month}.`, `nácvik ${day}. ${month}.`, `${day}/${month}`, `nacvik ${day}.${month}.${d.getFullYear()}`]) {
        expect(filterEventCandidates(weekly, q, 10, now).map((e) => e.id)).withContext(q).toEqual([far.id]);
      }
      const january = filterEventCandidates(weekly, 'nácvik leden', 10, now);
      expect(january.length).toBeGreaterThan(0);
      expect(january.every((e) => new Date(e.startsAt).getMonth() === 0)).toBeTrue();
      expect(filterEventCandidates(weekly, 'nácvik ledna 2027', 10, now).length).toBe(january.length);
    });

    it('rozklad dotazu: text, den, měsíc, rok; červenec ≠ červen', () => {
      expect(parseEventQuery('Nácvik 15.1.2027')).toEqual({ text: 'nacvik', day: 15, month: 1, year: 2027 });
      expect(parseEventQuery('hody červenec')).toEqual({ text: 'hody', month: 7 });
      expect(parseEventQuery('hody červen')).toEqual({ text: 'hody', month: 6 });
      expect(parseEventQuery('2027')).toEqual({ text: '', year: 2027 });
    });

    it('akce mimo letošní rok má v textu i rok', () => {
      expect(eventMentionLabel({ id: 1, title: 'Hody', startsAt: '2027-01-15T10:00:00' }, now)).toBe('Hody · 15. 1. 2027');
      expect(eventMentionLabel(summer, now)).toBe('Letní soustředění · 12. 7.');
    });

    it('vložení, zakódování na token a převod zpět pro úpravu', () => {
      const typed = 'jako u #Let';
      const inserted = insertEventMention(typed, { start: 7, query: 'Let', trigger: '#' }, typed.length, summer);
      expect(inserted.text).toBe(`jako u #${eventMentionLabel(summer)} `);
      const { body } = encodeMentions(`@Kuba založí akci, jako u #${eventMentionLabel(summer)}`, [kuba], [summer]);
      expect(body).toBe('@[member:1] založí akci, jako u #[event:4]');
      const decoded = decodeMentions(body, [kuba], [summer]);
      expect(decoded.text).toBe(`@Kuba založí akci, jako u #${eventMentionLabel(summer)}`);
      expect(decoded.events).toEqual([summer]);
    });

    it('vykreslení a čistý text: akce jako samostatný segment', () => {
      expect(parseCommentBody('viz #[event:4]!')).toEqual([{ type: 'text', text: 'viz ' }, { type: 'event', eventId: 4 }, { type: 'text', text: '!' }]);
      expect(plainText('@[member:1] a #[event:4]', () => 'Kuba', () => 'Letní soustředění')).toBe('@Kuba a #Letní soustředění');
      expect(plainText('#[event:99]', () => '', () => undefined)).toBe('#akce');
    });
  });
});
