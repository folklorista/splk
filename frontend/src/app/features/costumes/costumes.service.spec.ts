import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { CostumesService } from './costumes.service';
import { CostumeCategory, CostumeItem } from './models/costume.model';
import { MOCK_COSTUME_CATEGORIES, MOCK_COSTUME_ITEMS } from './data/mock-costumes';

describe('CostumesService', () => {
  let service: CostumesService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CostumesService);
  });

  it('getCategories vrátí všechny kategorie', fakeAsync(() => {
    let result: CostumeCategory[] = [];
    service.getCategories().subscribe((cats) => (result = cats));
    tick(300);
    expect(result.length).toBe(MOCK_COSTUME_CATEGORIES.length);
  }));

  it('getCategories vrátí kopii pole, ne referenci na mock data', fakeAsync(() => {
    let result: CostumeCategory[] = [];
    service.getCategories().subscribe((cats) => (result = cats));
    tick(300);
    expect(result).not.toBe(MOCK_COSTUME_CATEGORIES);
  }));

  it('getItems bez filtru vrátí všechny díly', fakeAsync(() => {
    let result: CostumeItem[] = [];
    service.getItems().subscribe((items) => (result = items));
    tick(300);
    expect(result.length).toBe(MOCK_COSTUME_ITEMS.length);
  }));

  it('getItems s categoryId vrátí pouze díly dané kategorie', fakeAsync(() => {
    let result: CostumeItem[] = [];
    service.getItems(1).subscribe((items) => (result = items));
    tick(300);
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((i) => i.categoryId === 1)).toBeTrue();
  }));

  it('getItems s neexistujícím categoryId vrátí prázdné pole', fakeAsync(() => {
    let result: CostumeItem[] = [];
    service.getItems(9999).subscribe((items) => (result = items));
    tick(300);
    expect(result.length).toBe(0);
  }));

  it('getItem vrátí díl se správným id', fakeAsync(() => {
    let result: CostumeItem | undefined;
    service.getItem(1).subscribe((item) => (result = item));
    tick(300);
    expect(result?.id).toBe(1);
  }));

  it('getItem vrátí undefined pro neexistující id', fakeAsync(() => {
    let result: CostumeItem | undefined = { id: 0 } as CostumeItem;
    service.getItem(9999).subscribe((item) => (result = item));
    tick(300);
    expect(result).toBeUndefined();
  }));
});
