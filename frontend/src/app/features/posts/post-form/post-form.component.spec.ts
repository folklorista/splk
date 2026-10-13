import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { PostFormComponent } from './post-form.component';
import { PostsService } from '../posts.service';
import { AuthService } from '../../../core/auth/auth.service';
import { MembersService } from '../../members/members.service';
import { User } from '../../../core/auth/models/user.model';
import { Member } from '../../../core/models/member.model';
import { Post } from '../models/post.model';
import { BoardsService } from '../../boards/boards.service';
import { Group } from '../../../core/models/group.model';

describe('PostFormComponent', () => {
  let postsSpy: jasmine.SpyObj<PostsService>;
  let membersSpy: jasmine.SpyObj<MembersService>;
  let boardsSpy: jasmine.SpyObj<BoardsService>;

  const board: Group = { id: 2, ensembleId: 1, name: 'Kluci', slug: 'kluci' };

  const authorUser: User = { id: 1, name: 'Jana', email: 'jana@soubor.cz', groupIds: [1], roles: ['member'] };
  const otherMemberUser: User = { id: 2, name: 'Petr', email: 'petr@soubor.cz', groupIds: [1], roles: ['member'] };
  const leaderUser: User = { id: 3, name: 'Eva', email: 'eva@soubor.cz', groupIds: [1], roles: ['leader'] };

  const members: Member[] = [
    { id: 1, ensembleId: 1, userId: 1, name: 'Jana Nováková', email: 'jana@soubor.cz', groupIds: [1], isActive: true },
    { id: 2, ensembleId: 1, userId: 2, name: 'Petr Novák', email: 'petr@soubor.cz', groupIds: [1], isActive: true },
    { id: 3, ensembleId: 1, userId: 3, name: 'Eva Svobodová', email: 'eva@soubor.cz', groupIds: [1], isActive: true },
  ];

  const existingPost: Post = {
    id: 7, ensembleId: 1, title: 'Původní název', body: 'Původní text', authorId: 1, groupId: 2,
    publishedAt: '2026-01-01T00:00:00', updatedAt: '2026-01-01T00:00:00', isPinned: true, readers: [4],
  };

  function configure(user: User, paramMap: Record<string, string> = {}, accessibleBoard: Group | null = board): void {
    postsSpy = jasmine.createSpyObj('PostsService', ['getPost', 'createPost', 'updatePost']);
    postsSpy.getPost.and.returnValue(of(existingPost));
    postsSpy.createPost.and.returnValue(of({ ...existingPost, id: 99 }));
    postsSpy.updatePost.and.returnValue(of(existingPost));

    membersSpy = jasmine.createSpyObj('MembersService', ['getMembers']);
    membersSpy.getMembers.and.returnValue(of(members));

    boardsSpy = jasmine.createSpyObj('BoardsService', ['getBoardBySlug', 'getBoardById']);
    boardsSpy.getBoardBySlug.and.returnValue(of(accessibleBoard ?? undefined));
    boardsSpy.getBoardById.and.returnValue(of(accessibleBoard ?? undefined));

    TestBed.configureTestingModule({
      imports: [PostFormComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { currentUser: () => user } },
        { provide: PostsService, useValue: postsSpy },
        { provide: MembersService, useValue: membersSpy },
        { provide: BoardsService, useValue: boardsSpy },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: (key: string) => paramMap[key] ?? null } } } },
      ],
    });
  }

  it('vytvoří nový příspěvek na nástěnce z URL s aktuálním členem jako autorem', () => {
    configure(authorUser, { slug: 'kluci' });
    const fixture = TestBed.createComponent(PostFormComponent);
    fixture.detectChanges();

    fixture.componentInstance.form.setValue({ title: 'Nadpis', body: 'Obsah' });
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');

    fixture.componentInstance.onSubmit();

    expect(postsSpy.createPost).toHaveBeenCalledWith(jasmine.objectContaining({
      title: 'Nadpis', body: 'Obsah', authorId: 1, isPinned: false, groupId: 2,
    }));
    expect(boardsSpy.getBoardBySlug).toHaveBeenCalledWith('kluci');
    expect(router.navigate).toHaveBeenCalledWith(['/app/posts', 99]);
  });

  it('autor smí upravit svůj příspěvek a zachová se groupId/isPinned', () => {
    configure(authorUser, { id: '7' });
    const fixture = TestBed.createComponent(PostFormComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.notAllowed).toBeFalse();
    expect(fixture.componentInstance.form.value.title).toBe('Původní název');

    fixture.componentInstance.form.patchValue({ title: 'Nový název' });
    fixture.componentInstance.onSubmit();

    expect(postsSpy.updatePost).toHaveBeenCalledWith(7, jasmine.objectContaining({
      title: 'Nový název', groupId: 2, isPinned: true, authorId: 1,
    }));
  });

  it('vedoucí smí upravit cizí příspěvek', () => {
    configure(leaderUser, { id: '7' });
    const fixture = TestBed.createComponent(PostFormComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.notAllowed).toBeFalse();
  });

  it('běžný člen nesmí upravit cizí příspěvek', () => {
    configure(otherMemberUser, { id: '7' });
    const fixture = TestBed.createComponent(PostFormComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.notAllowed).toBeTrue();
  });

  it('nedovolí upravit příspěvek na nástěnce, kam uživatel nemá přístup', () => {
    configure(authorUser, { id: '7' }, null);
    const fixture = TestBed.createComponent(PostFormComponent);
    fixture.detectChanges();

    expect(boardsSpy.getBoardById).toHaveBeenCalledWith(2);
    expect(fixture.componentInstance.notAllowed).toBeTrue();
  });
});
