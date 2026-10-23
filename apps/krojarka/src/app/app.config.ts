import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { environment } from '../environments/environment';
import {
  apiCredentialsInterceptor,
  authErrorInterceptor,
  csrfInterceptor,
} from './core/http/interceptors';
import { provideData } from './data/provide-data';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(
      withFetch(),
      withInterceptors([apiCredentialsInterceptor, authErrorInterceptor, csrfInterceptor]),
    ),
    provideData(environment),
  ],
};
