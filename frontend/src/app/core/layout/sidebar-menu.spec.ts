import { Place } from './bottom-bar';
import { moveInSidebar, resolveSidebar, sectionPlaces, toggleHiddenInSidebar } from './sidebar-menu';

describe('sidebar-menu', () => {
  const place = (key: string, category: Place['category']): Place => ({ key, path: `/${key}`, label: key, icon: 'home', category });
  const places = [
    place('events', 'main'),
    place('group-1', 'group'),
    place('group-2', 'group'),
    place('groups', 'hub'),
    place('attendance', 'agenda'),
    place('costumes', 'costumes'),
    place('manage', 'agenda'),
    place('search', 'tool'),
  ];
  const keys = (items: Place[]) => items.map((p) => p.key);
  const section = (config: Parameters<typeof resolveSidebar>[1], key: string) => resolveSidebar(places, config).find((s) => s.key === key)!;

  it('výchozí rozdělení do sekcí: hlavní, Moje skupiny, Agendy (s Moje kroje), Soubor', () => {
    const sections = resolveSidebar(places, null);
    expect(sections.map((s) => [s.key, s.label, keys(s.items)])).toEqual([
      ['main', undefined, ['events']],
      ['groups', 'Moje skupiny', ['group-1', 'group-2']],
      ['agendas', 'Agendy', ['attendance', 'costumes', 'manage']],
      ['ensemble', 'Soubor', ['groups', 'search']],
    ]);
  });

  it('vlastní pořadí a skrytí platí jen ve skupinách a agendách', () => {
    const config = { order: ['search', 'group-2', 'manage', 'events'], hidden: ['attendance', 'search', 'events'] };
    expect(keys(section(config, 'groups').items)).toEqual(['group-2', 'group-1']);
    expect(keys(section(config, 'agendas').items)).toEqual(['manage', 'costumes']);
    expect(keys(section(config, 'agendas').hidden)).toEqual(['attendance']);
    expect(keys(section(config, 'main').items)).toEqual(['events']);
    expect(keys(section(config, 'ensemble').items)).toEqual(['groups', 'search']);
  });

  it('nedostupná místa v uložené konfiguraci nevadí a nezobrazí se', () => {
    const config = { order: ['group-9', 'group-2'], hidden: ['group-9', 'wardrobe'] };
    expect(keys(section(config, 'groups').items)).toEqual(['group-2', 'group-1']);
    expect(section(config, 'groups').hidden).toEqual([]);
  });

  it('posun jen uvnitř sekce; nedostupné uložené klíče zůstanou', () => {
    const moved = moveInSidebar(places, { order: ['group-9'], hidden: [] }, 'group-2', -1);
    expect(keys(sectionPlaces(places, moved, 'groups'))).toEqual(['group-2', 'group-1']);
    expect(keys(sectionPlaces(places, moved, 'agendas'))).toEqual(['attendance', 'costumes', 'manage']);
    expect(moved.order).toContain('group-9');
    // první položku sekce nejde posunout výš (ani do jiné sekce)
    const agendas = moveInSidebar(places, moved, 'attendance', -1);
    expect(keys(sectionPlaces(places, agendas, 'agendas'))).toEqual(['attendance', 'costumes', 'manage']);
    expect(keys(sectionPlaces(places, agendas, 'groups'))).toEqual(['group-2', 'group-1']);
  });

  it('skrýt a znovu zobrazit; pevné položky skrýt nelze', () => {
    const hidden = toggleHiddenInSidebar(places, null, 'manage');
    expect(hidden.hidden).toEqual(['manage']);
    expect(toggleHiddenInSidebar(places, hidden, 'manage').hidden).toEqual([]);
    expect(toggleHiddenInSidebar(places, null, 'events').hidden).toEqual([]);
    expect(toggleHiddenInSidebar(places, null, 'groups').hidden).toEqual([]);
  });
});
