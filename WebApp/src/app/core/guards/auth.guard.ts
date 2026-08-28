import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { catchError, map, of } from 'rxjs';

export const authGuard: CanActivateFn = () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (authService.isAuthenticated()) return true;

    const rememberMe = localStorage.getItem('rememberMe') === 'true';
    const sessionActive = sessionStorage.getItem('sessionActive') === 'true';

    if (!rememberMe && !sessionActive) {
        router.navigate(['/dashboard/login']);
        return false;
    }

    return authService.checkSession().pipe(
        map(() => true),
        catchError(() => {
            router.navigate(['/dashboard/login']);
            return of(false);
        })
    );
};
