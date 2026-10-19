import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Session } from './session';

/** Admin area: needs an account whose role can open at least one dashboard screen. */
export const adminGuard: CanActivateFn = (_route, state) => {
  const session = inject(Session);
  const router = inject(Router);
  if (!session.signedIn()) return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  return session.canUseDashboard() ? true : router.createUrlTree(['/']);
};

/** One admin screen: the role must have that screen's menu (route data `menu`). */
export const menuGuard: CanActivateFn = (route) => {
  const session = inject(Session);
  const router = inject(Router);
  const menu = route.data['menu'] as string | undefined;
  if (!menu || session.canOpen(menu)) return true;
  const first = [...session.screens()].find(url => url.startsWith('/admin'));
  return first && first !== menu ? router.createUrlTree([first]) : router.createUrlTree(['/']);
};

/** Pages that require a viewer account (profile comments, approving a TV). */
export const accountGuard: CanActivateFn = (_route, state) => {
  const session = inject(Session);
  return session.signedIn() ? true : inject(Router).createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};
