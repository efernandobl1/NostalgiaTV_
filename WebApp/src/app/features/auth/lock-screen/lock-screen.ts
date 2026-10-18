import { Component, computed, inject, signal } from '@angular/core';
import { errorMessage } from '../../../core/api/api';
import { Session } from '../../../core/session';
import { Router, RouterLink } from '@angular/router';

/** Design: "Pantalla de bloqueo" (admin session locked for inactivity). */
@Component({
  selector: 'app-lock-screen',
  imports: [RouterLink],
  host: { class: 'min-h-dvh py-12 px-6 flex flex-col items-center justify-center gap-8 scan-ink [--scan:0.025] text-fg font-sans' },
  template: `
    <div class="flex flex-col items-center gap-1">
      <span class="font-display font-semibold text-[72px] leading-none tracking-[0.04em]">{{ time }}</span>
      <span class="font-mono text-[13px] tracking-[0.12em] text-muted">{{ date }}</span>
    </div>
    <form class="w-full max-w-95 flex flex-col items-center gap-4 p-8 max-sm:p-6 bg-panel border border-line rounded-xl" (submit)="$event.preventDefault(); unlock(pwd.value)">
      <span class="w-18 h-18 rounded-2xl flex items-center justify-center font-display font-bold text-[26px] text-on-amber bg-amber" aria-hidden="true">{{ session.initials() }}</span>
      <div class="flex flex-col items-center gap-0.5">
        <h1 class="m-0 font-display font-bold text-[24px]">{{ user() }}</h1>
        <span class="text-[13px] text-muted">Sesión bloqueada por inactividad</span>
      </div>
      <label class="self-stretch flex flex-col gap-1.5 text-[13px] text-muted">Contraseña
        <input #pwd class="field min-h-12 px-3.5 rounded-lg text-[15px]" [class.border-danger]="error()" type="password" autocomplete="current-password" (input)="error.set('')">
        @if (error()) { <span class="text-[13px] text-danger" role="alert">{{ error() }}</span> }
      </label>
      <button class="btn btn-primary self-stretch min-h-12 rounded-lg text-[15px]" type="submit">Desbloquear</button>
      <span class="text-[14px] text-muted">¿No eres tú? <a routerLink="/sesion-cerrada">Cerrar sesión</a></span>
    </form>
  `,
})
export class LockScreen {
  private readonly router = inject(Router);
  protected readonly session = inject(Session);
  /** Remembered before the lock so the same account signs back in. */
  readonly user = computed(() => this.session.me()?.username ?? localStorage.getItem('ntv.lastUser') ?? '');
  readonly error = signal('');
  readonly time = new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  readonly date = new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase();

  async unlock(password: string): Promise<void> {
    if (!password) return this.error.set('Escribe tu contraseña para continuar.');
    try {
      await this.session.signIn(this.user(), password, false);
      await this.router.navigateByUrl('/admin');
    } catch (error) {
      this.error.set(errorMessage(error, 'Contraseña incorrecta.'));
    }
  }
}
