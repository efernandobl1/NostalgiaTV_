import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { MenuService } from '../services/menu.service';

export const adminGuard: CanActivateFn = () =>
  inject(MenuService).currentUser()?.rol.id === 1
    ? true
    : inject(Router).createUrlTree(['/dashboard/summary']);
