import { Routes } from '@angular/router';
import { accountGuard } from '../../core/guards';

/** Standalone full-page auth screens (no site chrome). */
export const AUTH_ROUTES: Routes = [
  { path: 'login', title: 'NostalgiaTV · Iniciar sesión', loadComponent: () => import('./login/login').then(m => m.Login) },
  { path: 'registro', title: 'NostalgiaTV · Crear cuenta', loadComponent: () => import('./register/register').then(m => m.Register) },
  // Accounts have no e-mail in v2; old confirmation links land on the sign-in page.
  { path: 'confirmar-correo', redirectTo: 'login' },
  { path: 'recuperar', title: 'NostalgiaTV · Recuperar contraseña', loadComponent: () => import('./recover/recover').then(m => m.Recover) },
  { path: 'nueva-contrasena', canActivate: [accountGuard], title: 'NostalgiaTV · Nueva contraseña', loadComponent: () => import('./reset-password/reset-password').then(m => m.ResetPassword) },
  { path: 'sesion-cerrada', title: 'NostalgiaTV · Sesión cerrada', loadComponent: () => import('./signed-out/signed-out').then(m => m.SignedOut) },
  { path: 'bloqueo', title: 'NostalgiaTV · Sesión bloqueada', loadComponent: () => import('./lock-screen/lock-screen').then(m => m.LockScreen) },
];
