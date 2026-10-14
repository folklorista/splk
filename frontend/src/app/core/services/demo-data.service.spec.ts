import { TestBed } from '@angular/core/testing';
import { DemoDataService } from './demo-data.service';
import { demoStorageKey, saveDemoData } from '../data/demo-storage';

describe('DemoDataService', () => {
  it('reset smaže uložená demo data a znovu načte aplikaci', () => {
    const service = TestBed.inject(DemoDataService);
    const reload = spyOn<any>(service, 'reload');
    saveDemoData('posts', [1]);

    service.reset();

    expect(localStorage.getItem(demoStorageKey('posts'))).toBeNull();
    expect(reload).toHaveBeenCalled();
  });
});
