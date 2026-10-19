import { Component, computed, effect, inject, input, numberAttribute, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api, mediaUrl } from '../../core/api/api';
import { PublicEpisode, PublicSeriesDetail } from '../../core/api/models';
import { channelNumber, episodeCode, playTime, years } from '../../core/data/public-data';
import { Session } from '../../core/session';

/** Design: "Android TV · Detalle de serie". */
@Component({
  selector: 'app-tv-series',
  imports: [RouterLink],
  host: { class: 'relative w-full h-full overflow-hidden pt-16 px-24 pb-14 flex flex-col gap-9 bg-ink-2' },
  template: `
    <div class="absolute top-0 right-0 w-275 h-170 bg-[repeating-linear-gradient(0deg,rgba(255,255,255,0.04)_0_1px,transparent_1px_3px),radial-gradient(ellipse_at_65%_40%,#2C2A20_0%,#0B0B09_70%)]" aria-hidden="true">
      @if (logo(); as l) { <img class="absolute inset-0 m-auto max-w-[45%] max-h-[55%] object-contain opacity-35" [src]="l" alt=""> }
    </div>

    <a class="tv-focus relative self-start rounded-lg font-mono text-[22px] text-muted hover:text-fg no-underline" routerLink="/tv/series">◀ Series</a>

    <section class="relative w-215 flex flex-col gap-4.5">
      <span class="font-mono text-[22px] tracking-[0.1em] text-amber">{{ meta() }}</span>
      <h1 class="m-0 font-display font-bold text-[96px] leading-none">{{ detail()?.name ?? 'Cargando…' }}</h1>
      <span class="text-[24px] text-fg-2">{{ (detail()?.categories ?? []).join(' · ') }}</span>
      <p class="m-0 text-[26px] leading-normal text-fg-2 line-clamp-3">{{ detail()?.description ?? '' }}</p>
      <div class="flex gap-5 mt-2.5">
        @if (onAir(); as ch) {
          <a class="tv-btn tv-btn-primary tv-focus" data-autofocus [routerLink]="['/tv/ver', ch.channelId]">▶&nbsp; Sintonizar CH {{ num(ch.channelId) }} (al aire)</a>
        }
        <a class="tv-btn tv-focus" [attr.data-autofocus]="onAir() ? null : ''" routerLink="/tv/guia">Próximas emisiones</a>
      </div>
    </section>

    <section class="relative mt-auto flex flex-col gap-5">
      <div class="flex gap-3">
        @for (t of seasons(); track t; let i = $index) {
          <button type="button" class="tv-focus h-15 px-7 border-0 rounded-[30px] font-semibold text-[22px] font-sans bg-transparent text-muted aria-pressed:bg-fg aria-pressed:text-ink-2"
                  [attr.aria-pressed]="i === season()" (click)="season.set(i)">{{ t }}</button>
        }
      </div>
      <div class="flex gap-7 overflow-x-auto no-scrollbar -m-3 p-3" data-tv-scroll>
        @for (e of episodes(); track e.id) {
          <div class="w-81 flex-none flex flex-col gap-2.5 rounded-xl text-fg">
            <span class="relative block aspect-video rounded-xl overflow-hidden scan-raised-2">
              <span class="absolute left-3 top-2.5 font-mono text-[18px] text-amber">{{ e.num }}</span>
              <span class="absolute left-0 right-0 bottom-0 h-1.5 bg-[rgba(255,255,255,0.1)]"><span class="block h-1.5 bg-amber" [style.width.%]="e.pct"></span></span>
            </span>
            <span class="text-[22px] font-semibold truncate">{{ e.title }}</span>
            <span class="font-mono text-[17px]" [style.color]="e.color">{{ e.state }}</span>
          </div>
        } @empty {
          <span class="text-[22px] text-muted">Sin episodios disponibles.</span>
        }
      </div>
    </section>
  `,
})
export class TvSeries {
  private readonly api = inject(Api);
  private readonly session = inject(Session);
  readonly id = input(0, { transform: numberAttribute });
  readonly detail = signal<PublicSeriesDetail | null>(null);
  readonly all = signal<PublicEpisode[]>([]);
  readonly season = signal(0);
  readonly num = channelNumber;

  readonly logo = computed(() => mediaUrl(this.detail()?.logoPath));
  readonly onAir = computed(() => this.detail()?.onAir[0] ?? null);
  readonly meta = computed(() => {
    const d = this.detail();
    if (!d) return '';
    const count = d.seasons.filter(s => s > 0).length;
    return [years(d.startDate, d.endDate).replace('–', ' – '), `${count} ${count === 1 ? 'TEMPORADA' : 'TEMPORADAS'}`, d.rating ? `★ ${d.rating.toFixed(1)}` : '']
      .filter(Boolean).join(' · ');
  });
  readonly seasonNumbers = computed(() => [...new Set(this.all().map(e => e.seasonNumber))].sort((a, b) => (a === 0 ? -1 : b === 0 ? 1 : a - b)));
  readonly seasons = computed(() => this.seasonNumbers().map(n => (n === 0 ? 'Especiales' : `T${n}`)));
  readonly episodes = computed(() => {
    const progress = new Map((this.session.viewer()?.progress ?? []).map(p => [p.episodeId, p]));
    const number = this.seasonNumbers()[this.season()];
    return this.all().filter(e => e.seasonNumber === number).map(e => {
      const p = progress.get(e.id);
      const started = !!p && !p.completed && p.currentSecond > 0;
      return {
        id: e.id, num: e.seasonNumber === 0 ? e.episodeType.toUpperCase() : `E${e.episodeNumber}${e.episodePart ?? ''}`, title: e.title, pct: p?.completed ? 100 : 0,
        state: p?.completed ? '✓ VISTO' : started ? `EN CURSO · ${playTime(p!.currentSecond)}` : episodeCode(e.seasonNumber, e.episodeNumber, e.episodeType, e.episodePart),
        color: p?.completed ? '#8BE08F' : started ? '#FFB547' : '#A29E91',
      };
    });
  });

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(async () => {
        if (!id) return;
        try {
          const [detail, episodes] = await Promise.all([this.api.seriesDetail(id), this.api.episodes(id)]);
          this.detail.set(detail);
          this.all.set(episodes);
          this.season.set(Math.max(0, this.seasonNumbers().findIndex(n => n > 0)));
        } catch { this.detail.set(null); }
      });
    });
  }
}
