import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { AdminPostFormComponent } from './admin-post-form.component';
import { PostsService } from '../../../../features/posts/posts.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of, Observable } from 'rxjs';
import { Post } from '../../../../features/posts/models/post.model';
import { ReactiveFormsModule } from '@angular/forms';

describe('AdminPostFormComponent', () => {
  let component: AdminPostFormComponent;
  let fixture: ComponentFixture<AdminPostFormComponent>;
  let postsService: jasmine.SpyObj<PostsService>;
  let authService: jasmine.SpyObj<AuthService>;
  let router: jasmine.SpyObj<Router>;

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
    const routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [AdminPostFormComponent, ReactiveFormsModule, RouterTestingModule],
      providers: [
        { provide: PostsService, useValue: postServiceSpy },
        { provide: AuthService, useValue: authServiceSpy },
        { provide: Router, useValue: routerSpy },
      ],
    }).compileComponents();

    postsService = TestBed.inject(PostsService) as jasmine.SpyObj<PostsService>;
    authService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
    router = TestBed.inject(Router) as jasmine.SpyObj<Router>;

    authService.currentUser.and.returnValue({
      id: 1,
      name: 'Test User',
      email: 'test@test.cz',
      role: 'member',
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
