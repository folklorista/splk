import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { RichTextComponent } from './rich-text.component';
import { MembersService } from '../../features/members/members.service';
import { EventsService } from '../../features/events/events.service';

describe('RichTextComponent', () => {
  function render(body: string) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: MembersService, useValue: { members: signal([{ id: 2, nickname: 'Staňa' }]) } },
        { provide: EventsService, useValue: { linkableEvents: signal([{ id: 4, title: 'Letní soustředění', startsAt: '2026-07-12T10:00:00' }]) } },
      ],
    });
    const fixture = TestBed.createComponent(RichTextComponent);
    fixture.componentRef.setInput('body', body);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('zmínka jménem, viditelná akce jako odkaz na detail, nedostupná akce bez názvu', () => {
    const el = render('@[member:2] založí akci jako #[event:4], ne #[event:99]');
    expect(el.querySelector('.mention')?.textContent).toBe('@Staňa');
    const link = el.querySelector('a.event-link') as HTMLAnchorElement;
    expect(link.textContent).toContain('Letní soustředění');
    expect(link.getAttribute('href')).toBe('/app/events/4');
    expect(el.querySelector('.event-link--hidden')?.textContent).toBe('akce');
    expect(el.textContent).not.toContain('99');
  });

  it('text bez tokenů vykreslí jako text (žádné HTML)', () => {
    const el = render('<b>tučně</b>');
    expect(el.querySelector('b')).toBeNull();
    expect(el.textContent).toContain('<b>tučně</b>');
  });
});
