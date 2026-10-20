import { Routes } from '@angular/router';
import { TvLayout } from '../../layouts/tv/tv-layout';

/** Android TV mode: 10-foot screens on a scaled 1920×1080 stage with D-pad navigation. */
export const TV_ROUTES: Routes = [
  {
    path: '',
    component: TvLayout,
    children: [
      { path: '', title: 'NostalgiaTV TV · Canales', loadComponent: () => import('./tv-home').then(m => m.TvHome) },
      { path: 'canal/:id', title: 'NostalgiaTV TV · Canal', loadComponent: () => import('./tv-channel').then(m => m.TvChannel) },
      { path: 'series', title: 'NostalgiaTV TV · Series', loadComponent: () => import('./tv-catalog').then(m => m.TvCatalog) },
      { path: 'series/:id', title: 'NostalgiaTV TV · Serie', loadComponent: () => import('./tv-series').then(m => m.TvSeries) },
      { path: 'series/:id/episodio/:episodeId', title: 'NostalgiaTV TV · Episodio', loadComponent: () => import('./tv-episode').then(m => m.TvEpisode) },
      { path: 'guia', title: 'NostalgiaTV TV · Guía', loadComponent: () => import('./tv-guide').then(m => m.TvGuide) },
      { path: 'ver/:id', title: 'NostalgiaTV TV · En vivo', loadComponent: () => import('./tv-player').then(m => m.TvPlayer) },
      { path: 'ajustes', title: 'NostalgiaTV TV · Ajustes', loadComponent: () => import('./tv-settings').then(m => m.TvSettings) },
      { path: 'vincular', title: 'NostalgiaTV TV · Vincular', loadComponent: () => import('./tv-pair').then(m => m.TvPair) },
    ],
  },
];
