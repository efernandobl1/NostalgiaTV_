import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { episodeCode, hhmm, lastChannel, LiveChannel, PublicData } from '../../core/data/public-data';
import { TvPrefs } from '../../core/tv-prefs';
import { TvHeader } from './tv-header';

const FILTERS: [string, (c: LiveChannel) => boolean][] = [
  ['Todos', () => true],
  ['Anime', c => c.tags.some(t => /anime/i.test(t))],
  ['Caricaturas', c => c.tags.some(t => /caricatura/i.test(t))],
  ['Solo al aire', c => c.on],
];

/** Design: "Android TV · Canales (inicio)". The hero follows the focused channel card. */
@Component({
  selector: 'app-tv-home',
  imports: [RouterLink, TvHeader],
  host: { class: 'relative w-full h-full overflow-hidden py-12 px-24 flex flex-col gap-10 scan-ink-2 [--scan:0.02]' },
  template: `
    <div class="absolute top-0 right-0 w-275 h-160 bg-[repeating-linear-gradient(0deg,rgba(255,255,255,0.04)_0_1px,transparent_1px_3px),radial-gradient(ellipse_at_60%_40%,#2C2A20_0%,#0B0B09_70%)]" aria-hidden="true">
      @if (heroLogo(); as logo) { <img class="absolute inset-0 m-auto max-w-[40%] max-h-[50%] object-contain opacity-40" [src]="logo" alt=""> }
    </div>

    <app-tv-header active="channels" />

    @if (hero(); as hero) {
    <section class="relative w-205 flex flex-col gap-4.5 mt-10">
      <span class="flex items-center gap-4">
        @if (hero.on) {
          <span class="py-2 px-3.5 rounded-md font-mono text-[20px] tracking-[0.12em] text-on-live bg-live">● EN VIVO</span>
        } @else {
          <span class="py-2 px-3.5 rounded-md font-mono text-[20px] tracking-[0.12em] text-fg bg-edge">SIN SEÑAL</span>
        }
        <span class="font-mono text-[22px] text-amber uppercase">CH {{ hero.num }} · {{ hero.name }}</span>
      </span>
      <h1 class="m-0 font-display font-bold text-[88px] leading-none">{{ hero.now }}</h1>
      <span class="text-[28px] text-fg-2">{{ heroDetail() }}</span>
      <div class="flex gap-5 mt-4">
        <a class="tv-btn tv-btn-primary tv-focus h-19 px-10 text-[28px]" data-autofocus [routerLink]="['/tv/ver', hero.id]">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4l13 8-13 8z"></path></svg>
          Ver en vivo
        </a>
        <a class="tv-btn tv-focus h-19 px-10 text-[28px] font-semibold" routerLink="/tv/guia">Guía</a>
      </div>
    </section>
    } @else {
      <section class="relative w-205 flex flex-col gap-4.5 mt-10">
        <h1 class="m-0 font-display font-bold text-[64px] leading-none">{{ data.loading() ? 'Sintonizando…' : 'Sin canales' }}</h1>
        <span class="text-[28px] text-fg-2">{{ data.error() || 'Todavía no hay canales con programación.' }}</span>
      </section>
    }

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
        } @empty {
          <span class="text-[24px] text-muted">Ningún canal coincide con el filtro.</span>
        }
      </div>
    </section>
  `,
})
export class TvHome {
  readonly filters = FILTERS.map(([label]) => label);
  readonly filter = signal(0);
  protected readonly data = inject(PublicData);
  readonly channels = computed(() => this.data.channels().filter(FILTERS[this.filter()][1]));
  readonly heroId = signal(lastChannel() ?? 0);
  readonly hero = computed(() => this.data.channel(this.heroId()) ?? this.data.onAir()[0] ?? this.data.channels()[0] ?? null);
  readonly heroLogo = computed(() => this.hero()?.logo ?? null);
  readonly heroDetail = computed(() => {
    const now = this.hero()?.card.now;
    if (!now) return this.hero()?.era ?? '';
    const code = episodeCode(now.seasonNumber, now.episodeNumber, null, now.episodePart);
    return [code, now.title !== now.seriesName ? now.title : '', `termina ${hhmm(now.endsAtUtc)}`].filter(Boolean).join(' · ');
  });

  constructor() {
    this.data.use();
    // "Iniciar en el último canal": only when the app opens on this screen, so coming back here stays here.
    const router = inject(Router);
    const last = lastChannel();
    const opening = !router.currentNavigation()?.previousNavigation;
    if (opening && last && inject(TvPrefs).values().lastChannel) router.navigate(['/tv/ver', last]);
  }
}
