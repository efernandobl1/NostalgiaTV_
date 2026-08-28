import { Routes } from '@angular/router';
import { PublicLayoutComponent } from './layouts/public-layout/public-layout.component';
import { DashboardLayoutComponent } from './layouts/dashboard-layout/dashboard-layout.component';
import { NotFoundComponent } from './common/not-found/not-found.component';
import { InternalErrorComponent } from './common/internal-error/internal-error.component';
import { SignInComponent } from './features/dashboard/authentication/sign-in/sign-in.component';
import { authGuard } from './core/guards/auth.guard';
import { menuGuard } from './core/guards/menu.guard';

export const routes: Routes = [
    {
        path: '',
        component: PublicLayoutComponent,
        children: [
            { path: '', loadComponent: () => import('./features/public/home/home.component').then(m => m.HomeComponent) }
        ]
    },
    { path: 'dashboard/login', component: SignInComponent },
    { path: 'dashboard/logout', loadComponent: () => import('./features/dashboard/authentication/logout/logout.component').then(m => m.LogoutComponent) },
    {
      path: 'dashboard',
      component: DashboardLayoutComponent,
      canActivate: [authGuard],
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
    { path: 'internal-error', component: InternalErrorComponent },
    { path: '**', component: NotFoundComponent }
];
