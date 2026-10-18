import { Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthShell } from '../auth-shell';

/** Design: "Confirmar correo" (success / expired via `?estado=expirado`). */
@Component({
  selector: 'app-confirm-email',
  imports: [RouterLink, AuthShell],
  template: `
    <app-auth-shell>
      <section class="w-full max-w-110 flex flex-col items-center gap-4.5 py-9 px-8 text-center bg-panel border border-line rounded-xl">
        <span class="w-16 h-16 rounded-full flex items-center justify-center" aria-hidden="true" [class]="ok() ? 'bg-[#1E2A1E]' : 'bg-[#3A3122]'">
          @if (ok()) {
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#8BE08F" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"></path></svg>
          } @else {
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FFB547" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path></svg>
          }
        </span>
        @if (ok()) {
          <h1 class="m-0 font-display font-bold text-[28px]">Correo confirmado</h1>
          <span class="text-[14px] leading-normal text-muted">Tu cuenta está lista. Ya puedes iniciar sesión y empezar a ver.</span>
          <a class="btn btn-primary self-stretch min-h-12 rounded-lg text-[15px]" routerLink="/login">Iniciar sesión</a>
        } @else {
          <h1 class="m-0 font-display font-bold text-[28px]">El enlace expiró</h1>
          <span class="text-[14px] leading-normal text-muted">Los enlaces de confirmación duran 24 horas. Pide uno nuevo.</span>
          @if (resent()) {
            <span class="self-stretch py-3 px-3.5 rounded-lg bg-[#1E2A1E] text-[14px] text-ok" role="status">Te enviamos un enlace nuevo. Revisa tu correo.</span>
          } @else {
            <button class="btn btn-primary self-stretch min-h-12 rounded-lg text-[15px]" type="button" (click)="resent.set(true)">Enviar nuevo enlace</button>
          }
          <a class="text-[14px]" routerLink="/login">Volver a iniciar sesión</a>
        }
      </section>
    </app-auth-shell>
  `,
})
export class ConfirmEmail {
  /** Query param `?estado=expirado`. */
  readonly estado = input<string>();
  readonly ok = computed(() => this.estado() !== 'expirado');
  readonly resent = signal(false);
}
