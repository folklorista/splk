import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { AdminPostsComponent } from './admin-posts.component';
import { PostsService } from '../../../features/posts/posts.service';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';
import { Post } from '../../../features/posts/models/post.model';

describe('AdminPostsComponent', () => {
  let component: AdminPostsComponent;
  let fixture: ComponentFixture<AdminPostsComponent>;
  let postsService: jasmine.SpyObj<PostsService>;
  let router: jasmine.SpyObj<Router>;
  let mockPosts: Post[];

  beforeEach(async () => {
    mockPosts = [
      {
        id: 1,
        ensembleId: 1,
        title: 'Nástěnka 1',
        body: 'Obsah 1',
        authorId: 1,
        targetGroupIds: [],
        publishedAt: '2026-06-20T10:00:00',
        isPinned: false,
      },
      {
        id: 2,
        ensembleId: 1,
        title: 'Nástěnka 2',
        body: 'Obsah 2',
        authorId: 1,
        targetGroupIds: [],
        publishedAt: '2026-06-21T10:00:00',
        isPinned: true,
      },
    ];

    const postServiceSpy = jasmine.createSpyObj('PostsService', [
      'getPosts',
      'getPost',
      'createPost',
      'updatePost',
      'deletePost',
      'resetCache',
    ]);

    await TestBed.configureTestingModule({
      imports: [AdminPostsComponent, RouterTestingModule],
      providers: [
        { provide: PostsService, useValue: postServiceSpy },
      ],
    }).compileComponents();

    postsService = TestBed.inject(PostsService) as jasmine.SpyObj<PostsService>;
    router = TestBed.inject(RouterTestingModule) as any;

    postsService.getPosts.and.returnValue(of([...mockPosts]));
    postsService.deletePost.and.returnValue(of(true));

    fixture = TestBed.createComponent(AdminPostsComponent);
    component = fixture.componentInstance;
  });

  it('by měl být vytvořen', () => {
    expect(component).toBeTruthy();
  });

  it('měl by načíst příspěvky při init', fakeAsync(() => {
    fixture.detectChanges();
    tick(300);

    expect(postsService.getPosts).toHaveBeenCalled();
    expect(component.posts().length).toBe(2);
    expect(component.loading()).toBeFalse();
  }));

  it('měl by zobrazit loading state na začátku', () => {
    expect(component.loading()).toBeTrue();
  });

  it('měl by zobrazit příspěvky v seznamu', fakeAsync(() => {
    fixture.detectChanges();
    tick(300);

    const items = fixture.nativeElement.querySelectorAll('.admin-posts__item-title');
    expect(items.length).toBe(2);
    expect(items[0].textContent).toContain('Nástěnka 1');
    expect(items[1].textContent).toContain('Nástěnka 2');
  }));

  it('měl by zobrazit pinned badge pro připnuté příspěvky', fakeAsync(() => {
    fixture.detectChanges();
    tick(300);

    const badges = fixture.nativeElement.querySelectorAll('.admin-posts__badge-pinned');
    expect(badges.length).toBe(1);
  }));

  it('měl by smazat příspěvek po potvrzení', fakeAsync(() => {
    fixture.detectChanges();
    tick(300);

    spyOn(window, 'confirm').and.returnValue(true);
    component.onDelete(1);

    expect(window.confirm).toHaveBeenCalled();
    expect(postsService.deletePost).toHaveBeenCalledWith(1);
  }));

  it('měl by nezmazat příspěvek bez potvrzení', fakeAsync(() => {
    fixture.detectChanges();
    tick(300);

    spyOn(window, 'confirm').and.returnValue(false);
    component.onDelete(1);

    expect(postsService.deletePost).not.toHaveBeenCalled();
  }));

  it('měl by mít tlačítko Přidat příspěvek', fakeAsync(() => {
    fixture.detectChanges();
    tick(300);

    const addBtn = fixture.nativeElement.querySelector('.admin-posts__btn-add');
    expect(addBtn).toBeTruthy();
    expect(addBtn.textContent).toContain('Přidat příspěvek');
  }));
});
