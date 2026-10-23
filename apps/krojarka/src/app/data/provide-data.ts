import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { API_BASE_URL, MOCK_DATA } from './api-config';
import { AuthApi } from './auth/auth-api';
import { HttpAuthApi } from './auth/http-auth-api';
import { MockAuthApi } from './auth/mock-auth-api';
import { CatalogApi } from './catalog/catalog-api';
import { HttpCatalogApi } from './catalog/http-catalog-api';
import { MockCatalogApi } from './catalog/mock-catalog-api';
import { HttpOrganizationApi } from './organization/http-organization-api';
import { MockOrganizationApi } from './organization/mock-organization-api';
import { OrganizationApi } from './organization/organization-api';

/** Chooses HTTP or mock adapters; both implement the same abstract APIs, components do not change. */
export function provideData(options: { dataSource: 'http' | 'mock'; apiBaseUrl: string }): EnvironmentProviders {
  const mock = options.dataSource === 'mock';
  return makeEnvironmentProviders([
    { provide: API_BASE_URL, useValue: options.apiBaseUrl },
    { provide: MOCK_DATA, useValue: mock },
    { provide: AuthApi, useClass: mock ? MockAuthApi : HttpAuthApi },
    { provide: CatalogApi, useClass: mock ? MockCatalogApi : HttpCatalogApi },
    { provide: OrganizationApi, useClass: mock ? MockOrganizationApi : HttpOrganizationApi },
  ]);
}
