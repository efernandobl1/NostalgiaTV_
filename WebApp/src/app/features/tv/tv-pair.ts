import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { LogoMark } from '../../shared/ui/logo-mark';

const CODE_SECONDS = 10 * 60;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
/** Placeholder 9×9 QR matrix from the design. */
const QR = '111101111100100001101111101001010100111000111010101001101111101100100001111101111';

function randomCode(): string {
  const pick = () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return `${Array.from({ length: 4 }, pick).join('')}-${Array.from({ length: 4 }, pick).join('')}`;
}

/** Design: "Android TV · Vincular dispositivo". The code counts down and can be renewed. */
@Component({
  selector: 'app-tv-pair',
  imports: [LogoMark],
  host: { class: 'w-full h-full overflow-hidden py-18 px-30 flex flex-col scan-ink-2 [--scan:0.02]' },
  template: `
    <span class="flex items-center gap-3.5">
      <app-logo-mark [size]="48" [dots]="false" />
      <span class="font-display font-bold text-[30px] tracking-[0.08em]">NOSTALGIA TV</span>
    </span>

    <div class="flex-1 flex items-center gap-30">
      <div class="flex-1 flex flex-col gap-10">
        <h1 class="m-0 font-display font-bold text-[72px] leading-[1.05]">Vincula este televisor</h1>
        <ol class="m-0 p-0 list-none flex flex-col gap-6 text-[32px] leading-[1.35]">
          <li class="flex gap-5"><span class="font-display font-bold text-amber">1</span><span>En tu teléfono o computadora abre <strong class="font-mono font-medium text-amber">{{ host }}/vincular</strong></span></li>
          <li class="flex gap-5"><span class="font-display font-bold text-amber">2</span><span>Inicia sesión y escribe este código:</span></li>
        </ol>
        <div class="flex items-center gap-7">
          <span class="py-7 px-11 rounded-[20px] border-[3px] border-amber font-mono font-medium text-[88px] tracking-[0.16em] text-fg bg-panel-2" aria-live="polite">{{ code() }}</span>
        </div>
        <div class="flex items-center gap-4.5 text-[26px] text-muted">
          @if (left() > 0) {
            <span class="w-3.5 h-3.5 rounded-full bg-amber shadow-[0_0_0_6px_rgba(255,181,71,0.2)] animate-pulse" aria-hidden="true"></span>
            Esperando confirmación · el código vence en {{ clock() }}
          } @else {
            <span class="w-3.5 h-3.5 rounded-full bg-live" aria-hidden="true"></span>
            El código venció · pide uno nuevo
          }
        </div>
      </div>

      <div class="w-105 flex-none flex flex-col items-center gap-6">
        <div class="w-90 h-90 p-7 rounded-3xl bg-fg grid grid-cols-9 gap-1.5" aria-hidden="true">
          @for (q of qr; track $index) { <span class="rounded-[3px]" [class.bg-ink-2]="q === '1'"></span> }
        </div>
        <span class="text-[24px] text-muted text-center">O escanea con la cámara del teléfono</span>
        <button class="tv-btn tv-focus h-18 px-9 font-semibold" type="button" data-autofocus (click)="renew()">Obtener otro código</button>
      </div>
    </div>
  `,
})
export class TvPair {
  readonly host = window.location.host || 'TU-SERVIDOR';
  readonly qr = QR.split('');
  readonly code = signal('K7Q2-M9XD');
  readonly left = signal(9 * 60 + 41);
  readonly clock = computed(() => `${Math.floor(this.left() / 60)}:${String(this.left() % 60).padStart(2, '0')}`);

  constructor() {
    const id = setInterval(() => this.left.update(s => Math.max(0, s - 1)), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(id));
  }

  renew(): void {
    this.code.set(randomCode());
    this.left.set(CODE_SECONDS);
  }
}
