import { Component, computed, DestroyRef, effect, ElementRef, inject, input, numberAttribute, signal, untracked, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Api, errorMessage } from '../../../core/api/api';
import { PublicEpisode, PublicSeriesDetail } from '../../../core/api/models';
import { episodeCode, playTime, randomEpisode } from '../../../core/data/public-data';
import { PlayerPrefs } from '../../../core/player-prefs';
import { Session } from '../../../core/session';
import { CrtSettings } from '../../../shared/ui/crt-settings';
import { OnDemand, VideoScreen } from '../../../shared/ui/video-screen';

/** Seconds skipped by the −10 s / +10 s buttons and the arrow keys. */
const SKIP = 10;
/** In fullscreen the controls fade out after this long without mouse, touch or key activity. */
const HIDE_AFTER_MS = 3000;

export type PlayerShortcut = 'toggle' | 'back' | 'forward' | 'fullscreen';

/**
 * Player action for a key press: space plays or pauses, ←/→ skip 10 s, F toggles fullscreen. Keys typed in form fields
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
    case 'f': case 'F': return 'fullscreen';
    default: return null;
  }
}

/** On-demand playback of one episode, resuming where the viewer left it. */
@Component({
  selector: 'app-episode',
  imports: [RouterLink, VideoScreen, CrtSettings],
  host: { class: 'flex-1 flex flex-col', '(document:keydown)': 'onKey($event)', '(document:fullscreenchange)': 'syncFullscreen()' },
  template: `
    <main class="w-full max-w-300 mx-auto pt-6 px-10 max-md:px-4 max-md:pt-3 pb-16 flex flex-col gap-4.5">
      <a class="self-start text-[14px]" [routerLink]="['/series', id()]">‹ {{ series()?.name ?? 'Volver a la serie' }}</a>
      @if (error()) {
        <div class="p-10 border border-dashed border-edge rounded-2xl text-center text-muted" role="alert">{{ error() }}</div>
      } @else {
        <div #box [class]="full()
               ? 'fixed inset-0 z-50 bg-black text-fg' + (chrome() ? '' : ' cursor-none')
               : 'p-3.5 max-md:p-0 rounded-[22px] max-md:rounded-none bg-panel-2 max-md:bg-transparent border border-line max-md:border-0'"
             (mousemove)="wake()" (touchstart)="wake()">
          <div [class]="full() ? 'absolute inset-0 tv-screen [--screen-edge:#000]' : 'relative aspect-video w-full rounded-[18px] max-md:rounded-xl overflow-hidden tv-screen [--screen-edge:#0B0B09]'">
            @if (playing(); as p) { <app-video-screen [episode]="p" (finished)="next()" /> }
          </div>
          @if (full() && episode(); as e) {
            <div class="absolute top-0 left-0 right-0 pt-6 px-8 max-md:pt-3 max-md:px-4 pb-16 flex flex-col gap-1 bg-[linear-gradient(180deg,rgba(0,0,0,0.8),rgba(0,0,0,0))] pointer-events-none transition-opacity duration-300"
                 [class.opacity-0]="!chrome()">
              <span class="font-mono text-[13px] text-amber">{{ series()?.name }} · {{ code() }}</span>
              <span class="font-display font-bold text-[26px] max-md:text-[20px]">{{ e.title }}</span>
            </div>
          }
          <div [class]="full()
                 ? 'absolute left-0 right-0 bottom-0 pt-20 px-6 pb-5 max-md:px-3 max-md:pb-3 bg-[linear-gradient(0deg,rgba(0,0,0,0.88)_35%,rgba(0,0,0,0))] transition-opacity duration-300' + (chrome() ? '' : ' opacity-0 pointer-events-none')
                 : ''">
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
              <button class="pill px-3.5 text-[13px]" type="button" [class.pill-primary]="player.random()" [attr.aria-pressed]="player.random()"
                      (click)="player.toggleRandom()" title="Al terminar, sigue con un episodio al azar de la serie">Aleatorio</button>
              <span class="flex-1"></span>
              <button class="pill w-11 px-0" type="button" (click)="player.toggleMute()" [attr.aria-label]="player.muteLabel()" [attr.aria-pressed]="player.muted()">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9z"></path><path [attr.d]="player.muteIcon()"></path></svg>
              </button>
              <label class="flex items-center gap-2 text-[13px] text-muted max-md:hidden">Volumen
                <input class="w-30 accent-amber" type="range" min="0" max="100" [value]="player.muted() ? 0 : player.volume()" (input)="player.setVolume(+$any($event.target).value)">
              </label>
              <app-crt-settings [(open)]="crtOpen" />
              <button class="pill w-11 px-0" type="button" (click)="toggleFullscreen()" [attr.aria-label]="full() ? 'Salir de pantalla completa' : 'Pantalla completa'"
                      [title]="full() ? 'Salir de pantalla completa (F)' : 'Pantalla completa (F)'">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                  <path [attr.d]="full() ? 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5' : 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5'"></path>
                </svg>
              </button>
            </div>
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
  private readonly playerBox = viewChild<ElementRef<HTMLElement>>('box');
  protected readonly skip = SKIP;
  protected readonly time = playTime;
  readonly position = computed(() => this.screen()?.currentTime() ?? 0);
  readonly length = computed(() => this.screen()?.duration() ?? 0);
  readonly paused = computed(() => this.screen()?.paused() ?? true);

  /** The player fills the screen: browser fullscreen, or a fixed overlay where the Fullscreen API is missing (iPhone). */
  readonly full = signal(false);
  /** Controls shown over the video in fullscreen; they fade out while it plays untouched. */
  readonly chrome = signal(true);
  readonly crtOpen = signal(false);
  private hideTimer?: ReturnType<typeof setTimeout>;

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
    // Pausing or opening the CRT panel brings the fullscreen controls back and keeps them up.
    effect(() => { if (this.paused() || this.crtOpen()) untracked(() => this.wake()); });
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.hideTimer);
      if (document.fullscreenElement && document.fullscreenElement === this.playerBox()?.nativeElement) document.exitFullscreen().catch(() => undefined);
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
    // Without browser fullscreen, Escape leaves the overlay (an open CRT panel takes Escape first).
    if (e.key === 'Escape' && this.full() && !document.fullscreenElement) { e.preventDefault(); this.exitFullscreen(); return; }
    const screen = this.screen();
    const action = screen && playerShortcut(e);
    if (!screen || !action) return;
    e.preventDefault();
    this.wake();
    if (action === 'fullscreen') this.toggleFullscreen();
    else if (action === 'toggle') screen.togglePlay();
    else screen.seekBy(action === 'back' ? -SKIP : SKIP);
  }

  /** Browser fullscreen of the player with its controls overlaid; a fixed overlay when the browser refuses or lacks it. */
  toggleFullscreen(): void {
    if (this.full()) { this.exitFullscreen(); return; }
    const box = this.playerBox()?.nativeElement;
    if (!box) return;
    this.full.set(true);
    this.wake();
    if (document.fullscreenEnabled && box.requestFullscreen) box.requestFullscreen({ navigationUI: 'hide' }).catch(() => undefined);
  }

  exitFullscreen(): void {
    this.full.set(false);
    this.chrome.set(true);
    clearTimeout(this.hideTimer);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
  }

  /** The browser left fullscreen on its own (Escape, system back gesture). */
  syncFullscreen(): void {
    if (this.full() && !document.fullscreenElement) this.exitFullscreen();
  }

  /** Shows the fullscreen controls and schedules hiding them again while the episode plays. */
  wake(): void {
    this.chrome.set(true);
    clearTimeout(this.hideTimer);
    if (!this.full()) return;
    this.hideTimer = setTimeout(() => {
      if (this.full() && !this.paused() && !this.crtOpen()) this.chrome.set(false);
      else this.wake();
    }, HIDE_AFTER_MS);
  }

  /** After an episode ends: the next one, or a random one in random mode. */
  next(): void {
    if (!this.player.random()) { this.step(1); return; }
    const finished = new Set(this.session.viewer()?.progress.filter(p => p.completed).map(p => p.episodeId));
    const pick = randomEpisode(this.episodes(), this.episodeId(), finished);
    if (pick) this.router.navigate(['/series', this.id(), 'episodio', pick.id], { replaceUrl: true });
  }

  step(offset: number): void {
    const next = this.episodes()[this.index() + offset];
    if (next) this.router.navigate(['/series', this.id(), 'episodio', next.id], { replaceUrl: true });
  }
}
