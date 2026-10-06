import { Routes } from '@angular/router';
import { PublicLayoutComponent } from './layouts/public-layout/public-layout.component';
import { DashboardLayoutComponent } from './layouts/dashboard-layout/dashboard-layout.component';
import { NotFoundComponent } from './common/not-found/not-found.component';
import { InternalErrorComponent } from './common/internal-error/internal-error.component';
import { SignInComponent } from './features/dashboard/authentication/sign-in/sign-in.component';
import { authGuard } from './core/guards/auth.guard';
import { menuGuard } from './core/guards/menu.guard';
import { adminGuard } from './core/guards/admin.guard';

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
          { path: '', redirectTo: 'summary', pathMatch: 'full' },
          { path: 'summary', loadComponent: () => import('./features/dashboard/summary/summary.component').then(m => m.SummaryComponent) },
          { path: 'activity', loadComponent: () => import('./features/dashboard/activity/activity.component').then(m => m.ActivityComponent) },
          { path: 'transcoding', canActivate: [menuGuard], loadComponent: () => import('./features/dashboard/transcoding/transcoding.component').then(m => m.TranscodingComponent) },
          { path: 'interludes', canActivate: [adminGuard], loadComponent: () => import('./features/dashboard/interludes/interludes.component').then(m => m.InterludesComponent) },
          { path: 'comments', canActivate: [adminGuard], loadComponent: () => import('./features/dashboard/community/community.component').then(m => m.CommunityComponent) },
          { path: 'series', canActivate: [menuGuard], loadComponent: () => import('./features/dashboard/series/series.component').then(m => m.SeriesComponent) },
          { path: 'episodes', canActivate: [menuGuard], loadComponent: () => import('./features/dashboard/episodes/episodes.component').then(m => m.EpisodesComponent) },
          { path: 'channels', canActivate: [menuGuard], loadComponent: () => import('./features/dashboard/channels/channels.component').then(m => m.ChannelsComponent) },
          { path: 'roles', redirectTo: 'users', pathMatch: 'full' },
          { path: 'users', canActivate: [menuGuard], data: { menuUrls: ['/dashboard/users', '/dashboard/roles'] }, loadComponent: () => import('./features/dashboard/access/access.component').then(m => m.AccessComponent) },
          { path: 'categories', canActivate: [menuGuard], loadComponent: () => import('./features/dashboard/categories/categories.component').then(m => m.CategoriesComponent) },
          { path: 'channel-eras', canActivate: [menuGuard], loadComponent: () => import('./features/dashboard/channel-eras/channel-eras.component').then(m => m.ChannelErasComponent) },
          { path: 'channel-bumpers', canActivate: [adminGuard], loadComponent: () => import('./features/dashboard/channel-bumpers/channel-bumpers.component').then(m => m.ChannelBumpersComponent) },
      ]
    },
    { path: 'internal-error', component: InternalErrorComponent },
    { path: '**', component: NotFoundComponent }
];
