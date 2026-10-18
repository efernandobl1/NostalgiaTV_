import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { apiInterceptor } from './core/api/api';
import { Session } from './core/session';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideHttpClient(withFetch(), withInterceptors([apiInterceptor])),
    provideRouter(routes, withComponentInputBinding()),
    // Account, viewer device and server settings are known before the first screen renders.
    provideAppInitializer(() => inject(Session).load()),
  ],
};
