import { TestBed } from '@angular/core/testing';
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY, SettingsService } from './settings.service';

describe('SettingsService', () => {
  beforeEach(() => localStorage.removeItem(SETTINGS_STORAGE_KEY));
  afterEach(() => {
    localStorage.removeItem(SETTINGS_STORAGE_KEY);
    ['theme', 'fontSize', 'reduceMotion'].forEach((k) => delete document.documentElement.dataset[k]);
  });

  const create = () => TestBed.inject(SettingsService);

  it('bez uložení použije výchozí nastavení', () => {
    expect(create().settings()).toEqual(DEFAULT_SETTINGS);
  });

  it('změnu uloží a nová instance ji načte', () => {
    create().update({ fontSize: 'largest', eventsView: 'calendar' });
    TestBed.resetTestingModule();
    expect(TestBed.inject(SettingsService).settings()).toEqual({ ...DEFAULT_SETTINGS, fontSize: 'largest', eventsView: 'calendar' });
  });

  it('nastavení promítne do atributů <html>', () => {
    const service = create();
    service.update({ theme: 'dark', fontSize: 'larger', reduceMotion: true });
    TestBed.flushEffects();
    const root = document.documentElement;
    expect(root.dataset['theme']).toBe('dark');
    expect(root.dataset['fontSize']).toBe('larger');
    expect(root.dataset['reduceMotion']).toBe('true');
  });

  it('automatický režim a animace se řídí systémem', () => {
    const service = create();
    service.update({ theme: 'auto', reduceMotion: null });
    service.systemReducedMotion.set(true);
    expect(service.resolvedReduceMotion()).toBeTrue();
    expect(['light', 'dark']).toContain(service.resolvedTheme());
    service.update({ reduceMotion: false });
    expect(service.resolvedReduceMotion()).toBeFalse();
  });

  it('poškozený záznam ignoruje', () => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, '{nesmysl');
    expect(create().settings()).toEqual(DEFAULT_SETTINGS);
  });
});
