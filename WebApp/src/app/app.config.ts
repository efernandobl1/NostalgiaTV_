import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { AuthInterceptor } from './core/interceptors/auth.interceptor';
import { routes } from './app.routes';
import { provideNativeDateAdapter, MAT_DATE_LOCALE } from '@angular/material/core';

export const appConfig: ApplicationConfig = {
    providers: [
        provideBrowserGlobalErrorListeners(),
        provideZoneChangeDetection({ eventCoalescing: true }),
        provideRouter(routes),
        provideHttpClient(withInterceptors([AuthInterceptor])),
        provideNativeDateAdapter(),
        // Fechas en formato dd/MM/yyyy en todos los datepickers de Material.
        { provide: MAT_DATE_LOCALE, useValue: 'en-GB' }
    ]
};
