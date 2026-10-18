import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LIVE_CHANNELS } from '../public/home/home.data';
import { ON_AIR } from '../../core/data/live';
import { TvHeader } from './tv-header';

const FILTERS: [string, (c: (typeof LIVE_CHANNELS)[number]) => boolean][] = [
  ['Todos', () => true],
  ['Anime', c => c.tags.includes('Anime')],
  ['Caricaturas', c => c.tags.includes('Caricatura')],
  ['Solo al aire', c => c.on],
];

/** Design: "Android TV · Canales (inicio)". The hero follows the focused channel card. */
@Component({
  selector: 'app-tv-home',
  imports: [RouterLink, TvHeader],
  host: { class: 'relative w-full h-full overflow-hidden py-12 px-24 flex flex-col gap-10 scan-ink-2 [--scan:0.02]' },
  template: `
    <div class="absolute top-0 right-0 w-275 h-160 bg-[repeating-linear-gradient(0deg,rgba(255,255,255,0.04)_0_1px,transparent_1px_3px),radial-gradient(ellipse_at_60%_40%,#2C2A20_0%,#0B0B09_70%)]" aria-hidden="true">
      <span class="absolute inset-0 flex items-center justify-center font-mono text-[18px] tracking-[0.14em] text-faint">[ VISTA PREVIA EN VIVO ]</span>
    </div>

    <app-tv-header active="channels" />

    <section class="relative w-205 flex flex-col gap-4.5 mt-10">
      <span class="flex items-center gap-4">
        @if (hero().on) {
          <span class="py-2 px-3.5 rounded-md font-mono text-[20px] tracking-[0.12em] text-on-live bg-live">● EN VIVO</span>
        } @else {
          <span class="py-2 px-3.5 rounded-md font-mono text-[20px] tracking-[0.12em] text-fg bg-edge">SIN SEÑAL</span>
        }
        <span class="font-mono text-[22px] text-amber uppercase">CH {{ hero().num }} · {{ hero().name }}</span>
      </span>
      <h1 class="m-0 font-display font-bold text-[88px] leading-none">{{ hero().now }}</h1>
      <span class="text-[28px] text-fg-2">{{ heroDetail() }}</span>
      <div class="flex gap-5 mt-4">
        <a class="tv-btn tv-btn-primary tv-focus h-19 px-10 text-[28px]" data-autofocus [routerLink]="['/tv/ver', hero().id]">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4l13 8-13 8z"></path></svg>
          Ver en vivo
        </a>
        <a class="tv-btn tv-focus h-19 px-10 text-[28px] font-semibold" routerLink="/tv/guia">Guía</a>
      </div>
    </section>

    <section class="relative flex flex-col gap-5 mt-auto">
      <div class="flex items-center gap-4">
        <h2 class="m-0 mr-4 font-display font-semibold text-[32px]">Canales</h2>
        @for (f of filters; track f; let i = $index) {
          <button type="button" class="tv-chip tv-focus" [attr.aria-pressed]="i === filter()" (click)="filter.set(i)">{{ f }}</button>
        }
      </div>
      <div class="flex gap-7">
        @for (c of channels(); track c.id) {
          <a class="tv-focus w-80 flex-none flex flex-col gap-3.5 p-6 rounded-[18px] bg-panel-2 border-2 border-line text-fg hover:text-fg no-underline"
             [routerLink]="['/tv/ver', c.id]" (focus)="heroId.set(c.id)">
            <span class="flex items-center gap-4">
              <span class="font-display font-bold text-[44px] text-amber">{{ c.num }}</span>
              <span class="font-semibold text-[24px]">{{ c.name }}</span>
            </span>
            <span class="text-[22px] text-fg-2 truncate">{{ c.now.replace('Los Caballeros', 'Caballeros') }}</span>
            <span class="block h-1.5 rounded-[3px] bg-[rgba(255,255,255,0.12)]"><span class="block h-1.5 rounded-[3px] bg-amber" [style.width.%]="c.pct"></span></span>
          </a>
        }
      </div>
    </section>
  `,
})
export class TvHome {
  readonly filters = FILTERS.map(([label]) => label);
  readonly filter = signal(0);
  readonly channels = computed(() => LIVE_CHANNELS.filter(FILTERS[this.filter()][1]));
  readonly heroId = signal(5);
  readonly hero = computed(() => LIVE_CHANNELS.find(c => c.id === this.heroId()) ?? LIVE_CHANNELS[0]);
  readonly heroDetail = computed(() => {
    const live = ON_AIR.find(c => c.id === this.heroId());
    return live ? `${live.detail} · termina ${live.ends}` : 'Sin era seleccionada';
  });
}
