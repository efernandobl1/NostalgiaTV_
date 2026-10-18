import { Routes } from '@angular/router';
import { AdminLayout } from '../../layouts/admin/admin-layout';

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    component: AdminLayout,
    children: [
      { path: '', title: 'NostalgiaTV · Resumen', loadComponent: () => import('./summary/summary').then(m => m.Summary) },
      { path: 'programacion', title: 'NostalgiaTV · Programación', loadComponent: () => import('./schedule/schedule').then(m => m.Schedule) },
      { path: 'canales', title: 'NostalgiaTV · Canales y eras', loadComponent: () => import('./channels/channels').then(m => m.Channels) },
    ],
  },
];
