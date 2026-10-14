import { MOCK_POSTS } from './mock-posts';
import { MOCK_COMMENTS } from './mock-comments';
import { MOCK_MEMBERS } from '../../members/data/mock-members';

// Ukázkový obsah musí dávat smysl i s reálnými členy (`ng test --configuration demo`):
// na nástěnku píše a zmínit lze jen člena její skupiny.
describe('ukázkový obsah nástěnek', () => {
  const member = (id: number) => MOCK_MEMBERS.find((m) => m.id === id)!;

  it('autor každého příspěvku je aktivním členem skupiny nástěnky', () => {
    for (const post of MOCK_POSTS) {
      expect(member(post.authorId)?.isActive).withContext(`příspěvek ${post.id}`).toBeTrue();
      expect(member(post.authorId).groupIds).withContext(`příspěvek ${post.id}`).toContain(post.groupId);
    }
  });

  it('autoři komentářů a zmínění jsou členy skupiny nástěnky a nikdo nezmiňuje sám sebe', () => {
    for (const comment of MOCK_COMMENTS) {
      const post = MOCK_POSTS.find((p) => p.id === comment.postId)!;
      expect(member(comment.authorId).groupIds).withContext(`komentář ${comment.id}`).toContain(post.groupId);
      for (const mentionedId of comment.mentionedMemberIds) {
        expect(member(mentionedId).groupIds).withContext(`zmínka v komentáři ${comment.id}`).toContain(post.groupId);
        expect(mentionedId).withContext(`komentář ${comment.id}`).not.toBe(comment.authorId);
        expect(comment.body).toContain(`@[member:${mentionedId}]`);
      }
    }
  });
});
