import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { CostumeItem, KitDetail } from '@splk/api-contracts';
import { InventoryStore } from './inventory.store';
import { KitPage } from './kit-page';

const kit: KitDetail = { id: 7, unitId: 1, seriesId: 2, number: 'K1', description: null, note: null, compositionState: 'unverified',
  version: 1, retiredAt: null, items: [], bulkLines: [], changes: [] };
const piece: CostumeItem = { available: true, holder: null, id: 3, unitId: 1, seriesId: 1, number: '17', variant: null, size: null, description: null, note: null,
  condition: 'ok', issuable: true, location: 'unknown', locationNote: null, acquiredOn: null, kitId: null, retiredAt: null, retiredBy: null, retireReason: null, version: 4 };

describe('KitPage composition confirmation', () => {
  const setup = async (manage = true) => {
    const store = { fund: signal({ unitId: 1, name: 'Vonica', canManage: manage }), canManage: signal(manage), kit: signal<KitDetail | null>(structuredClone(kit)),
      series: signal([{ id: 2, name: 'Komplety', kind: 'kit', archived: false }]), kits: signal([kit]), stocks: signal([]), items: signal([piece]), busy: signal(false), detailLoading: signal(false),
      openKit: vi.fn(async () => undefined), composition: vi.fn(async () => kit), updateKit: vi.fn(async () => kit), kitName: () => 'Komplet K1', itemName: () => 'Košile 17', seriesName: () => 'Komplety' };
    TestBed.configureTestingModule({ imports: [KitPage], providers: [provideRouter([]), { provide: InventoryStore, useValue: store },
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: '7' })) } }] });
    const fixture = TestBed.createComponent(KitPage); fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
    return { fixture, store, element: fixture.nativeElement as HTMLElement };
  };

  it('submits composition only after showing and confirming the concrete operation', async () => {
    const { fixture, element, store } = await setup();
    const select = element.querySelector<HTMLSelectElement>('select[formControlName="itemId"]')!;
    select.selectedIndex = 1; select.dispatchEvent(new Event('change')); fixture.detectChanges();
    select.closest('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); fixture.detectChanges();
    expect(store.composition).not.toHaveBeenCalled();
    expect(element.textContent).toContain('Přidat do určeného složení: Košile 17');
    const confirm = Array.from(element.querySelectorAll('button')).find((button) => button.textContent === 'Potvrdit změnu')!;
    confirm.click(); await fixture.whenStable();
    expect(store.composition).toHaveBeenCalledWith(7, expect.objectContaining({ action: 'add', version: 1, itemId: 3, itemVersion: 4 }));
  });

  it('keeps intended composition distinct from physical verification in read-only mode', async () => {
    const { element } = await setup(false);
    expect(element.textContent).toContain('složení neověřeno');
    expect(element.textContent).toContain('Aktuální fyzická přítomnost zde není potvrzena');
    expect(element.querySelector('fieldset')!.disabled).toBe(true);
    expect(element.textContent).not.toContain('Připravit přidání součástky');
  });
});
