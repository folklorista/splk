import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { AdminPostFormComponent } from './admin-post-form.component';
import { PostsService } from '../../../../features/posts/posts.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { MembersService } from '../../../../features/members/members.service';
import { Router, ActivatedRoute, provideRouter } from '@angular/router';
import { of, Observable } from 'rxjs';
import { Post } from '../../../../features/posts/models/post.model';
import { ReactiveFormsModule } from '@angular/forms';

describe('AdminPostFormComponent', () => {
  let component: AdminPostFormComponent;
  let fixture: ComponentFixture<AdminPostFormComponent>;
  let postsService: jasmine.SpyObj<PostsService>;
  let authService: jasmine.SpyObj<AuthService>;
  let router: Router;

  beforeEach(async () => {
    const postServiceSpy = jasmine.createSpyObj('PostsService', [
      'getPosts',
      'getPost',
      'createPost',
      'updatePost',
      'deletePost',
      'resetCache',
    ]);
    const authServiceSpy = jasmine.createSpyObj('AuthService', ['currentUser']);
    const membersServiceSpy = jasmine.createSpyObj('MembersService', ['getMembers']);
    membersServiceSpy.getMembers.and.returnValue(of([
      { id: 1, ensembleId: 1, userId: 1, name: 'Test User', email: 'test@test.cz', groupIds: [1], isActive: true },
    ]));

    await TestBed.configureTestingModule({
      imports: [AdminPostFormComponent, ReactiveFormsModule],
      providers: [
        provideRouter([]),
        { provide: PostsService, useValue: postServiceSpy },
        { provide: AuthService, useValue: authServiceSpy },
        { provide: MembersService, useValue: membersServiceSpy },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => null } } } },
      ],
    }).compileComponents();

    postsService = TestBed.inject(PostsService) as jasmine.SpyObj<PostsService>;
    authService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
    router = TestBed.inject(Router);
    spyOn(router, 'navigate');

    authService.currentUser.and.returnValue({
      id: 1,
      name: 'Test User',
      email: 'test@test.cz',
      groupIds: [1],
      roles: ['member'],
    });
    postsService.createPost.and.returnValue(of({ id: 5 } as Post));
    postsService.updatePost.and.returnValue(of({ id: 1 } as Post));

    fixture = TestBed.createComponent(AdminPostFormComponent);
    component = fixture.componentInstance;
  });

  it('by měl být vytvořen', () => {
    expect(component).toBeTruthy();
  });

  it('měl by inicializovat formulář v create módu', () => {
    fixture.detectChanges();

    expect(component.isEditMode).toBeFalse();
    expect(component.form.get('title')?.value).toBe('');
    expect(component.form.get('body')?.value).toBe('');
    expect(component.form.get('isPinned')?.value).toBeFalse();
  });

  it('měl by vytvořit příspěvek a navigovat zpět', fakeAsync(() => {
    fixture.detectChanges();

    component.form.patchValue({
      title: 'Nový příspěvek',
      body: 'Obsah příspěvku',
      isPinned: false,
    });

    component.onSubmit();
    tick(300);

    expect(postsService.createPost).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/app/admin/posts']);
  }));

  it('měl by validovat povinná pole', () => {
    fixture.detectChanges();

    expect(component.form.invalid).toBeTrue();

    component.form.patchValue({
      title: 'Nadpis',
      body: 'Obsah',
    });

    expect(component.form.valid).toBeTrue();
  });

  it('měl by mít disabled tlačítko při invalid formuláři', fakeAsync(() => {
    fixture.detectChanges();
    tick();

    let btn = fixture.nativeElement.querySelector('.admin-post-form__btn-primary');
    expect(btn.disabled).toBeTrue();

    component.form.patchValue({
      title: 'Nadpis',
      body: 'Obsah',
    });
    fixture.detectChanges();
    tick();

    btn = fixture.nativeElement.querySelector('.admin-post-form__btn-primary');
    expect(btn.disabled).toBeFalse();
  }));

  it('měl by zobrazit chybovou zprávu při selhání submit', fakeAsync(() => {
    postsService.createPost.and.returnValue(
      new Observable((subscriber) => subscriber.error('Network error')),
    );

    fixture.detectChanges();

    component.form.patchValue({
      title: 'Nadpis',
      body: 'Obsah',
    });

    component.onSubmit();
    tick(300);

    expect(component.submitError).toBeTruthy();
  }));
});

describe('AdminPostFormComponent v edit módu', () => {
  const existingPost: Post = {
    id: 1, ensembleId: 1, title: 'Původní název', body: 'Původní text', authorId: 99, targetGroupIds: [5],
    publishedAt: '2026-01-01T00:00:00', updatedAt: '2026-01-01T00:00:00', isPinned: true, readers: [4],
  };

  let component: AdminPostFormComponent;
  let fixture: ComponentFixture<AdminPostFormComponent>;
  let postsService: jasmine.SpyObj<PostsService>;

  beforeEach(async () => {
    const postServiceSpy = jasmine.createSpyObj('PostsService', ['getPost', 'updatePost']);
    postServiceSpy.getPost.and.returnValue(of(existingPost));
    postServiceSpy.updatePost.and.returnValue(of(existingPost));

    const membersServiceSpy = jasmine.createSpyObj('MembersService', ['getMembers']);
    membersServiceSpy.getMembers.and.returnValue(of([
      { id: 1, ensembleId: 1, userId: 1, name: 'Editor', email: 'editor@test.cz', groupIds: [1], isActive: true },
    ]));

    await TestBed.configureTestingModule({
      imports: [AdminPostFormComponent, ReactiveFormsModule],
      providers: [
        provideRouter([]),
        { provide: PostsService, useValue: postServiceSpy },
        { provide: AuthService, useValue: { currentUser: () => ({ id: 1, name: 'Editor', email: 'editor@test.cz', groupIds: [1], roles: ['admin'] }) } },
        { provide: MembersService, useValue: membersServiceSpy },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => '1' } } } },
      ],
    }).compileComponents();

    postsService = TestBed.inject(PostsService) as jasmine.SpyObj<PostsService>;
    spyOn(TestBed.inject(Router), 'navigate');
    fixture = TestBed.createComponent(AdminPostFormComponent);
    component = fixture.componentInstance;
  });

  it('zachová authorId a targetGroupIds původního příspěvku při úpravě', fakeAsync(() => {
    fixture.detectChanges();
    tick(300);

    component.form.patchValue({ title: 'Upravený název' });
    component.onSubmit();
    tick(300);

    expect(postsService.updatePost).toHaveBeenCalledWith(1, jasmine.objectContaining({
      title: 'Upravený název',
      authorId: 99,
      targetGroupIds: [5],
    }));
  }));

  it('odešle změněné cílení, pokud ho admin upraví', fakeAsync(() => {
    fixture.detectChanges();
    tick(300);

    component.targetGroupIds.set([5, 6]);
    component.targetMemberIds.set([42]);
    component.onSubmit();
    tick(300);

    expect(postsService.updatePost).toHaveBeenCalledWith(1, jasmine.objectContaining({
      targetGroupIds: [5, 6],
      targetMemberIds: [42],
    }));
  }));
});
