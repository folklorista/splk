import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ChangelogEntry, ChangelogService } from './changelog.service';

describe('ChangelogService', () => {
  let http: HttpTestingController;
  let service: ChangelogService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(ChangelogService);
  });

  it('načte changelog.json', () => {
    const entries: ChangelogEntry[] = [{
      version: 'v2026.10.0',
      releasedAt: '2026-10-14',
      dance: { url: 'https://example.org', title: 'Klátková', codename: 'klátková', slug: 'klatkova' },
      changes: ['První verze'],
    }];
    let result: ChangelogEntry[] = [];
    service.getChangelog().subscribe((e) => (result = e));

    http.expectOne('changelog.json').flush(entries);
    expect(result).toEqual(entries);
  });

  it('při chybě vrátí prázdný seznam', () => {
    let result: ChangelogEntry[] | undefined;
    service.getChangelog().subscribe((e) => (result = e));

    http.expectOne('changelog.json').flush('', { status: 404, statusText: 'Not Found' });
    expect(result).toEqual([]);
  });
});
