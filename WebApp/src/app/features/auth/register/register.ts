import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthBrand } from '../auth-shell';
import { passwordScore, STRENGTH_COLORS, STRENGTH_LABELS } from '../password';

/** Design: "Crear cuenta". */
@Component({
  selector: 'app-register',
  imports: [RouterLink, AuthBrand],
  host: { class: 'min-h-dvh flex flex-wrap bg-ink text-fg font-sans' },
  template: `
    <app-auth-brand class="max-md:hidden">
      <div class="flex flex-col gap-3">
        <span class="font-mono text-[12px] tracking-[0.14em] text-amber">NUEVA SUSCRIPCIÓN</span>
        <p class="m-0 font-display font-bold text-[56px] leading-[1.05]">Sintoniza<br>tu infancia.</p>
        <span class="text-[15px] text-muted max-w-105">Guarda tu progreso, comenta tus series favoritas y vincula tus pantallas.</span>
      </div>
      <span class="font-mono text-[11px] tracking-[0.1em] text-dim">REGISTRO PÚBLICO HABILITADO</span>
    </app-auth-brand>

    <main class="flex-[1_1_480px] flex items-center justify-center py-12 px-6">
      <form class="w-full max-w-100 flex flex-col gap-4.5" (submit)="$event.preventDefault(); submit(user.value, confirm.value)">
        <div class="flex flex-col gap-1.5">
          <h1 class="m-0 font-display font-bold text-[32px]">Crear cuenta</h1>
          <span class="text-[14px] text-muted">Tu cuenta tendrá el rol de espectador.</span>
        </div>
        <label class="flex flex-col gap-1.5 text-[13px] text-muted">Usuario
          <input #user class="field min-h-12 px-3.5 rounded-lg bg-panel text-[15px]" type="text" autocomplete="username" placeholder="Ej. fernando" required>
        </label>
        <label class="flex flex-col gap-1.5 text-[13px] text-muted">Contraseña
          <input class="field min-h-12 px-3.5 rounded-lg bg-panel text-[15px]" type="password" autocomplete="new-password" [value]="pwd()" (input)="pwd.set($any($event.target).value)">
        </label>
        <div class="flex flex-col gap-1.5">
          <div class="flex gap-1" aria-hidden="true">
            @for (b of bars(); track $index) { <span class="flex-1 h-1 rounded-xs" [style.background]="b"></span> }
          </div>
          <span class="text-[12px] text-muted">Seguridad: <strong class="font-semibold text-fg">{{ strength() }}</strong> · mínimo 8 caracteres, un número y un símbolo</span>
        </div>
        <label class="flex flex-col gap-1.5 text-[13px] text-muted">Confirmar contraseña
          <input #confirm class="field min-h-12 px-3.5 rounded-lg bg-panel text-[15px]" type="password" autocomplete="new-password" (input)="error.set('')">
        </label>
        @if (error()) { <span class="-mt-2 text-[13px] text-danger" role="alert">{{ error() }}</span> }
        <button class="btn btn-primary min-h-12 rounded-lg text-[15px]" type="submit">Crear cuenta</button>
        <div class="flex items-center gap-3 font-mono text-[11px] text-dim"><span class="flex-1 h-px bg-line"></span>O<span class="flex-1 h-px bg-line"></span></div>
        <button class="btn btn-ghost min-h-12 gap-2.5 rounded-lg text-[15px]" type="button">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 12h8"></path></svg>
          Registrarse con Google
        </button>
        <span class="text-center text-[14px] text-muted">¿Ya tienes cuenta? <a routerLink="/login">Iniciar sesión</a></span>
      </form>
    </main>
  `,
})
export class Register {
  private readonly router = inject(Router);
  readonly pwd = signal('');
  readonly error = signal('');
  readonly score = computed(() => passwordScore(this.pwd()));
  readonly strength = computed(() => STRENGTH_LABELS[this.score()]);
  readonly bars = computed(() => [0, 1, 2, 3].map(i => (i < this.score() ? STRENGTH_COLORS[this.score()] : '#2C2C27')));

  submit(user: string, confirm: string): void {
    const p = this.pwd();
    if (!user.trim()) return this.error.set('Escribe un nombre de usuario.');
    if (p.length < 8 || !/\d/.test(p) || !/[^A-Za-z0-9]/.test(p)) return this.error.set('La contraseña necesita 8 caracteres, un número y un símbolo.');
    if (p !== confirm) return this.error.set('Las contraseñas no coinciden.');
    this.router.navigateByUrl('/confirmar-correo');
  }
}
