import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { CostumeItem } from '@splk/api-contracts';
import { ApiError } from '../../data/api-error';
import { InventoryStore } from './inventory.store';
import { ItemPage } from './item-page';
import { InventoryOperationStore } from '../inventury/inventory-operation.store';

const piece: CostumeItem = { available: true, holder: null, loanId: null, loanKitId: null, id: 1, unitId: 1, seriesId: 1, number: '17', variant: null, size: null, description: null, note: 'Stored note',
  condition: 'ok', issuable: true, location: 'unknown', locationNote: null, acquiredOn: null, kitId: null, retiredAt: null, retiredBy: null, retireReason: null, version: 1 };

describe('ItemPage form behavior', () => {
  const setup = async (canManage = true) => {
    const store = { fund: signal({ unitId: 1, name: 'Vonica', canManage }), canManage: signal(canManage), item: signal<CostumeItem | null>({ ...piece }),
      kit: signal(null), series: signal([{ id: 1, name: 'Košile', kind: 'part', archived: false }]), orders: signal([]), history: signal([]),
      detailLoading: signal(false), busy: signal(false), openItem: vi.fn(async () => undefined), closeDetail: vi.fn(),
      updateItem: vi.fn(async () => { throw new ApiError(409, 'version_conflict'); }), retireItem: vi.fn(async () => piece),
      itemName: () => 'Košile · 17', seriesName: () => 'Košile' };
    TestBed.configureTestingModule({ imports: [ItemPage], providers: [provideRouter([]), { provide: InventoryStore, useValue: store },
      { provide: InventoryOperationStore, useValue: { requested: signal(false) } },
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: '1' })), snapshot: { queryParamMap: convertToParamMap({}) } } }] });
    const fixture = TestBed.createComponent(ItemPage); fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
    return { fixture, store, element: fixture.nativeElement as HTMLElement };
  };

  it('preserves draft text after a conflict and offers explicit reload', async () => {
    const { fixture, store, element } = await setup();
    const note = element.querySelector<HTMLTextAreaElement>('textarea[formControlName="note"]')!;
    note.value = 'Unsaved draft'; note.dispatchEvent(new Event('input'));
    element.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable(); fixture.detectChanges();
    expect(store.updateItem).toHaveBeenCalledWith(1, expect.objectContaining({ version: 1, note: 'Unsaved draft' }));
    expect(note.value).toBe('Unsaved draft');
    expect(element.textContent).toContain('mezitím změnila');
    expect(element.textContent).toContain('Obnovit údaje a zahodit rozepsané změny');
  });

  it('keeps the original form version when another action refreshes the detail while editing', async () => {
    const { fixture, store, element } = await setup();
    const note = element.querySelector<HTMLTextAreaElement>('textarea[formControlName="note"]')!;
    note.value = 'Unsaved draft'; note.dispatchEvent(new Event('input'));
    store.item.set({ ...piece, version: 2, note: 'Changed by another person' });
    fixture.detectChanges(); await fixture.whenStable();
    expect(note.value).toBe('Unsaved draft');
    element.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    expect(store.updateItem).toHaveBeenCalledWith(1, expect.objectContaining({ version: 1, note: 'Unsaved draft' }));
  });

  it('renders read-only evidence without save and retirement actions', async () => {
    const { element, store } = await setup(false);
    expect(element.querySelector('fieldset')!.disabled).toBe(true);
    expect(element.textContent).not.toContain('Uložit součástku');
    expect(element.textContent).not.toContain('Vyřadit…');
    expect(store.updateItem).not.toHaveBeenCalled();
  });

  it('requires a retirement reason and a separate confirmation', async () => {
    const { fixture, element, store } = await setup();
    const trigger = Array.from(element.querySelectorAll('button')).find((b) => b.textContent?.includes('Vyřadit…'))!;
    trigger.click(); fixture.detectChanges();
    const confirm = Array.from(element.querySelectorAll('button')).find((b) => b.textContent?.includes('Potvrdit vyřazení'))!;
    expect(confirm.disabled).toBe(true); expect(store.retireItem).not.toHaveBeenCalled();
    const reason = element.querySelector<HTMLTextAreaElement>('.notice-warn textarea')!;
    reason.value = 'Worn out'; reason.dispatchEvent(new Event('input')); fixture.detectChanges();
    expect(confirm.disabled).toBe(false); confirm.click(); await fixture.whenStable();
    expect(store.retireItem).toHaveBeenCalledWith(1, 1, 'Worn out');
  });
});
