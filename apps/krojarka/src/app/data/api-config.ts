import { InjectionToken } from '@angular/core';

/** Base URL of the API, e.g. https://api.vonica.cz/v1. */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL');

/** True when the data layer runs on mock adapters (shown in the UI, K01). */
export const MOCK_DATA = new InjectionToken<boolean>('MOCK_DATA', { factory: () => false });
