import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Design: "Error 500". */
@Component({
  selector: 'app-server-error',
  imports: [RouterLink],
  host: { class: 'min-h-dvh py-12 px-6 flex items-center justify-center scan-ink [--scan:0.03] text-fg font-sans' },
  template: `
    <div class="w-full max-w-190 flex flex-col gap-7">
      <div class="p-10 max-sm:p-6 border-2 border-edge rounded-3xl flex flex-col items-center gap-4.5 text-center bg-rail">
        <span class="py-2 px-4 rounded-sm font-mono text-[14px] tracking-[0.18em] text-on-amber bg-amber">ERROR 500</span>
        <h1 class="m-0 font-display font-bold text-[44px] max-sm:text-[28px] leading-[1.1] tracking-[0.02em]">ESTAMOS EXPERIMENTANDO<br>DIFICULTADES TÉCNICAS</h1>
        <p class="m-0 max-w-130 text-[15px] leading-[1.55] text-muted">No ajuste su televisor. Algo falló en el servidor y ya quedó registrado. Intenta de nuevo en unos segundos.</p>
        <span class="font-mono text-[12px] text-dim">Referencia: {{ reference }} · 2026-10-17 20:32 UTC</span>
      </div>
      <div class="flex flex-wrap justify-center gap-2.5">
        <button class="btn btn-primary min-h-12 px-5.5 rounded-lg text-[15px]" type="button" (click)="retry()">Reintentar</button>
        <a class="btn btn-ghost min-h-12 px-5.5 rounded-lg text-[15px]" routerLink="/admin">Volver al resumen</a>
        <button class="btn btn-ghost min-h-12 px-5.5 rounded-lg text-[15px]" type="button" (click)="copy()">{{ copied() ? 'Referencia copiada' : 'Copiar referencia' }}</button>
      </div>
    </div>
  `,
})
export class ServerError {
  readonly reference = '0HN7Q2K9MS4LT';
  readonly copied = signal(false);

  retry(): void { history.length > 1 ? history.back() : location.reload(); }

  copy(): void {
    navigator.clipboard?.writeText(this.reference).then(() => this.copied.set(true)).catch(() => undefined);
  }
}
