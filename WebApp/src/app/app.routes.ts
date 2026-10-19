import { Routes } from '@angular/router';
import { AUTH_ROUTES } from './features/auth/auth.routes';

export const routes: Routes = [
  { path: 'admin', loadChildren: () => import('./features/admin/admin.routes').then(m => m.ADMIN_ROUTES) },
  { path: 'tv', loadChildren: () => import('./features/tv/tv.routes').then(m => m.TV_ROUTES) },
  ...AUTH_ROUTES,
  { path: 'error', title: 'NostalgiaTV · Error del servidor', loadComponent: () => import('./features/errors/server-error').then(m => m.ServerError) },
  { path: '', loadChildren: () => import('./features/public/public.routes').then(m => m.PUBLIC_ROUTES) },
  { path: '**', title: 'NostalgiaTV · Página no encontrada', loadComponent: () => import('./features/errors/not-found').then(m => m.NotFound) },
];
