import { PostComment } from '../models/comment.model';

export const MOCK_COMMENTS: PostComment[] = [
  {
    id: 1,
    postId: 1,
    authorId: 1,
    body: 'Díky za info! @Vedoucí Souboru, můžeš prosím potvrdit dopravu?',
    createdAt: '2026-06-10T10:00:00',
    mentionedMemberIds: [2],
    seenByMemberIds: [],
  },
];
