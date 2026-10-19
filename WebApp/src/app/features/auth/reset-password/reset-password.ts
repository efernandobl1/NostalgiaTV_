import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Api, errorMessage } from '../../../core/api/api';
import { Session } from '../../../core/session';
import { AuthShell } from '../auth-shell';
import { PASSWORD_RULES } from '../password';

/** Design: "Nueva contraseña": the signed-in account changes its password (all sessions end). */
@Component({
  selector: 'app-reset-password',
  imports: [AuthShell],
  template: `
    <app-auth-shell>
      <form class="w-full max-w-110 flex flex-col gap-4.5 p-8 max-sm:p-6 bg-panel border border-line rounded-xl" (submit)="$event.preventDefault(); save(current.value, confirm.value)">
        <div class="flex flex-col gap-1.5">
          <span class="font-mono text-[11px] tracking-[0.14em] text-amber">SEGURIDAD DE LA CUENTA</span>
          <h1 class="m-0 font-display font-bold text-[28px]">Crea una contraseña nueva</h1>
          <span class="text-[14px] text-muted">Al guardar se cerrarán tus sesiones en todos los dispositivos.</span>
        </div>
        <label class="flex flex-col gap-1.5 text-[13px] text-muted" [hidden]="!hasPassword()">Contraseña actual
          <input #current class="field min-h-12 px-3.5 rounded-lg text-[15px]" type="password" autocomplete="current-password">
        </label>
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
          <input #confirm class="field min-h-12 px-3.5 rounded-lg text-[15px]" type="password" autocomplete="new-password" (input)="error.set('')">
        </label>
        @if (error()) { <span class="-mt-2 text-[13px] text-danger" role="alert">{{ error() }}</span> }
        <button class="btn btn-primary min-h-12 rounded-lg text-[15px]" type="submit" [disabled]="!valid() || busy()">Guardar contraseña</button>
      </form>
    </app-auth-shell>
  `,
})
export class ResetPassword {
  private readonly router = inject(Router);
  private readonly api = inject(Api);
  private readonly session = inject(Session);
  readonly pwd = signal('');
  readonly error = signal('');
  readonly busy = signal(false);
  readonly hasPassword = computed(() => this.session.me()?.hasPassword ?? true);
  readonly rules = computed(() => PASSWORD_RULES.slice(0, 1).map(([label, test]) => ({ label, ok: test(this.pwd()) })));
  readonly valid = computed(() => this.rules().every(r => r.ok));

  async save(current: string, confirm: string): Promise<void> {
    if (!this.valid()) return;
    if (confirm !== this.pwd()) return this.error.set('Las contraseñas no coinciden.');
    this.busy.set(true);
    try {
      await this.api.changePassword(current, this.pwd());
      this.session.me.set(null);
      await this.router.navigateByUrl('/login');
    } catch (error) {
      this.error.set(errorMessage(error, 'No se pudo cambiar la contraseña.'));
    } finally {
      this.busy.set(false);
    }
  }
}
