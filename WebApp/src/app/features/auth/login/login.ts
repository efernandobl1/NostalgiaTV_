import { Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { apiUrl, errorMessage } from '../../../core/api/api';
import { Session } from '../../../core/session';
import { ColorBars } from '../../../shared/ui/color-bars';
import { LogoMark } from '../../../shared/ui/logo-mark';
import { AuthBrand } from '../auth-shell';

/** Design: "Iniciar sesión" (normal / error / locked) + "Móvil · Iniciar sesión". */
@Component({
  selector: 'app-login',
  imports: [RouterLink, AuthBrand, ColorBars, LogoMark],
  host: { class: 'block min-h-dvh bg-ink text-fg font-sans' },
  templateUrl: './login.html',
})
export class Login {
  private readonly router = inject(Router);
  protected readonly session = inject(Session);

  /** Query param `?returnUrl=` set by the guards and the TV pairing page. */
  readonly returnUrl = input<string>();
  readonly showPassword = signal(false);
  readonly remember = signal(true);
  readonly busy = signal(false);
  readonly message = signal('');
  /** The API locks the account for five minutes after five wrong passwords. */
  readonly locked = computed(() => /bloquead/i.test(this.message()));
  readonly error = computed(() => !!this.message() && !this.locked());
  readonly googleEnabled = computed(() => this.session.server()?.googleEnabled ?? false);
  readonly registrationEnabled = computed(() => this.session.server()?.registrationEnabled ?? false);

  async submit(user: string, password: string): Promise<void> {
    if (this.busy()) return;
    if (!user.trim() || !password) return this.message.set('Escribe tu usuario y tu contraseña.');
    this.busy.set(true);
    this.message.set('');
    try {
      const me = await this.session.signIn(user.trim(), password, this.remember());
      await this.router.navigateByUrl(this.safeReturn() ?? (me.canUseDashboard ? '/admin' : '/'));
    } catch (error) {
      this.message.set(errorMessage(error, 'Usuario o contraseña incorrectos.'));
    } finally {
      this.busy.set(false);
    }
  }

  google(): void {
    window.location.href = apiUrl(`/api/v1/auth/google?returnUrl=${encodeURIComponent(this.safeReturn() ?? '/')}`);
  }

  /** Only local paths are followed after signing in. */
  private safeReturn(): string | null {
    const value = this.returnUrl();
    return value && value.startsWith('/') && !value.startsWith('//') ? value : null;
  }
}
