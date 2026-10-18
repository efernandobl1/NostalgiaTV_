import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthShell } from '../auth-shell';
import { PASSWORD_RULES } from '../password';

/** Design: "Nueva contraseña" (paso 2 de 2). */
@Component({
  selector: 'app-reset-password',
  imports: [AuthShell],
  template: `
    <app-auth-shell>
      <form class="w-full max-w-110 flex flex-col gap-4.5 p-8 max-sm:p-6 bg-panel border border-line rounded-xl" (submit)="$event.preventDefault(); save(confirm.value)">
        <div class="flex flex-col gap-1.5">
          <span class="font-mono text-[11px] tracking-[0.14em] text-amber">PASO 2 DE 2</span>
          <h1 class="m-0 font-display font-bold text-[28px]">Crea una contraseña nueva</h1>
          <span class="text-[14px] text-muted">Al guardar se cerrarán tus sesiones en otros dispositivos.</span>
        </div>
        <label class="flex flex-col gap-1.5 text-[13px] text-muted">Nueva contraseña
          <input class="field min-h-12 px-3.5 rounded-lg text-[15px]" type="password" autocomplete="new-password" [value]="pwd()" (input)="pwd.set($any($event.target).value)">
        </label>
        <ul class="m-0 p-0 list-none flex flex-col gap-1.5">
          @for (r of rules(); track r.label) {
            <li class="flex items-center gap-2 text-[13px]" [class]="r.ok ? 'text-ok' : 'text-muted'">
              <span class="font-mono" aria-hidden="true">{{ r.ok ? '✓' : '·' }}</span>{{ r.label }}
            </li>
          }
        </ul>
        <label class="flex flex-col gap-1.5 text-[13px] text-muted">Confirmar contraseña
          <input #confirm class="field min-h-12 px-3.5 rounded-lg text-[15px]" type="password" autocomplete="new-password" (input)="mismatch.set(false)">
        </label>
        @if (mismatch()) { <span class="-mt-2 text-[13px] text-danger" role="alert">Las contraseñas no coinciden.</span> }
        <button class="btn btn-primary min-h-12 rounded-lg text-[15px]" type="submit" [disabled]="!valid()">Guardar contraseña</button>
      </form>
    </app-auth-shell>
  `,
})
export class ResetPassword {
  private readonly router = inject(Router);
  readonly pwd = signal('');
  readonly mismatch = signal(false);
  readonly rules = computed(() => PASSWORD_RULES.map(([label, test]) => ({ label, ok: test(this.pwd()) })));
  readonly valid = computed(() => this.rules().every(r => r.ok));

  save(confirm: string): void {
    if (!this.valid()) return;
    if (confirm !== this.pwd()) return this.mismatch.set(true);
    this.router.navigateByUrl('/login');
  }
}
