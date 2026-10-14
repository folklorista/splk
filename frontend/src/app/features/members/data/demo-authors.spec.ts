import { demoMember } from './demo-authors';
import { MOCK_MEMBERS } from './mock-members';
import { GROUP_IDS } from '../../../core/data/mock-groups';

describe('demoMember', () => {
  it('vybere aktivního člena, který je ve všech zadaných skupinách', () => {
    const member = demoMember([GROUP_IDS.sklad, GROUP_IDS.tanecni]);
    expect(member.isActive).toBeTrue();
    expect(member.groupIds).toContain(GROUP_IDS.sklad);
    expect(member.groupIds).toContain(GROUP_IDS.tanecni);
  });

  it('když nikdo není ve všech skupinách, vybere člena poslední skupiny (nástěnky)', () => {
    const member = demoMember([999, GROUP_IDS.holky]);
    expect(member.groupIds).toContain(GROUP_IDS.holky);
  });

  it('n-tý člen a vyloučení dávají různé autory', () => {
    const first = demoMember([GROUP_IDS.tanecni], 0);
    expect(demoMember([GROUP_IDS.tanecni], 1).id).not.toBe(first.id);
    expect(demoMember([GROUP_IDS.tanecni], 0, [first.id]).id).not.toBe(first.id);
  });

  it('je deterministický', () => {
    expect(demoMember([GROUP_IDS.vybor], 2).id).toBe(demoMember([GROUP_IDS.vybor], 2).id);
    expect(MOCK_MEMBERS.length).toBeGreaterThan(0);
  });
});
