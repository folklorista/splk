import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, convertToParamMap } from '@angular/router';
import { Observable, of } from 'rxjs';
import { boardGuard } from './board.guard';
import { BoardsService } from './boards.service';
import { Group } from '../../core/models/group.model';

describe('boardGuard', () => {
  const board: Group = { id: 2, ensembleId: 1, name: 'Kluci', slug: 'kluci' };

  function run(slug: string, accessible: Group | undefined): Observable<unknown> {
    TestBed.configureTestingModule({
      providers: [
        { provide: BoardsService, useValue: { getBoardBySlug: jasmine.createSpy().and.returnValue(of(accessible)) } },
        { provide: Router, useValue: { createUrlTree: jasmine.createSpy('createUrlTree').and.callFake((c: string[]) => c) } },
      ],
    });
    const route = { paramMap: convertToParamMap({ slug }) } as ActivatedRouteSnapshot;
    return TestBed.runInInjectionContext(() => boardGuard(route, {} as RouterStateSnapshot)) as Observable<unknown>;
  }

  it('pustí na dostupnou nástěnku', (done) => {
    run('kluci', board).subscribe((result) => {
      expect(result).toBe(true);
      expect(TestBed.inject(BoardsService).getBoardBySlug).toHaveBeenCalledWith('kluci');
      done();
    });
  });

  it('nedostupnou nástěnku přesměruje na rozcestník', (done) => {
    run('vedeni', undefined).subscribe((result) => {
      expect(result).toEqual(['/app/boards']);
      done();
    });
  });
});
