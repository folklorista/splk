import { TestBed } from '@angular/core/testing';
import { MentionInputComponent, MentionSubmit } from './mention-input.component';
import { Member } from '../../core/models/member.model';

describe('MentionInputComponent', () => {
  const member = (id: number, nickname: string): Member => ({ id, ensembleId: 1, userId: id, firstName: nickname, lastName: '', nickname, groupIds: [], isActive: true, createdAt: '' });
  const petr = member(2, 'Petr Novák');
  const summer = { id: 4, title: 'Letní soustředění', startsAt: '2026-07-12T10:00:00' };

  function create(extra: Record<string, unknown> = {}) {
    const fixture = TestBed.createComponent(MentionInputComponent);
    fixture.componentRef.setInput('candidates', [petr, member(5, 'Eva')]);
    fixture.componentRef.setInput('events', [summer]);
    for (const [k, v] of Object.entries(extra)) fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
    return fixture;
  }

  function type(fixture: ReturnType<typeof create>, text: string): HTMLTextAreaElement {
    const area = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
    area.value = text;
    area.setSelectionRange(text.length, text.length);
    fixture.componentInstance.onInput(area);
    return area;
  }

  it('„@“ nabídne členy, „#“ akce; výběr a odeslání uloží tokeny', () => {
    const fixture = create();
    const c = fixture.componentInstance;
    let sent: MentionSubmit | undefined;
    c.submitted.subscribe((v) => (sent = v));

    let area = type(fixture, 'Ahoj @pe');
    expect(c.suggestions().map((s) => c.suggestionLabel(s))).toEqual(['@Petr Novák']);
    c.choose(c.suggestions()[0], area);
    area = type(fixture, area.value + 'viz #let');
    expect(c.suggestions().length).toBe(1);
    c.choose(c.suggestions()[0], area);
    c.submit(area);

    expect(sent).toEqual({ body: 'Ahoj @[member:2] viz #[event:4]', mentionedMemberIds: [2] });
    expect(c.text()).toBe('');
  });

  it('režim formuláře: bez tlačítka, průběžně posílá zakódovaný text; uložený text převede na čitelný', () => {
    const fixture = create({ showSubmit: false, initialBody: 'Díky @[member:2], viz #[event:4]' });
    const c = fixture.componentInstance;
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
    expect(c.text()).toContain('@Petr Novák');
    expect(c.text()).toContain('#Letní soustředění');
    let value: MentionSubmit | undefined;
    c.valueChange.subscribe((v) => (value = v));
    type(fixture, c.text() + '!');
    expect(value?.body).toBe('Díky @[member:2], viz #[event:4]!');
    expect(value?.mentionedMemberIds).toEqual([2]);
  });
});
