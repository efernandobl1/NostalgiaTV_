import { Routes } from '@angular/router';
import { AdminLayout } from '../../layouts/admin/admin-layout';
import { adminGuard, menuGuard } from '../../core/guards';

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    component: AdminLayout,
    canActivate: [adminGuard],
    canActivateChild: [menuGuard],
    children: [
      { path: '', data: { menu: '/admin' }, title: 'NostalgiaTV · Resumen', loadComponent: () => import('./summary/summary').then(m => m.Summary) },
      { path: 'programacion', data: { menu: '/admin/programacion' }, title: 'NostalgiaTV · Programación', loadComponent: () => import('./schedule/schedule').then(m => m.Schedule) },
      { path: 'canales', data: { menu: '/admin/canales' }, title: 'NostalgiaTV · Canales y eras', loadComponent: () => import('./channels/channels').then(m => m.Channels) },
      { path: 'series', data: { menu: '/admin/series' }, title: 'NostalgiaTV · Series y episodios', loadComponent: () => import('./series/series').then(m => m.Series) },
      { path: 'interludios', data: { menu: '/admin/interludios' }, title: 'NostalgiaTV · Interludios', loadComponent: () => import('./interludes/interludes').then(m => m.Interludes) },
      { path: 'espectadores', data: { menu: '/admin/espectadores' }, title: 'NostalgiaTV · Espectadores', loadComponent: () => import('./viewers/viewers').then(m => m.Viewers) },
      { path: 'comentarios', data: { menu: '/admin/comentarios' }, title: 'NostalgiaTV · Comentarios', loadComponent: () => import('./comments/comments').then(m => m.Comments) },
      { path: 'media', data: { menu: '/admin/media' }, title: 'NostalgiaTV · Procesamiento de media', loadComponent: () => import('./media/media').then(m => m.Media) },
      { path: 'acceso', data: { menu: '/admin/acceso' }, title: 'NostalgiaTV · Acceso', loadComponent: () => import('./access/access').then(m => m.Access) },
      { path: 'ajustes', data: { menu: '/admin/ajustes' }, title: 'NostalgiaTV · Ajustes', loadComponent: () => import('./settings/settings').then(m => m.Settings) },
    ],
  },
];
