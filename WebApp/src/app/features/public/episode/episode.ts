import { Component, computed, effect, inject, input, numberAttribute, signal, untracked, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Api, errorMessage } from '../../../core/api/api';
import { PublicEpisode, PublicSeriesDetail } from '../../../core/api/models';
import { episodeCode, playTime } from '../../../core/data/public-data';
import { PlayerPrefs } from '../../../core/player-prefs';
import { Session } from '../../../core/session';
import { OnDemand, VideoScreen } from '../../../shared/ui/video-screen';

/** Seconds skipped by the −10 s / +10 s buttons and the arrow keys. */
const SKIP = 10;

export type PlayerShortcut = 'toggle' | 'back' | 'forward';

/**
 * Player action for a key press: space plays or pauses, ←/→ skip 10 s. Keys typed in form fields
 * (the seek and volume sliders use the arrows) and space on a focused button or link keep their own meaning.
 */
export function playerShortcut(e: Pick<KeyboardEvent, 'key' | 'altKey' | 'ctrlKey' | 'metaKey' | 'target'>): PlayerShortcut | null {
  if (e.altKey || e.ctrlKey || e.metaKey) return null;
  const target = e.target as HTMLElement | null;
  if (target?.closest?.('input, textarea, select, [contenteditable]')) return null;
  switch (e.key) {
    case ' ': return target?.closest?.('button, a') ? null : 'toggle';
    case 'ArrowLeft': return 'back';
    case 'ArrowRight': return 'forward';
    default: return null;
  }
}

/** On-demand playback of one episode, resuming where the viewer left it. */
@Component({
  selector: 'app-episode',
  imports: [RouterLink, VideoScreen],
  host: { class: 'flex-1 flex flex-col', '(document:keydown)': 'onKey($event)' },
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
          <div class="flex items-center gap-3 pt-3.5 px-1 font-mono text-[12px] text-muted tabular-nums">
            <span>{{ time(position()) }}</span>
            <input class="flex-1 min-w-0 accent-amber" type="range" min="0" step="1" aria-label="Posición del episodio"
                   [max]="length()" [value]="position()" [disabled]="!length()" [attr.aria-valuetext]="time(position()) + ' de ' + time(length())"
                   (input)="screen()?.seekTo(+$any($event.target).value)">
            <span>{{ time(length()) }}</span>
          </div>
          <div class="flex flex-wrap items-center gap-2 pt-2.5 px-1">
            <button class="pill px-3.5 text-[13px]" type="button" [disabled]="!hasPrevious()" (click)="step(-1)">‹ Anterior</button>
            <button class="pill px-3 text-[13px]" type="button" [disabled]="!length()" (click)="screen()?.seekBy(-skip)" aria-label="Retroceder 10 segundos">−10 s</button>
            <button class="pill w-11 px-0" type="button" [disabled]="!length()" (click)="screen()?.togglePlay()" [attr.aria-label]="paused() ? 'Reproducir' : 'Pausar'">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                @if (paused()) { <path d="M7 5l12 7-12 7z"></path> } @else { <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"></path> }
              </svg>
            </button>
            <button class="pill px-3 text-[13px]" type="button" [disabled]="!length()" (click)="screen()?.seekBy(skip)" aria-label="Adelantar 10 segundos">+10 s</button>
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

  protected readonly screen = viewChild(VideoScreen);
  protected readonly skip = SKIP;
  protected readonly time = playTime;
  readonly position = computed(() => this.screen()?.currentTime() ?? 0);
  readonly length = computed(() => this.screen()?.duration() ?? 0);
  readonly paused = computed(() => this.screen()?.paused() ?? true);

  private readonly index = computed(() => this.episodes().findIndex(e => e.id === this.episodeId()));
  readonly episode = computed(() => this.episodes()[this.index()] ?? null);
  readonly code = computed(() => { const e = this.episode(); return e ? episodeCode(e.seasonNumber, e.episodeNumber, e.episodeType, e.episodePart) : ''; });
  readonly hasPrevious = computed(() => this.index() > 0);
  readonly hasNext = computed(() => this.index() >= 0 && this.index() < this.episodes().length - 1);

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

  onKey(e: KeyboardEvent): void {
    const screen = this.screen();
    const action = screen && playerShortcut(e);
    if (!screen || !action) return;
    e.preventDefault();
    if (action === 'toggle') screen.togglePlay();
    else screen.seekBy(action === 'back' ? -SKIP : SKIP);
  }

  step(offset: number): void {
    const next = this.episodes()[this.index() + offset];
    if (next) this.router.navigate(['/series', this.id(), 'episodio', next.id], { replaceUrl: true });
  }
}
