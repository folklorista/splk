import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { API_BASE_URL, MOCK_DATA } from './api-config';
import { AuthApi } from './auth/auth-api';
import { HttpAuthApi } from './auth/http-auth-api';
import { MockAuthApi } from './auth/mock-auth-api';

/** Chooses HTTP or mock adapters; both implement the same abstract APIs, components do not change. */
export function provideData(options: { dataSource: 'http' | 'mock'; apiBaseUrl: string }): EnvironmentProviders {
  const mock = options.dataSource === 'mock';
  return makeEnvironmentProviders([
    { provide: API_BASE_URL, useValue: options.apiBaseUrl },
    { provide: MOCK_DATA, useValue: mock },
    { provide: AuthApi, useClass: mock ? MockAuthApi : HttpAuthApi },
  ]);
}
