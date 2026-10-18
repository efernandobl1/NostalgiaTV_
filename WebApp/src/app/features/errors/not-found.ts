import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ColorBars } from '../../shared/ui/color-bars';

/** Design: "Error 404". */
@Component({
  selector: 'app-not-found',
  imports: [RouterLink, ColorBars],
  host: { class: 'min-h-dvh flex flex-col bg-ink text-fg font-sans' },
  template: `
    <app-color-bars class="h-[38vh] min-h-50" />
    <div class="flex h-7" aria-hidden="true">
      @for (c of reverse; track $index) { <span class="flex-1" [style.background]="c"></span> }
    </div>
    <main class="flex-1 py-12 px-6 flex flex-col items-center justify-center gap-4 text-center scan-ink [--scan:0.025]">
      <span class="py-1.5 px-3 border border-edge rounded-sm font-mono text-[13px] tracking-[0.16em] text-amber">CH 404 · SIN SEÑAL</span>
      <h1 class="m-0 font-display font-bold text-[48px] max-sm:text-[34px] leading-[1.1]">Esta página salió del aire</h1>
      <p class="m-0 max-w-130 text-[15px] leading-[1.55] text-muted">La dirección que buscas no existe o fue movida. Revisa el enlace o vuelve a un canal conocido.</p>
      <div class="flex flex-wrap justify-center gap-2.5 mt-2">
        <a class="btn btn-primary min-h-12 px-5.5 rounded-lg text-[15px]" routerLink="/admin">Volver al resumen</a>
        <a class="btn btn-ghost min-h-12 px-5.5 rounded-lg text-[15px]" routerLink="/login">Iniciar sesión</a>
      </div>
    </main>
  `,
})
export class NotFound {
  /** Castellation strip under the bars (SMPTE "reverse blue" row). */
  readonly reverse = ['#3F4FB8', '#121210', '#B44FB0', '#121210', '#4FC2C9', '#121210', '#C9C6BC'];
}
