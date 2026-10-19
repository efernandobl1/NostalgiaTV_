import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthShell } from '../auth-shell';

/**
 * Design: "Recuperar contraseña". The v2 accounts have no e-mail address, so access is restored
 * by an administrator (Acceso → usuario → nueva contraseña).
 */
@Component({
  selector: 'app-recover',
  imports: [RouterLink, AuthShell],
  template: `
    <app-auth-shell>
      <section class="w-full max-w-110 flex flex-col gap-4.5 p-8 max-sm:p-6 bg-panel border border-line rounded-xl">
        <div class="flex flex-col gap-1.5">
          <span class="font-mono text-[11px] tracking-[0.14em] text-amber">RECUPERAR ACCESO</span>
          <h1 class="m-0 font-display font-bold text-[28px]">¿Olvidaste tu contraseña?</h1>
          <span class="text-[14px] leading-normal text-muted">Las cuentas de NostalgiaTV no usan correo. Pide al administrador de tu servidor que te asigne una contraseña nueva desde el panel; después podrás cambiarla en tu perfil.</span>
        </div>
        <span class="text-[14px] leading-normal text-muted">Si entraste con Google, usa «Continuar con Google» en la pantalla de inicio de sesión.</span>
        <a class="btn btn-primary min-h-12 rounded-lg text-[15px]" routerLink="/login">Volver a iniciar sesión</a>
      </section>
    </app-auth-shell>
  `,
})
export class Recover {}
