import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Session } from '../../../core/session';
import { ColorBars } from '../../../shared/ui/color-bars';
import { LogoMark } from '../../../shared/ui/logo-mark';
import { AuthBrand } from '../auth-shell';

const MAX_ATTEMPTS = 3;
/** Mock accounts until the API is wired: admins land on the dashboard, viewers on the channels. */
const ADMINS = ['admin', 'fernando'];

/** Design: "Iniciar sesión" (normal / error / locked) + "Móvil · Iniciar sesión". */
@Component({
  selector: 'app-login',
  imports: [RouterLink, AuthBrand, ColorBars, LogoMark],
  host: { class: 'block min-h-dvh bg-ink text-fg font-sans' },
  templateUrl: './login.html',
})
export class Login {
  private readonly router = inject(Router);
  private readonly session = inject(Session);

  readonly showPassword = signal(false);
  readonly failures = signal(0);
  readonly locked = computed(() => this.failures() >= MAX_ATTEMPTS);
  readonly error = computed(() => this.failures() > 0 && !this.locked());
  readonly remaining = computed(() => MAX_ATTEMPTS - this.failures());

  submit(user: string, password: string, mobile = false): void {
    if (this.locked()) return;
    if (!user.trim() || !password) {
      this.failures.update(f => f + 1);
      return;
    }
    this.session.signIn();
    this.router.navigateByUrl(!mobile && ADMINS.includes(user.trim().toLowerCase()) ? '/admin' : '/');
  }
}
