import { afterNextRender, Component, computed, DestroyRef, effect, inject, input, numberAttribute, signal, untracked, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { Api } from '../../core/api/api';
import { PublicEpisode, PublicSeriesDetail } from '../../core/api/models';
import { episodeCode, playTime, randomEpisode } from '../../core/data/public-data';
import { PlayerPrefs } from '../../core/player-prefs';
import { Session } from '../../core/session';
import { OnDemand, VideoScreen } from '../../shared/ui/video-screen';

const OSD_MS = 5000;
/** Seconds skipped by ◀ / ▶. */
const SKIP = 10;

/** On-demand episode on the TV. ◀ ▶ skip 10 s, OK plays or pauses, Back returns to the series. */
@Component({
  selector: 'app-tv-episode',
  imports: [VideoScreen],
  host: {
    class: 'relative block w-full h-full overflow-hidden tv-screen [--screen-edge:#050504]',
    '(document:keydown)': 'onKey($event)',
  },
  template: `
    @if (playing(); as p) { <app-video-screen [episode]="p" (finished)="next()" /> }
    <div class="absolute inset-0 outline-none" tabindex="0" data-autofocus aria-label="Episodio"></div>
    @if (error()) {
      <span class="absolute inset-0 flex items-center justify-center font-mono text-[28px] tracking-[0.12em] text-dim">{{ error() }}</span>
    }

    @if (osd() || paused()) {
      <div class="absolute top-0 left-0 right-0 pt-14 px-24 pb-24 flex flex-col gap-2 bg-[linear-gradient(180deg,rgba(5,5,4,0.9),rgba(5,5,4,0))] pointer-events-none">
        <span class="font-mono text-[24px] tracking-[0.1em] text-amber uppercase">{{ series()?.name }}{{ code() ? ' · ' + code() : '' }}</span>
        <span class="font-display font-bold text-[64px] leading-none">{{ episode()?.title ?? 'Cargando…' }}</span>
      </div>
      <div class="absolute left-0 right-0 bottom-0 pt-35 px-24 pb-14 flex flex-col gap-7 bg-[linear-gradient(0deg,rgba(5,5,4,0.96)_40%,rgba(5,5,4,0))]">
        <div class="flex items-center gap-6">
          <span class="w-14 flex-none font-mono text-[30px] text-fg" aria-hidden="true">{{ paused() ? '▶' : '❚❚' }}</span>
          <span class="font-mono text-[24px] text-muted tabular-nums">{{ time(position()) }}</span>
          <span class="flex-1 h-2.5 rounded-[5px] bg-[rgba(255,255,255,0.15)]"><span class="block h-2.5 rounded-[5px] bg-amber" [style.width.%]="pct()"></span></span>
          <span class="font-mono text-[24px] text-muted tabular-nums">{{ time(length()) }}</span>
        </div>
        <div class="flex items-center gap-12 text-[22px] text-muted">
          <span><strong class="font-mono text-fg">◀ ▶</strong> 10 segundos</span>
          <span><strong class="font-mono text-fg">OK</strong> {{ paused() ? 'Reproducir' : 'Pausa' }}</span>
          <span><strong class="font-mono text-fg">▲ ▼</strong> Episodio siguiente / anterior</span>
          <span><strong class="font-mono text-fg">ATRÁS</strong> Volver a la serie</span>
          @if (prefs.random()) { <span class="ml-auto font-mono text-amber">ALEATORIO</span> }
        </div>
      </div>
    }
  `,
})
export class TvEpisode {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly session = inject(Session);
  protected readonly prefs = inject(PlayerPrefs);

  /** Route params `:id` (series) and `:episodeId`. */
  readonly id = input(0, { transform: numberAttribute });
  readonly episodeId = input(0, { transform: numberAttribute });

  readonly series = signal<PublicSeriesDetail | null>(null);
  readonly episodes = signal<PublicEpisode[]>([]);
  readonly error = signal('');
  readonly osd = signal(true);

  private readonly screen = viewChild(VideoScreen);
  protected readonly time = playTime;
  readonly position = computed(() => this.screen()?.currentTime() ?? 0);
  readonly length = computed(() => this.screen()?.duration() ?? 0);
  readonly paused = computed(() => this.screen()?.paused() ?? true);
  readonly pct = computed(() => (this.length() ? (this.position() / this.length()) * 100 : 0));

  private readonly index = computed(() => this.episodes().findIndex(e => e.id === this.episodeId()));
  readonly episode = computed<PublicEpisode | null>(() => this.episodes()[this.index()] ?? null);
  readonly code = computed(() => { const e = this.episode(); return e ? episodeCode(e.seasonNumber, e.episodeNumber, e.episodeType, e.episodePart) : ''; });

  /** Starts where the viewer stopped, unless the episode was finished. */
  readonly playing = computed<OnDemand | null>(() => {
    const e = this.episode();
    if (!e) return null;
    const progress = untracked(() => this.session.viewer()?.progress.find(p => p.episodeId === e.id));
    return { episodeId: e.id, filePath: e.filePath, startSecond: progress && !progress.completed ? progress.currentSecond : 0 };
  });

  private timer?: ReturnType<typeof setTimeout>;

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => this.load(id));
    });
    afterNextRender(() => this.wake());
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  private async load(id: number): Promise<void> {
    if (!id) return;
    try {
      const [series, episodes] = await Promise.all([this.api.seriesDetail(id), this.api.episodes(id)]);
      this.series.set(series);
      this.episodes.set(episodes);
      this.error.set(episodes.some(e => e.id === this.episodeId()) ? '' : 'EPISODIO NO DISPONIBLE');
    } catch {
      this.error.set('SIN SEÑAL');
    }
  }

  onKey(e: KeyboardEvent): void {
    const screen = this.screen();
    switch (e.key) {
      case 'ArrowLeft': screen?.seekBy(-SKIP); break;
      case 'ArrowRight': screen?.seekBy(SKIP); break;
      case 'Enter': case ' ': case 'MediaPlayPause': screen?.togglePlay(); break;
      case 'ArrowUp': this.step(1); break;
      case 'ArrowDown': this.step(-1); break;
      default: this.wake(); return;
    }
    e.preventDefault();
    this.wake();
  }

  /** After an episode ends: the next one, or a random one in random mode. */
  next(): void {
    if (!this.prefs.random()) { this.step(1); return; }
    const finished = new Set(this.session.viewer()?.progress.filter(p => p.completed).map(p => p.episodeId));
    const pick = randomEpisode(this.episodes(), this.episodeId(), finished);
    if (pick) this.router.navigate(['/tv/series', this.id(), 'episodio', pick.id], { replaceUrl: true });
  }

  step(offset: number): void {
    const next = this.episodes()[this.index() + offset];
    if (next) this.router.navigate(['/tv/series', this.id(), 'episodio', next.id], { replaceUrl: true });
  }

  private wake(): void {
    this.osd.set(true);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.osd.set(false), OSD_MS);
  }
}
