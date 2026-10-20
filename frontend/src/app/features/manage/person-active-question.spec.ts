import { personActiveQuestion } from './manage-person.component';

describe('personActiveQuestion', () => {
  it('externistovi nenabízí ukončení členství, ale vyřazení z evidence', () => {
    const q = personActiveQuestion({ nickname: 'Externista', isExternal: true }, false);

    expect(q.title).toBe('Vyřadit externistu Externista z evidence?');
    expect(q.title).not.toContain('členství');
    expect(q.danger).toBeTrue();
  });

  it('externistu vrací do evidence', () => {
    expect(personActiveQuestion({ nickname: 'Externista', isExternal: true }, true).confirmLabel).toBe('Vrátit do evidence');
  });

  it('členovi ukončuje a obnovuje aktivní členství', () => {
    expect(personActiveQuestion({ nickname: 'Jana' }, false).title).toBe('Ukončit aktivní členství – Jana?');
    expect(personActiveQuestion({ nickname: 'Jana' }, true).title).toBe('Obnovit aktivní členství – Jana?');
  });
});
