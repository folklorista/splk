import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CostsPage } from './costs-page';
import { CostsStore } from './costs.store';
describe('CostsPage input', () => {
  const editor = signal({ unit: 1, cost: null }); const targets = signal([{ kind: 'item', targetId: 3, label: 'Shirt 03' }, { kind: 'bulk_stock', targetId: 4, label: 'Ribbons' }]); let save: ReturnType<typeof vi.fn>;
  beforeEach(async () => {
    save = vi.fn(async () => false); TestBed.configureTestingModule({ imports: [CostsPage] }); TestBed.overrideComponent(CostsPage, { set: { template: '', providers: [{ provide: CostsStore, useValue: { query: signal({}), editor, targets, save } }] } }); await TestBed.compileComponents();
  });
  const page = () => { const fixture = TestBed.createComponent(CostsPage); fixture.detectChanges(); return fixture.componentInstance; };
  it('sends exact Czech decimal input and retains the draft after rejection', async () => {
    const p = page(); p.spentOn = '2026-10-24'; p.amount = '-250,1234'; p.currency = 'eur'; p.description = 'Credit'; await p.save();
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ amount: '-250.1234', currency: 'EUR', description: 'Credit' })); expect(p.amount).toBe('-250,1234'); expect(p.description).toBe('Credit');
  });
  it('does not send exponent input or silently round excess decimal places', async () => {
    const p = page(); p.amount = '1e3'; await p.save(); expect(save).not.toHaveBeenCalled(); p.amount = '1.12345'; await p.save(); expect(save).not.toHaveBeenCalled(); expect(p.formError()).toContain('4 desetinnými');
  });
  it('keeps individual quantity one, allows historical bulk quantities and prevents duplicates', () => {
    const p = page(); p.target = 'item:3'; p.quantity = 5; p.addLink(); expect(p.links).toEqual([{ kind: 'item', targetId: 3, qty: 1 }]); p.target = 'item:3'; p.addLink(); expect(p.links).toHaveLength(1);
    p.target = 'bulk_stock:4'; p.quantity = 10; p.addLink(); expect(p.links[1].qty).toBe(10); p.links.splice(0, 1); expect(p.links).toHaveLength(1);
  });
});
