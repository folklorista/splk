import { DEMO_DATA_VERSION, clearDemoData, demoStorageKey, loadDemoData, saveDemoData } from './demo-storage';

describe('demo-storage', () => {
  it('bez uložených dat vrátí výchozí (seed) data', () => {
    expect(loadDemoData('items', () => [1, 2])).toEqual([1, 2]);
  });

  it('vrátí dříve uložená data', () => {
    saveDemoData('items', [3]);
    expect(loadDemoData('items', () => [1, 2])).toEqual([3]);
  });

  it('data uložená jinou verzí zahodí', () => {
    saveDemoData('items', [3]);
    localStorage.setItem(demoStorageKey('version'), String(DEMO_DATA_VERSION - 1));
    expect(loadDemoData('items', () => [1, 2])).toEqual([1, 2]);
    expect(localStorage.getItem(demoStorageKey('items'))).toBeNull();
  });

  it('poškozená data nahradí výchozími', () => {
    saveDemoData('items', [3]);
    localStorage.setItem(demoStorageKey('items'), '{nesmysl');
    expect(loadDemoData('items', () => [1, 2])).toEqual([1, 2]);
  });

  it('clearDemoData smaže demo data, ale nic jiného', () => {
    saveDemoData('items', [3]);
    localStorage.setItem('splk.auth.user', '{}');
    clearDemoData();
    expect(localStorage.getItem(demoStorageKey('items'))).toBeNull();
    expect(localStorage.getItem('splk.auth.user')).toBe('{}');
    localStorage.removeItem('splk.auth.user');
  });
});
