import { Group } from '../../../core/models/group.model';
import { chatHistoryModeAt, chatVisibility, wasMemberAt, withChatHistoryChange } from './chat-history';

describe('chat-history', () => {
  const group: Group = { id: 1, ensembleId: 1, name: 'Holky', slug: 'holky' };
  const at = (day: number) => `2026-10-${String(day).padStart(2, '0')}T12:00:00.000Z`;

  it('bez nastavení je historie otevřená – nový člen vidí i starší zprávy', () => {
    const visible = chatVisibility(group, { groupIds: [1], groupIntervals: { 1: [{ from: at(10) }] } });
    expect(visible(at(1))).toBeTrue();
  });

  it('režim „od vstupu“: jen zprávy z doby členství; mezera mezi členstvími zůstane skrytá', () => {
    const strict = { ...group, chatHistory: 'from-join' as const };
    const viewer = { groupIds: [1], groupIntervals: { 1: [{ from: at(2), to: at(5) }, { from: at(10) }] } };
    const visible = chatVisibility(strict, viewer);
    expect(visible(at(1))).toBeFalse();
    expect(visible(at(3))).toBeTrue();
    expect(visible(at(7))).toBeFalse();
    expect(visible(at(12))).toBeTrue();
  });

  it('člen bez záznamu intervalů je členem od počátku; nečlen otevřené skupiny období „od vstupu“ nevidí', () => {
    const strict = { ...group, chatHistory: 'from-join' as const };
    expect(chatVisibility(strict, { groupIds: [1] })(at(1))).toBeTrue();
    expect(chatVisibility(strict, { groupIds: [] })(at(1))).toBeFalse();
  });

  it('přepnutí na otevřenou historii zpětně neodkryje období „od vstupu“', () => {
    const strict: Group = { ...group, chatHistory: 'from-join' };
    const switched = { ...strict, ...withChatHistoryChange(strict, 'open', at(15)) };
    expect(chatHistoryModeAt(switched, at(10))).toBe('from-join');
    expect(chatHistoryModeAt(switched, at(16))).toBe('open');
    const newcomer = { groupIds: [1], groupIntervals: { 1: [{ from: at(20) }] } };
    const visible = chatVisibility(switched, newcomer);
    expect(visible(at(10))).toBeFalse();
    expect(visible(at(16))).toBeTrue();
  });

  it('zpřísnění na „od vstupu“ platí jen pro nové zprávy', () => {
    const switched = { ...group, ...withChatHistoryChange(group, 'from-join', at(15)) };
    const newcomer = { groupIds: [1], groupIntervals: { 1: [{ from: at(20) }] } };
    const visible = chatVisibility(switched, newcomer);
    expect(visible(at(10))).toBeTrue();
    expect(visible(at(17))).toBeFalse();
  });

  it('wasMemberAt respektuje začátek i konec intervalu', () => {
    expect(wasMemberAt([{ from: at(2), to: at(5) }], at(2))).toBeTrue();
    expect(wasMemberAt([{ from: at(2), to: at(5) }], at(5))).toBeFalse();
    expect(wasMemberAt(undefined, at(5))).toBeFalse();
  });
});
