import { activeMentionQuery, encodeMentions, filterMentionCandidates, insertMention, parseCommentBody } from './mentions';
import { Member } from '../../../core/models/member.model';

const member = (id: number, nickname: string): Member => ({
  id, ensembleId: 1, userId: id, firstName: nickname, lastName: '', nickname, groupIds: [], isAdmin: false, isActive: true, createdAt: '',
});

describe('mentions', () => {
  const kuba = member(1, 'Kuba');
  const kubaD = member(2, 'Kuba D');
  const anycka = member(3, 'Aňyčka');

  describe('activeMentionQuery', () => {
    it('najde rozepsanou zmínku před kurzorem', () => {
      expect(activeMentionQuery('Ahoj @Ku', 8)).toEqual({ start: 5, query: 'Ku' });
      expect(activeMentionQuery('@', 1)).toEqual({ start: 0, query: '' });
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
    const result = insertMention(text, { start: 5, query: 'Ku' }, 8, kubaD);
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
});
