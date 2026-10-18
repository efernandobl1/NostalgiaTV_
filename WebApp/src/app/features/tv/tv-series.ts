import { Component, computed, input, numberAttribute, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CHANNELS } from '../../core/data/channels';
import { seriesById } from '../../core/data/series';

const EPISODES: [string, string, number][] = [
  ['E12', 'La batalla en Namek comienza', 100], ['E13', 'La llegada de Freezer', 100],
  ['E14', 'El poder oculto de Gohan', 64], ['E15', 'Vegeta contra Zarbon', 0], ['E16', 'Las esferas de Namek', 0],
];

/** Design: "Android TV · Detalle de serie". */
@Component({
  selector: 'app-tv-series',
  imports: [RouterLink],
  host: { class: 'relative w-full h-full overflow-hidden pt-16 px-24 pb-14 flex flex-col gap-9 bg-ink-2' },
  template: `
    <div class="absolute top-0 right-0 w-275 h-170 bg-[repeating-linear-gradient(0deg,rgba(255,255,255,0.04)_0_1px,transparent_1px_3px),radial-gradient(ellipse_at_65%_40%,#2C2A20_0%,#0B0B09_70%)]" aria-hidden="true">
      <span class="absolute inset-0 flex items-center justify-center font-mono text-[18px] tracking-[0.14em] text-faint">[ IMAGEN DE FONDO DE LA SERIE ]</span>
    </div>

    <a class="tv-focus relative self-start rounded-lg font-mono text-[22px] text-muted hover:text-fg no-underline" routerLink="/tv/series">◀ Series</a>

    <section class="relative w-215 flex flex-col gap-4.5">
      <span class="font-mono text-[22px] tracking-[0.1em] text-amber">{{ series().years.replace('–', ' – ') }} · {{ series().seasons }} TEMPORADAS · ★ {{ series().rating }}</span>
      <h1 class="m-0 font-display font-bold text-[96px] leading-none">{{ series().name }}</h1>
      <span class="text-[24px] text-fg-2">{{ series().tags.join(' · ') }}</span>
      <p class="m-0 text-[26px] leading-normal text-fg-2">{{ series().synopsis }}</p>
      <div class="flex gap-5 mt-2.5">
        <a class="tv-btn tv-btn-primary tv-focus" data-autofocus [routerLink]="['/tv/ver', channel().id]">▶&nbsp; Continuar T2 · E14</a>
        <a class="tv-btn tv-focus" [routerLink]="['/tv/ver', channel().id]">Sintonizar {{ channel().code }} (al aire)</a>
        <a class="tv-btn tv-focus" routerLink="/tv/guia">Próximas emisiones</a>
      </div>
    </section>

    <section class="relative mt-auto flex flex-col gap-5">
      <div class="flex gap-3">
        @for (t of seasons; track t; let i = $index) {
          <button type="button" class="tv-focus h-15 px-7 border-0 rounded-[30px] font-semibold text-[22px] font-sans bg-transparent text-muted aria-pressed:bg-fg aria-pressed:text-ink-2"
                  [attr.aria-pressed]="i === season()" (click)="season.set(i)">{{ t }}</button>
        }
      </div>
      <div class="flex gap-7">
        @for (e of episodes; track e.num) {
          <a class="tv-focus [--ring:#FFB547] w-81 flex-none flex flex-col gap-2.5 rounded-xl text-fg hover:text-fg no-underline" [routerLink]="['/tv/ver', channel().id]">
            <span class="relative block aspect-video rounded-xl overflow-hidden scan-raised-2">
              <span class="absolute left-3 top-2.5 font-mono text-[18px] text-amber">{{ e.num }}</span>
              <span class="absolute left-0 right-0 bottom-0 h-1.5 bg-[rgba(255,255,255,0.1)]"><span class="block h-1.5 bg-amber" [style.width.%]="e.pct"></span></span>
            </span>
            <span class="text-[22px] font-semibold truncate">{{ e.title }}</span>
            <span class="font-mono text-[17px]" [style.color]="e.color">{{ e.state }}</span>
          </a>
        }
      </div>
    </section>
  `,
})
export class TvSeries {
  readonly id = input(1, { transform: numberAttribute });
  readonly series = computed(() => seriesById(this.id()));
  readonly channel = computed(() => CHANNELS.find(c => c.num === this.series().ch) ?? CHANNELS[0]);
  readonly seasons = ['Especiales', 'T1', 'T2', 'T3', 'T4'];
  readonly season = signal(2);
  readonly episodes = EPISODES.map(([num, title, pct]) => ({
    num, title, pct,
    state: pct >= 100 ? '✓ VISTO' : pct > 0 ? `EN CURSO ${pct}%` : '21 MIN',
    color: pct >= 100 ? '#8BE08F' : pct > 0 ? '#FFB547' : '#A29E91',
  }));
}
