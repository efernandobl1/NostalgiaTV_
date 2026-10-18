import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthShell } from '../auth-shell';

/** Design: "Recuperar contraseña" (paso 1 de 2). */
@Component({
  selector: 'app-recover',
  imports: [RouterLink, AuthShell],
  template: `
    <app-auth-shell>
      <section class="w-full max-w-110 flex flex-col gap-4.5 p-8 max-sm:p-6 bg-panel border border-line rounded-xl">
        @if (!sent()) {
          <form class="contents" (submit)="$event.preventDefault(); send(email)">
            <div class="flex flex-col gap-1.5">
              <span class="font-mono text-[11px] tracking-[0.14em] text-amber">PASO 1 DE 2</span>
              <h1 class="m-0 font-display font-bold text-[28px]">Recuperar contraseña</h1>
              <span class="text-[14px] leading-normal text-muted">Escribe tu correo y te enviaremos un enlace para crear una contraseña nueva.</span>
            </div>
            <label class="flex flex-col gap-1.5 text-[13px] text-muted">Correo electrónico
              <input #email class="field min-h-12 px-3.5 rounded-lg text-[15px]" type="email" autocomplete="email" placeholder="tu@correo.com" required>
            </label>
            <button class="btn btn-primary min-h-12 rounded-lg text-[15px]" type="submit">Enviar enlace</button>
          </form>
        } @else {
          <span class="w-13 h-13 rounded-full flex items-center justify-center bg-[#1E2A1E]" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8BE08F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="M3 7l9 6 9-6"></path></svg>
          </span>
          <div class="flex flex-col gap-1.5">
            <h1 class="m-0 font-display font-bold text-[28px]">Revisa tu correo</h1>
            <span class="text-[14px] leading-normal text-muted">Si el correo está registrado, recibirás un enlace válido por 30 minutos.</span>
          </div>
          <button class="btn btn-ghost min-h-12 rounded-lg text-[15px]" type="button" (click)="sent.set(false)">Reenviar enlace</button>
          <a class="text-[13px] text-center" routerLink="/nueva-contrasena">Simular: abrir el enlace del correo</a>
        }
        <a class="text-[14px] text-center" routerLink="/login">← Volver a iniciar sesión</a>
      </section>
    </app-auth-shell>
  `,
})
export class Recover {
  readonly sent = signal(false);

  send(email: HTMLInputElement): void {
    if (email.checkValidity()) this.sent.set(true);
    else email.reportValidity();
  }
}
