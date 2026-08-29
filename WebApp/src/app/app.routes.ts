import { Routes } from '@angular/router';
import { provideNativeDateAdapter } from '@angular/material/core';
import { authGuard } from './core/guards/auth.guard';
import { menuGuard } from './core/guards/menu.guard';

export const routes: Routes = [
    {
        path: '',
        loadComponent: () => import('./layouts/public-layout/public-layout.component').then(m => m.PublicLayoutComponent),
        children: [
            { path: '', loadComponent: () => import('./features/public/home/home.component').then(m => m.HomeComponent) }
        ]
    },
    { path: 'dashboard/login', loadComponent: () => import('./features/dashboard/authentication/sign-in/sign-in.component').then(m => m.SignInComponent) },
    { path: 'dashboard/logout', loadComponent: () => import('./features/dashboard/authentication/logout/logout.component').then(m => m.LogoutComponent) },
    {
      path: 'dashboard',
      loadComponent: () => import('./layouts/dashboard-layout/dashboard-layout.component').then(m => m.DashboardLayoutComponent),
      canActivate: [authGuard],
      providers: [provideNativeDateAdapter()],
      children: [
          { path: '', redirectTo: 'series', pathMatch: 'full' },
          { path: 'series', canActivate: [menuGuard], loadComponent: () => import('./features/dashboard/series/series.component').then(m => m.SeriesComponent) },
          { path: 'episodes', canActivate: [menuGuard], loadComponent: () => import('./features/dashboard/episodes/episodes.component').then(m => m.EpisodesComponent) },
          { path: 'channels', canActivate: [menuGuard], loadComponent: () => import('./features/dashboard/channels/channels.component').then(m => m.ChannelsComponent) },
          { path: 'roles', canActivate: [menuGuard], loadComponent: () => import('./features/dashboard/roles/roles.component').then(m => m.RolesComponent) },
          { path: 'users', canActivate: [menuGuard], loadComponent: () => import('./features/dashboard/users/users.component').then(m => m.UsersComponent) },
          { path: 'categories', canActivate: [menuGuard], loadComponent: () => import('./features/dashboard/categories/categories.component').then(m => m.CategoriesComponent) },
          { path: 'channel-eras', canActivate: [menuGuard], loadComponent: () => import('./features/dashboard/channel-eras/channel-eras.component').then(m => m.ChannelErasComponent) },
          { path: 'channel-bumpers', canActivate: [menuGuard], loadComponent: () => import('./features/dashboard/channel-bumpers/channel-bumpers.component').then(m => m.ChannelBumpersComponent) },
      ]
    },
    { path: 'internal-error', loadComponent: () => import('./common/internal-error/internal-error.component').then(m => m.InternalErrorComponent) },
    { path: '**', loadComponent: () => import('./common/not-found/not-found.component').then(m => m.NotFoundComponent) }
];
