import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { PostDetailComponent } from './post-detail.component';
import { PostsService } from '../posts.service';
import { AuthService } from '../../../core/auth/auth.service';
import { MembersService } from '../../members/members.service';
import { User } from '../../../core/auth/models/user.model';
import { Member } from '../../../core/models/member.model';
import { Post } from '../models/post.model';

describe('PostDetailComponent', () => {
  let postsSpy: jasmine.SpyObj<PostsService>;
  let membersSpy: jasmine.SpyObj<MembersService>;

  const user: User = { id: 1, name: 'Jana', email: 'jana@soubor.cz', groupIds: [1], roles: ['leader'] };

  const members: Member[] = [
    { id: 1, ensembleId: 1, userId: 1, name: 'Jana Nováková', email: 'jana@soubor.cz', groupIds: [1], isActive: true },
    { id: 2, ensembleId: 1, userId: 2, name: 'Petr Novák', email: 'petr@soubor.cz', groupIds: [1], isActive: true },
    { id: 3, ensembleId: 1, userId: 3, name: 'Karel Mimo', email: 'karel@soubor.cz', groupIds: [99], isActive: true },
    { id: 4, ensembleId: 1, userId: 4, name: 'Eva Svobodová', email: 'eva@soubor.cz', groupIds: [1], isActive: true },
  ];

  const post: Post = {
    id: 5, ensembleId: 1, title: 'Oznámení', body: 'Text', authorId: 1, targetGroupIds: [1],
    publishedAt: '2026-01-01T00:00:00', updatedAt: '2026-01-01T00:00:00', isPinned: false, readers: [2],
  };

  function configure(): void {
    postsSpy = jasmine.createSpyObj('PostsService', ['getPost', 'markAsRead']);
    postsSpy.getPost.and.returnValue(of(post));
    postsSpy.markAsRead.and.returnValue(of(undefined));

    membersSpy = jasmine.createSpyObj('MembersService', ['getMembers']);
    membersSpy.getMembers.and.returnValue(of(members));

    TestBed.configureTestingModule({
      imports: [PostDetailComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { currentUser: () => user } },
        { provide: PostsService, useValue: postsSpy },
        { provide: MembersService, useValue: membersSpy },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => '5' } } } },
      ],
    });
  }

  it('rozdělí viditelné členy na ty, co četli, a ty, co nečetli (přihlášený je po otevření automaticky mezi čtenáři)', () => {
    configure();
    const fixture = TestBed.createComponent(PostDetailComponent);
    fixture.detectChanges();

    const status = fixture.componentInstance.readStatus();
    expect(status.read.map((m) => m.name).sort()).toEqual(['Jana Nováková', 'Petr Novák']);
    expect(status.unread.map((m) => m.name)).toEqual(['Eva Svobodová']);
  });

  it('nezahrne do přehledu člena mimo cílovou skupinu příspěvku', () => {
    configure();
    const fixture = TestBed.createComponent(PostDetailComponent);
    fixture.detectChanges();

    const names = fixture.componentInstance.visibleMembers().map((m) => m.name);
    expect(names).not.toContain('Karel Mimo');
  });

  it('označí příspěvek za přečtený přihlášeným členem, pokud ho ještě nečetl', () => {
    configure();
    const fixture = TestBed.createComponent(PostDetailComponent);
    fixture.detectChanges();

    expect(postsSpy.markAsRead).toHaveBeenCalledWith(5, 1);
  });

  it('nevolá markAsRead, pokud už člen příspěvek přečetl', () => {
    configure();
    postsSpy.getPost.and.returnValue(of({ ...post, readers: [1, 2] }));
    const fixture = TestBed.createComponent(PostDetailComponent);
    fixture.detectChanges();

    expect(postsSpy.markAsRead).not.toHaveBeenCalled();
  });
});
