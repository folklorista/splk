import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs/operators';
import { BoardsService } from './boards.service';
import { AccessService } from '../../core/access/access.service';
import { canPostInGroup, isGroupMember } from '../../core/access/access.utils';

// Nový příspěvek smí napsat jen člen skupiny (otevřenou skupinu ostatní jen čtou)
export const boardGuard: CanActivateFn = (route) => {
  const boards = inject(BoardsService);
  const access = inject(AccessService);
  const router = inject(Router);
  const slug = route.paramMap.get('slug') ?? '';

  return boards.getBoardBySlug(slug).pipe(
    map((board) => (board && canPostInGroup(access.subject(), board) && isGroupMember(access.subject(), board.id) ? true : router.createUrlTree(['/app/boards']))),
  );
};
