import { Component, DestroyRef, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, finalize, of, switchMap } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { WatchedService } from '../../core/services/watched.service';
import { ServerConnectionsService } from '../../core/services/server-connections.service';
import { environment } from '../../../environments/environment';

@Component({
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './account.component.html',
  styleUrls: ['../dashboard/authentication/sign-in/sign-in.component.scss'],
  styles: '.access-panel > p { margin-top: 16px; } .signal-header .signal-back { width: auto; white-space: nowrap; flex-shrink: 0; }',
})
export class AccountComponent {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly watched = inject(WatchedService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroy = inject(DestroyRef);
  readonly servers = inject(ServerConnectionsService);
  readonly features = signal({ registrationEnabled: false, googleEnabled: false });
  readonly busy = signal(false);
  readonly error = signal('');
  readonly registering = signal(this.route.snapshot.queryParamMap.get('mode') === 'register');
  readonly form = inject(FormBuilder).nonNullable.group({ username: ['', Validators.required], password: ['', Validators.required], rememberMe: true });
  private readonly destination = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/';
  readonly googleUrl = `${environment.apiUrl}/api/v1/auth/google?returnUrl=${encodeURIComponent(this.safeDestination())}`;

  constructor() {
    this.http.get<{ registrationEnabled: boolean; googleEnabled: boolean }>(`${environment.apiUrl}/api/v1/server`).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: features => this.features.set(features), error: () => this.error.set('No se pudo comprobar el servidor. Vuelve a cargar la página.'),
    });
    if (this.route.snapshot.queryParamMap.has('error')) this.error.set('No se pudo completar el acceso con Google. Comprueba si el servidor permite crear cuentas o usa tu contraseña.');
    if (this.auth.isAuthenticated()) this.openProfile();
    else this.auth.checkSession().pipe(takeUntilDestroyed(this.destroy)).subscribe({ next: () => this.openProfile(), error: () => {} });
  }

  submit(): void {
    if (this.busy()) return;
    this.form.markAllAsTouched();
    const value = this.form.getRawValue();
    if (this.form.invalid) return;
    if (this.registering() && (!/^[A-Za-z0-9][A-Za-z0-9_.-]{2,49}$/.test(value.username) || value.password.length < 12 || value.password.length > 128)) {
      this.error.set('Usa un nombre de 3 a 50 letras, números, puntos o guiones, y una contraseña de 12 a 128 caracteres.'); return;
    }
    this.busy.set(true); this.error.set('');
    const registration: Observable<unknown> = this.registering() ? this.http.post(`${environment.apiUrl}/api/v1/auth/register`, { username: value.username, password: value.password }, { withCredentials: true }) : of(null);
    registration.pipe(switchMap(() => this.auth.login(value)), takeUntilDestroyed(this.destroy), finalize(() => this.busy.set(false))).subscribe({
      next: () => { if (value.rememberMe) localStorage.setItem('rememberMe', 'true'); else sessionStorage.setItem('sessionActive', 'true'); this.openProfile(); },
      error: error => this.error.set(error.status === 409 ? 'Ese usuario ya existe. Elige otro nombre.' : error.status === 429 ? 'Demasiados intentos. Espera un minuto.' : error.status === 403 ? 'El administrador no permite crear cuentas.' : 'No se pudo entrar. Revisa tu usuario y contraseña.'),
    });
  }

  private safeDestination(): string { return /^\/tv(?:\?code=[A-Za-z2-9-]{12,16})?$/.test(this.destination) ? this.destination : '/'; }
  private openProfile(): void {
    this.watched.connect('Navegador').pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: () => { sessionStorage.setItem('sessionActive', 'true'); void this.router.navigateByUrl(this.safeDestination()); },
      error: () => this.error.set('La cuenta está conectada, pero no se pudo recuperar el historial. Intenta entrar de nuevo.'),
    });
  }
}
