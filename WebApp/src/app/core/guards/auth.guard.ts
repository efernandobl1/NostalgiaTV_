import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { catchError, map, of } from 'rxjs';

export const authGuard: CanActivateFn = (_route, state) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (authService.isAuthenticated()) return true;
    const activation = state.url === '/tv' || state.url.startsWith('/tv?');
    const redirect = () => router.navigate([activation ? '/login' : '/dashboard/login'],
        activation || state.url.startsWith('/dashboard/devices') ? { queryParams: { returnUrl: state.url } } : undefined);

    const rememberMe = localStorage.getItem('rememberMe') === 'true';
    const sessionActive = sessionStorage.getItem('sessionActive') === 'true';

    if (!rememberMe && !sessionActive && !activation) {
        redirect();
        return false;
    }

    return authService.checkSession().pipe(
        map(() => true),
        catchError(() => {
            redirect();
            return of(false);
        })
    );
};
