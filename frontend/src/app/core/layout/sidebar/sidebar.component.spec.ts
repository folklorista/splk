import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { SidebarComponent } from './sidebar.component';
import { AuthService } from '../../auth/auth.service';
import { BuildInfoService } from '../../build/build-info.service';
import { NavSection, NavigationService } from '../navigation.service';
import { SETTINGS_STORAGE_KEY, SettingsService } from '../../settings/settings.service';

describe('SidebarComponent', () => {
  const sections: NavSection[] = [
    { key: 'main', items: [{ path: '/app/dashboard', label: 'Přehled', icon: 'home' }], hidden: [] },
    { key: 'agendas', label: 'Agendy', items: [], hidden: [{ path: '/app/manage', label: 'Správa', icon: 'settings', badge: 2 }] },
  ];

  beforeEach(() => localStorage.removeItem(SETTINGS_STORAGE_KEY));
  afterEach(() => localStorage.removeItem(SETTINGS_STORAGE_KEY));

  function render() {
    TestBed.configureTestingModule({
      imports: [SidebarComponent],
      providers: [
        provideRouter([]),
        { provide: BuildInfoService, useValue: { getBuildInfo: () => of(null) } },
        { provide: AuthService, useValue: { currentUser: () => ({ id: 1, name: 'Staňa', email: '' }), logout: () => {} } },
        { provide: NavigationService, useValue: { start: () => {}, stop: () => {}, sections: () => sections } },
      ],
    });
    const fixture = TestBed.createComponent(SidebarComponent);
    fixture.detectChanges();
    return fixture;
  }

  const aside = (el: HTMLElement) => el.querySelector('.sidebar')!;
  const toggle = (el: HTMLElement) => el.querySelector<HTMLButtonElement>('.sidebar__toggle')!;

  it('výchozí je rozbalený; přepínač sbalí menu a volba přežije nové načtení', () => {
    const fixture = render();
    const el: HTMLElement = fixture.nativeElement;
    expect(aside(el).classList).not.toContain('sidebar--compact');
    expect(toggle(el).getAttribute('aria-label')).toBe('Sbalit boční menu');

    toggle(el).click();
    fixture.detectChanges();
    expect(aside(el).classList).toContain('sidebar--compact');
    expect(toggle(el).getAttribute('aria-expanded')).toBe('false');
    // Název položky zůstává v DOM jako přístupný název (tooltip jen navíc)
    expect(el.querySelector('.sidebar__nav-item .sidebar__label')!.textContent).toContain('Přehled');

    TestBed.resetTestingModule();
    const reloaded = render();
    expect(aside(reloaded.nativeElement).classList).toContain('sidebar--compact');
    expect(TestBed.inject(SettingsService).settings().sidebarCompact).toBeTrue();
  });

  it('skryté položky jsou pod „Další“ se součtem badge a dají se rozbalit', () => {
    const fixture = render();
    const el: HTMLElement = fixture.nativeElement;
    const more = el.querySelector<HTMLButtonElement>('.sidebar__more')!;
    expect(more.textContent).toContain('Další (1)');
    expect(more.querySelector('.sidebar__badge')!.textContent).toBe('2');
    expect(el.querySelector('a[href="/app/manage"]')).toBeNull();

    more.click();
    fixture.detectChanges();
    expect(more.getAttribute('aria-expanded')).toBe('true');
    expect(el.querySelector('a[href="/app/manage"]')).not.toBeNull();
  });
});
