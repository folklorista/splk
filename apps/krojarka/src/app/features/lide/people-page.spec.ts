import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ApiError } from '../../data/api-error';
import { PeopleStore } from './people.store';
import { PeoplePage } from './people-page';

describe('PeoplePage duplicate confirmation', () => {
  it('requires a separate confirmation and clears it when the name changes', async () => {
    const candidate = { id: 1, firstName: 'Jan', lastName: 'Novák', nickname: null, contact: null, contactVisible: true, affiliations: [] };
    const store = { fund: signal({ unitId: 1 }), canEditIdentity: signal(true), people: signal([]), units: signal([]), busy: signal(false), closeCard: vi.fn(),
      name: (p: typeof candidate) => `${p.firstName} ${p.lastName}`, create: vi.fn(async () => { throw new ApiError(422, 'possible_duplicate', { people: [candidate] }); }) };
    TestBed.configureTestingModule({ imports: [PeoplePage], providers: [provideRouter([]), { provide: PeopleStore, useValue: store }] });
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(PeoplePage); fixture.detectChanges(); await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const change = (field: string, value: string) => { const input = element.querySelector<HTMLInputElement>(`input[formControlName="${field}"]`)!; input.value = value; input.dispatchEvent(new Event('input')); fixture.detectChanges(); };
    change('firstName', 'Jan'); change('lastName', 'Novák');
    element.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })); await fixture.whenStable(); fixture.detectChanges();
    expect(store.create).toHaveBeenCalledTimes(1); expect(store.create).toHaveBeenCalledWith(expect.objectContaining({ confirmDuplicate: false }));
    const confirm = Array.from(element.querySelectorAll('button')).find((b) => b.textContent?.includes('Potvrdit založení jiné osoby'))!;
    expect(confirm).toBeDefined();
    confirm.click(); await fixture.whenStable(); fixture.detectChanges();
    expect(store.create).toHaveBeenCalledWith(expect.objectContaining({ confirmDuplicate: true }));
    change('lastName', 'Jiný');
    expect(element.textContent).not.toContain('Potvrdit založení jiné osoby');
  });
});
