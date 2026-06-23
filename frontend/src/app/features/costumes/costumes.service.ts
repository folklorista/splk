import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { CostumeCategory, CostumeItem } from './models/costume.model';
import { MOCK_COSTUME_CATEGORIES, MOCK_COSTUME_ITEMS } from './data/mock-costumes';

@Injectable({ providedIn: 'root' })
export class CostumesService {
  getCategories(): Observable<CostumeCategory[]> {
    return of([...MOCK_COSTUME_CATEGORIES]).pipe(delay(300));
  }

  getItems(categoryId?: number): Observable<CostumeItem[]> {
    const items = categoryId
      ? MOCK_COSTUME_ITEMS.filter((i) => i.categoryId === categoryId)
      : [...MOCK_COSTUME_ITEMS];
    return of(items).pipe(delay(300));
  }

  getItem(id: number): Observable<CostumeItem | undefined> {
    return of(MOCK_COSTUME_ITEMS.find((i) => i.id === id)).pipe(delay(300));
  }
}
