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
      { path: 'series', title: 'NostalgiaTV · Series y episodios', loadComponent: () => import('./series/series').then(m => m.Series) },
      { path: 'interludios', title: 'NostalgiaTV · Interludios', loadComponent: () => import('./interludes/interludes').then(m => m.Interludes) },
      { path: 'espectadores', title: 'NostalgiaTV · Espectadores', loadComponent: () => import('./viewers/viewers').then(m => m.Viewers) },
      { path: 'comentarios', title: 'NostalgiaTV · Comentarios', loadComponent: () => import('./comments/comments').then(m => m.Comments) },
      { path: 'media', title: 'NostalgiaTV · Procesamiento de media', loadComponent: () => import('./media/media').then(m => m.Media) },
      { path: 'acceso', title: 'NostalgiaTV · Acceso', loadComponent: () => import('./access/access').then(m => m.Access) },
      { path: 'ajustes', title: 'NostalgiaTV · Ajustes', loadComponent: () => import('./settings/settings').then(m => m.Settings) },
    ],
  },
];
