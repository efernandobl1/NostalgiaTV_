import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: 'admin', loadChildren: () => import('./features/admin/admin.routes').then(m => m.ADMIN_ROUTES) },
  { path: '', pathMatch: 'full', redirectTo: 'admin' },
];
