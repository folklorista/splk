import { activeEnsembleAdminIds, deactivationProblem, groupLeaveProblem, mandateRevocationProblem } from './mandate-rules';
import { testMandate, testMember } from '../../testing/access.testing';

describe('mandate-rules', () => {
  const members = [testMember({ id: 1 }), testMember({ id: 2 }), testMember({ id: 3, isActive: false })];

  it('nelze odebrat posledního aktivního správce souboru', () => {
    const only = testMandate(1, 'ensemble-admin');
    const formerAdmin = testMandate(3, 'ensemble-admin');
    expect(mandateRevocationProblem(only, [only, formerAdmin], members)).toContain('alespoň jednoho');
    const second = testMandate(2, 'ensemble-admin');
    expect(mandateRevocationProblem(only, [only, second], members)).toBeNull();
    expect(activeEnsembleAdminIds([only, second, formerAdmin], members)).toEqual([1, 2]);
  });

  it('skupina nesmí zůstat bez hlavního správce', () => {
    const owner = testMandate(1, 'group-owner', { groupId: 5 });
    const deputy = testMandate(2, 'group-deputy', { groupId: 5 });
    expect(mandateRevocationProblem(owner, [owner, deputy], members)).toContain('bez hlavního správce');
    expect(mandateRevocationProblem(deputy, [owner, deputy], members)).toBeNull();
  });

  it('ukončení členství hlídá posledního správce souboru i jediné hlavní správce skupin', () => {
    const admin = testMandate(1, 'ensemble-admin');
    const owner = testMandate(2, 'group-owner', { groupId: 5 });
    expect(deactivationProblem(1, [admin], members, () => '')).toContain('posledního');
    expect(deactivationProblem(2, [admin, owner], members, () => 'Holky')).toContain('Holky');
    expect(deactivationProblem(2, [admin], members, () => '')).toBeNull();
  });

  it('jediný hlavní správce nemůže skupinu opustit', () => {
    const owner = testMandate(1, 'group-owner', { groupId: 5 });
    expect(groupLeaveProblem(1, 5, [owner])).not.toBeNull();
    expect(groupLeaveProblem(2, 5, [owner])).toBeNull();
    expect(groupLeaveProblem(1, 5, [owner, testMandate(2, 'group-owner', { groupId: 5 })])).toBeNull();
  });
});
