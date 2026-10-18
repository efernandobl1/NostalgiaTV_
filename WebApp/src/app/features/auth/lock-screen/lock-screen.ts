import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

/** Design: "Pantalla de bloqueo" (admin session locked for inactivity). */
@Component({
  selector: 'app-lock-screen',
  imports: [RouterLink],
  host: { class: 'min-h-dvh py-12 px-6 flex flex-col items-center justify-center gap-8 scan-ink [--scan:0.025] text-fg font-sans' },
  template: `
    <div class="flex flex-col items-center gap-1">
      <span class="font-display font-semibold text-[72px] leading-none tracking-[0.04em]">14:32</span>
      <span class="font-mono text-[13px] tracking-[0.12em] text-muted">SÁBADO 17 DE OCTUBRE</span>
    </div>
    <form class="w-full max-w-95 flex flex-col items-center gap-4 p-8 max-sm:p-6 bg-panel border border-line rounded-xl" (submit)="$event.preventDefault(); unlock(pwd.value)">
      <span class="w-18 h-18 rounded-2xl flex items-center justify-center font-display font-bold text-[26px] text-on-amber bg-amber" aria-hidden="true">AD</span>
      <div class="flex flex-col items-center gap-0.5">
        <h1 class="m-0 font-display font-bold text-[24px]">admin</h1>
        <span class="text-[13px] text-muted">Sesión bloqueada por inactividad</span>
      </div>
      <label class="self-stretch flex flex-col gap-1.5 text-[13px] text-muted">Contraseña
        <input #pwd class="field min-h-12 px-3.5 rounded-lg text-[15px]" [class.border-danger]="error()" type="password" autocomplete="current-password" (input)="error.set(false)">
        @if (error()) { <span class="text-[13px] text-danger" role="alert">Escribe tu contraseña para continuar.</span> }
      </label>
      <button class="btn btn-primary self-stretch min-h-12 rounded-lg text-[15px]" type="submit">Desbloquear</button>
      <span class="text-[14px] text-muted">¿No eres tú? <a routerLink="/sesion-cerrada">Cerrar sesión</a></span>
    </form>
  `,
})
export class LockScreen {
  private readonly router = inject(Router);
  readonly error = signal(false);

  unlock(password: string): void {
    if (!password) return this.error.set(true);
    this.router.navigateByUrl('/admin');
  }
}
