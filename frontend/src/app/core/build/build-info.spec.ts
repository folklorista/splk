import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { BuildInfo, versionLabel } from './build-info';
import { BuildInfoService } from './build-info.service';

const release: BuildInfo = {
  version: 'v2026.10.0',
  tag: 'v2026.10.0-klatkova',
  dance: { url: 'https://example.org', title: 'Klátková z Hroznové Lhoty', codename: 'klátková', slug: 'klatkova' },
  branch: 'HEAD',
  commit: 'abc1234',
  dirty: false,
  builtAt: '2026-10-14T18:00:00Z',
};

describe('versionLabel', () => {
  it('vydanou verzi označí tancem', () => {
    expect(versionLabel(release)).toBe('klátková');
  });

  it('vydanou verzi bez tance označí tagem', () => {
    expect(versionLabel({ ...release, tag: 'v1.0', version: 'v1.0', dance: null })).toBe('v1.0');
  });

  it('build mimo release označí větví a commitem', () => {
    expect(versionLabel({ ...release, tag: null, version: null, dance: null, branch: 'feature/x' })).toBe('feature/x@abc1234');
  });

  it('necommitnuté změny označí hvězdičkou, i když je HEAD otagovaný', () => {
    expect(versionLabel({ ...release, dirty: true })).toBe('HEAD@abc1234*');
  });

  it('bez informací o buildu vrátí vývojovou verzi', () => {
    expect(versionLabel(null)).toBe('vývojová verze');
  });
});

describe('BuildInfoService', () => {
  let http: HttpTestingController;
  let service: BuildInfoService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(BuildInfoService);
  });

  it('načte build-info.json jen jednou', () => {
    const results: (BuildInfo | null)[] = [];
    service.getBuildInfo().subscribe((info) => results.push(info));
    service.getBuildInfo().subscribe((info) => results.push(info));

    http.expectOne('build-info.json').flush(release);
    expect(results).toEqual([release, release]);
  });

  it('chybějící soubor vrátí null', () => {
    let result: BuildInfo | null | undefined;
    service.getBuildInfo().subscribe((info) => (result = info));

    http.expectOne('build-info.json').flush('', { status: 404, statusText: 'Not Found' });
    expect(result).toBeNull();
  });
});
