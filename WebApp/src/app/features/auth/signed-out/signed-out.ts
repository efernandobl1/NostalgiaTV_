import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Session } from '../../../core/session';

/** Design: "Sesión cerrada". */
@Component({
  selector: 'app-signed-out',
  imports: [RouterLink],
  host: { class: 'min-h-dvh py-12 px-6 flex flex-col items-center justify-center gap-7 text-center scan-ink [--scan:0.025] text-fg font-sans' },
  template: `
    <div class="relative w-55 h-37.5 border-2 border-edge rounded-[18px] flex items-center justify-center bg-rail" aria-hidden="true">
      <span class="w-30 h-[3px] rounded-xs bg-fg shadow-[0_0_18px_4px_rgba(255,181,71,0.45)] animate-[tv-off_1.2s_ease-out_both]"></span>
      <span class="absolute -bottom-4.5 left-1/2 w-20 h-1.5 -ml-10 rounded-[3px] bg-line"></span>
    </div>
    <div class="flex flex-col gap-2 max-w-115">
      <span class="font-mono text-[12px] tracking-[0.14em] text-amber">FIN DE LA TRANSMISIÓN</span>
      <h1 class="m-0 font-display font-bold text-[40px]">Sesión cerrada</h1>
      <p class="m-0 text-[15px] leading-[1.55] text-muted">Cerraste tu sesión en este dispositivo. Gracias por sintonizar.</p>
    </div>
    <div class="flex flex-wrap justify-center gap-2.5">
      <a class="btn btn-primary min-h-12 px-5.5 rounded-lg text-[15px]" routerLink="/login">Volver a iniciar sesión</a>
    </div>
  `,
})
export class SignedOut {
  /** Opening this page directly also ends the session. */
  constructor() {
    const session = inject(Session);
    if (session.signedIn()) session.signOut();
  }
}
