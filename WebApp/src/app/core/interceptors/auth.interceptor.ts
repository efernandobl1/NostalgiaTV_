import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';

export const AuthInterceptor: HttpInterceptorFn = (req, next) => {
    const url = new URL(req.url, globalThis.location?.origin ?? 'http://localhost');
    const api = new URL(environment.apiUrl || '/', globalThis.location?.origin ?? 'http://localhost');
    if (url.origin !== api.origin || !url.pathname.startsWith('/api/')) return next(req);
    const auth = inject(AuthService);
    const authReq = req.clone({ withCredentials: true });
    return next(authReq).pipe(catchError((error: unknown) => {
        if (!(error instanceof HttpErrorResponse) || error.status !== 401 ||
            /^\/api\/v\d+\/(auth|public|viewer)(\/|$)/.test(url.pathname)) return throwError(() => error);
        return auth.refresh().pipe(switchMap(() => next(authReq)));
    }));
};
