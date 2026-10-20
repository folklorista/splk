import { TestBed } from '@angular/core/testing';
import { ConfirmService } from './confirm.service';
import { ConfirmDialogComponent } from './confirm-dialog.component';

describe('ConfirmService', () => {
  let service: ConfirmService;

  beforeEach(() => {
    service = TestBed.inject(ConfirmService);
  });

  it('vrátí true po potvrzení a dotaz zavře', async () => {
    const answer = service.confirm({ title: 'Smazat?' });
    expect(service.request()?.title).toBe('Smazat?');

    service.close(true);

    expect(await answer).toBeTrue();
    expect(service.request()).toBeNull();
  });

  it('vrátí false po zrušení', async () => {
    const answer = service.confirm({ title: 'Smazat?' });
    service.close(false);
    expect(await answer).toBeFalse();
  });

  it('nový dotaz zruší rozpracovaný předchozí', async () => {
    const first = service.confirm({ title: 'První' });
    service.confirm({ title: 'Druhý' });

    expect(await first).toBeFalse();
    expect(service.request()?.title).toBe('Druhý');
  });
});

describe('ConfirmDialogComponent', () => {
  it('zobrazí dotaz v modálním dialogu a tlačítkem potvrdí', async () => {
    const fixture = TestBed.createComponent(ConfirmDialogComponent);
    const service = TestBed.inject(ConfirmService);
    fixture.detectChanges();

    const answer = service.confirm({ title: 'Smazat akci?', message: 'Nelze vrátit.', confirmLabel: 'Smazat', danger: true });
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const dialog = el.querySelector('dialog') as HTMLDialogElement;

    expect(dialog.open).toBeTrue();
    expect(el.querySelector('.dialog__title')!.textContent).toContain('Smazat akci?');
    const confirmBtn = el.querySelector('.dialog__danger') as HTMLButtonElement;
    expect(confirmBtn.textContent).toContain('Smazat');

    confirmBtn.click();
    fixture.detectChanges();

    expect(await answer).toBeTrue();
    expect(dialog.open).toBeFalse();
  });
});
