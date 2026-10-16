import { GroupActivity, shouldNotify } from './group-notifications';

describe('shouldNotify', () => {
  const base: GroupActivity = { kind: 'chat-message', groupId: 5, authorId: 2, mentionedMemberIds: [] };

  it('vlastní aktivitu ani obsah bez přístupu neoznámí', () => {
    expect(shouldNotify({ ...base, authorId: 1 }, 1, true, 'all')).toBeFalse();
    expect(shouldNotify({ ...base, mentionedMemberIds: [1] }, 1, false, 'all')).toBeFalse();
  });

  it('zmínka upozorní vždy, i ve ztlumené skupině', () => {
    expect(shouldNotify({ ...base, mentionedMemberIds: [1] }, 1, true, 'muted')).toBeTrue();
  });

  it('běžná zpráva jen v režimu Všechny zprávy', () => {
    expect(shouldNotify(base, 1, true, 'all')).toBeTrue();
    expect(shouldNotify(base, 1, true, 'mentions')).toBeFalse();
    expect(shouldNotify(base, 1, true, 'muted')).toBeFalse();
  });

  it('nový příspěvek upozorní, pokud skupina není ztlumená', () => {
    expect(shouldNotify({ ...base, kind: 'post' }, 1, true, 'mentions')).toBeTrue();
    expect(shouldNotify({ ...base, kind: 'post' }, 1, true, 'muted')).toBeFalse();
  });
});
