import { Place, defaultBarKeys, moveKey, orderPlaces, resolveBar, sumBadges } from './bottom-bar';

describe('bottom-bar', () => {
  const place = (key: string, category: Place['category'], extra: Partial<Place> = {}): Place => ({ key, path: `/${key}`, label: key, icon: 'home', category, ...extra });
  const events = place('events', 'main');
  const hub = place('groups', 'hub');
  const search = place('search', 'tool');
  const group = (id: number, badge?: number) => place(`group-${id}`, 'group', { badge });
  const costumes = (suggest = true) => place('costumes', 'costumes', { suggest });

  it('běžný člen (2 skupiny, kroj): všechna místa přímo v liště, bez mezivrstvy Skupiny', () => {
    const places = [events, group(1), group(2), hub, costumes(), search];
    expect(defaultBarKeys(places)).toEqual(['events', 'group-1', 'group-2', 'costumes']);
    expect(resolveBar(places, null).overflow).toEqual([]);
  });

  it('běžný člen se 3 skupinami a krojem: skupiny přímo, Moje kroje zůstanou na Přehledu', () => {
    const places = [events, group(1), group(2), group(3), hub, costumes(), search];
    expect(defaultBarKeys(places)).toEqual(['events', 'group-1', 'group-2', 'group-3']);
  });

  it('Moje kroje bez výpůjčky se nenavrhují; Hledat ani rozcestník se nenavrhují, vejdou-li se skupiny', () => {
    expect(defaultBarKeys([events, group(1), hub, costumes(false), search])).toEqual(['events', 'group-1']);
  });

  it('krojařka (3 skupiny, Správa krojů): skupiny se sloučí do „Skupiny“', () => {
    const wardrobe = place('wardrobe', 'agenda', { writes: true });
    const places = [events, group(1), group(2), group(3), hub, costumes(), wardrobe, search];
    expect(defaultBarKeys(places)).toEqual(['events', 'groups', 'wardrobe', 'costumes']);
  });

  it('vedení: sloučené skupiny a přetečení pod „Více“', () => {
    const attendance = place('attendance', 'agenda', { writes: true });
    const wardrobeView = place('wardrobe', 'agenda');
    const manage = place('manage', 'agenda');
    const places = [events, ...[1, 2, 3, 4, 5, 6].map((id) => group(id)), hub, costumes(), attendance, wardrobeView, manage];
    const { bar, overflow } = resolveBar(places, null);
    expect(bar.map((p) => p.key)).toEqual(['events', 'groups', 'attendance']);
    expect(overflow.map((p) => p.key)).toEqual(['costumes', 'wardrobe', 'manage']);
  });

  it('vlastní výběr: nedostupná místa se vynechají, duplicity a Přehled se ignorují', () => {
    const places = [events, group(1), search];
    expect(resolveBar(places, ['dashboard', 'group-9', 'search', 'search', 'events']).bar.map((p) => p.key)).toEqual(['search', 'events']);
    expect(resolveBar(places, []).bar).toEqual([]);
  });

  it('pořadí míst pro sidebar: nejdřív podle lišty, pak ostatní', () => {
    const places = [events, group(1), hub, search];
    expect(orderPlaces(places, ['search', 'group-1']).map((p) => p.key)).toEqual(['search', 'group-1', 'events', 'groups']);
  });

  it('posun a součet badge', () => {
    expect(moveKey(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c']);
    expect(moveKey(['a', 'b'], 'a', -1)).toEqual(['a', 'b']);
    expect(sumBadges([group(1, 2), group(2), group(3, 5)])).toBe(7);
  });
});
