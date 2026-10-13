import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs/operators';
import { BoardsService } from './boards.service';

// Na nástěnku skupiny pustí jen jejího člena (nebo administrátora)
export const boardGuard: CanActivateFn = (route) => {
  const boards = inject(BoardsService);
  const router = inject(Router);
  const slug = route.paramMap.get('slug') ?? '';

  return boards.getBoardBySlug(slug).pipe(
    map((board) => (board ? true : router.createUrlTree(['/app/boards']))),
  );
};
