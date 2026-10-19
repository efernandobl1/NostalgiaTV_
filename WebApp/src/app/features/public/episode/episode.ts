import { Component, computed, effect, inject, input, numberAttribute, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Api, errorMessage } from '../../../core/api/api';
import { PublicEpisode, PublicSeriesDetail } from '../../../core/api/models';
import { episodeCode } from '../../../core/data/public-data';
import { PlayerPrefs } from '../../../core/player-prefs';
import { Session } from '../../../core/session';
import { OnDemand, VideoScreen } from '../../../shared/ui/video-screen';

/** On-demand playback of one episode, resuming where the viewer left it. */
@Component({
  selector: 'app-episode',
  imports: [RouterLink, VideoScreen],
  host: { class: 'flex-1 flex flex-col' },
  template: `
    <main class="w-full max-w-300 mx-auto pt-6 px-10 max-md:px-4 max-md:pt-3 pb-16 flex flex-col gap-4.5">
      <a class="self-start text-[14px]" [routerLink]="['/series', id()]">‹ {{ series()?.name ?? 'Volver a la serie' }}</a>
      @if (error()) {
        <div class="p-10 border border-dashed border-edge rounded-2xl text-center text-muted" role="alert">{{ error() }}</div>
      } @else {
        <div class="p-3.5 max-md:p-0 rounded-[22px] max-md:rounded-none bg-panel-2 max-md:bg-transparent border border-line max-md:border-0">
          <div class="relative aspect-video w-full rounded-[18px] max-md:rounded-xl overflow-hidden tv-screen [--screen-edge:#0B0B09]">
            @if (playing(); as p) { <app-video-screen [episode]="p" (finished)="step(1)" /> }
          </div>
          <div class="flex flex-wrap items-center gap-2 pt-3.5 px-1">
            <button class="pill px-3.5 text-[13px]" type="button" [disabled]="!hasPrevious()" (click)="step(-1)">‹ Anterior</button>
            <button class="pill px-3.5 text-[13px]" type="button" [disabled]="!hasNext()" (click)="step(1)">Siguiente ›</button>
            <span class="flex-1"></span>
            <button class="pill w-11 px-0" type="button" (click)="player.toggleMute()" [attr.aria-label]="player.muteLabel()" [attr.aria-pressed]="player.muted()">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9z"></path><path [attr.d]="player.muteIcon()"></path></svg>
            </button>
            <label class="flex items-center gap-2 text-[13px] text-muted max-md:hidden">Volumen
              <input class="w-30 accent-amber" type="range" min="0" max="100" [value]="player.muted() ? 0 : player.volume()" (input)="player.setVolume(+$any($event.target).value)">
            </label>
          </div>
        </div>
        @if (episode(); as e) {
          <div class="flex flex-col gap-1.5">
            <span class="font-mono text-[13px] text-amber">{{ code() }}</span>
            <h1 class="m-0 font-display font-bold text-[34px] max-md:text-[26px]">{{ e.title }}</h1>
            <span class="text-[14px] text-muted">Tu avance se guarda en este dispositivo{{ session.signedIn() ? ' y en tu cuenta' : '' }}.</span>
          </div>
        }
      }
    </main>
  `,
})
export class Episode {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  protected readonly session = inject(Session);
  protected readonly player = inject(PlayerPrefs);

  /** Route params `:id` (series) and `:episodeId`. */
  readonly id = input(0, { transform: numberAttribute });
  readonly episodeId = input(0, { transform: numberAttribute });

  readonly series = signal<PublicSeriesDetail | null>(null);
  readonly episodes = signal<PublicEpisode[]>([]);
  readonly error = signal('');

  private readonly position = computed(() => this.episodes().findIndex(e => e.id === this.episodeId()));
  readonly episode = computed(() => this.episodes()[this.position()] ?? null);
  readonly code = computed(() => { const e = this.episode(); return e ? episodeCode(e.seasonNumber, e.episodeNumber, e.episodeType, e.episodePart) : ''; });
  readonly hasPrevious = computed(() => this.position() > 0);
  readonly hasNext = computed(() => this.position() >= 0 && this.position() < this.episodes().length - 1);

  /** Starts where the viewer stopped, unless the episode was finished. */
  readonly playing = computed<OnDemand | null>(() => {
    const e = this.episode();
    if (!e) return null;
    const progress = untracked(() => this.session.viewer()?.progress.find(p => p.episodeId === e.id));
    return { episodeId: e.id, filePath: e.filePath, startSecond: progress && !progress.completed ? progress.currentSecond : 0 };
  });

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => this.load(id));
    });
  }

  private async load(id: number): Promise<void> {
    if (!id) return;
    try {
      const [series, episodes] = await Promise.all([this.api.seriesDetail(id), this.api.episodes(id)]);
      this.series.set(series);
      this.episodes.set(episodes);
      if (!episodes.some(e => e.id === this.episodeId())) this.error.set('Este episodio no está disponible.');
    } catch (error) {
      this.error.set(errorMessage(error, 'No se pudo cargar el episodio.'));
    }
  }

  step(offset: number): void {
    const next = this.episodes()[this.position() + offset];
    if (next) this.router.navigate(['/series', this.id(), 'episodio', next.id], { replaceUrl: true });
  }
}
