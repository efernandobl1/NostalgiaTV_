import { Routes } from '@angular/router';
import { PublicLayout } from '../../layouts/public/public-layout';

export const PUBLIC_ROUTES: Routes = [
  {
    path: '',
    component: PublicLayout,
    children: [
      { path: '', pathMatch: 'full', title: 'NostalgiaTV · Canales', loadComponent: () => import('./home/home').then(m => m.Home) },
      { path: 'series', title: 'NostalgiaTV · Series', loadComponent: () => import('./catalog/catalog').then(m => m.Catalog) },
      { path: 'series/:id', title: 'NostalgiaTV · Serie', loadComponent: () => import('./series-detail/series-detail').then(m => m.SeriesDetail) },
      { path: 'canal/:id', title: 'NostalgiaTV · Canal', loadComponent: () => import('./channel-detail/channel-detail').then(m => m.ChannelDetail) },
      { path: 'ver/:id', title: 'NostalgiaTV · En vivo', loadComponent: () => import('./live/live').then(m => m.Live) },
      { path: 'guia', title: 'NostalgiaTV · Guía', loadComponent: () => import('./guide/guide').then(m => m.Guide) },
      { path: 'perfil', title: 'NostalgiaTV · Mi perfil', loadComponent: () => import('./profile/profile').then(m => m.Profile) },
      { path: 'vincular', title: 'NostalgiaTV · Vincular TV', loadComponent: () => import('./pair/pair').then(m => m.Pair) },
    ],
  },
  /** Fullscreen player renders without the site chrome. */
  { path: 'ver/:id/pantalla-completa', title: 'NostalgiaTV · Pantalla completa', loadComponent: () => import('./fullscreen/fullscreen').then(m => m.Fullscreen) },
];
