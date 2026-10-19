import { Component, DestroyRef, ElementRef, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { Api, mediaUrl } from '../../core/api/api';
import { ChannelState } from '../../core/api/models';
import { PlayerPrefs } from '../../core/player-prefs';
import { Session } from '../../core/session';

/** An episode played on demand. */
export interface OnDemand { episodeId: number; filePath: string; startSecond: number }

/** Longest span the API accepts in one progress report. */
const REPORT_SPAN = 30;

/**
 * The `<video>` behind every screen. With `channel` it follows the live schedule (state from
 * GET /public/channels/{id}/state, refreshed when the segment ends); with `episode` it plays on demand.
 * Episode playback is reported to /viewer/progress in short continuous spans; `seekTo` closes the
 * current span before jumping so a seek never reports time the viewer skipped.
 */
@Component({
  selector: 'app-video-screen',
  host: { class: 'absolute inset-0 block' },
  template: `
    <video #video class="w-full h-full object-contain bg-black" playsinline preload="auto"
           [muted]="prefs.muted()" (timeupdate)="tick()" (play)="paused.set(false)" (pause)="paused.set(true); report()"
           (durationchange)="duration.set(finite(video.duration))" (click)="episode() && togglePlay()"
           (ended)="ended()" (error)="failed()"></video>
    @if (prefs.crt(); as crt) {
      @if (crt.enabled) {
        <div class="video-filters" aria-hidden="true" [class.curvature]="crt.curvature" [class.vignette]="crt.vignette" [class.animate]="crt.animated"
             [style.--scanline-opacity]="crt.intensity / 100" [style.--scanline-size.px]="crt.density * 2"></div>
      }
    }
    @if (blocked()) {
      <button class="absolute inset-0 m-auto w-fit h-fit pill pill-primary px-5" type="button" (click)="unblock()">▶ Toca para reproducir</button>
    } @else if (message()) {
      <span class="absolute inset-0 flex items-center justify-center font-mono text-[13px] tracking-[0.12em] text-dim pointer-events-none">{{ message() }}</span>
    }
  `,
})
export class VideoScreen {
  private readonly api = inject(Api);
  private readonly session = inject(Session);
  protected readonly prefs = inject(PlayerPrefs);
  private readonly video = viewChild.required<ElementRef<HTMLVideoElement>>('video');

  readonly channel = input<number | null>(null);
  readonly episode = input<OnDemand | null>(null);
  /** Live state each time the channel changes segment. */
  readonly state = output<ChannelState | null>();
  /** On-demand episode finished. */
  readonly finished = output<void>();

  readonly message = signal('SINTONIZANDO…');
  readonly blocked = signal(false);
  /** Playback position, length and state, for on-demand controls. */
  readonly currentTime = signal(0);
  readonly duration = signal(0);
  readonly paused = signal(true);

  private timer: ReturnType<typeof setTimeout> | null = null;
  private episodeId: number | null = null;
  private spanStart = 0;
  protected readonly finite = finite;

  constructor() {
    effect(() => {
      const channel = this.channel();
      const episode = this.episode();
      untracked(() => {
        this.report();
        this.clearTimer();
        if (channel) this.tune(channel);
        else if (episode) this.play(episode.episodeId, episode.filePath, episode.startSecond);
      });
    });
    effect(() => {
      const element = this.video().nativeElement;
      element.volume = this.prefs.volume() / 100;
    });
    inject(DestroyRef).onDestroy(() => { this.report(); this.clearTimer(); });
  }

  private async tune(channel: number): Promise<void> {
    const requested = performance.now();
    try {
      const state = await this.api.channelState(channel);
      if (this.channel() !== channel) return;
      this.state.emit(state);
      const elapsed = (performance.now() - requested) / 2000;
      this.play(state.episodeId, state.filePath, state.currentSecond + elapsed);
      this.timer = setTimeout(() => this.tune(channel), Math.max(1, state.secondsUntilNext) * 1000 + 500);
    } catch {
      if (this.channel() !== channel) return;
      this.state.emit(null);
      this.stop('SIN SEÑAL');
      this.timer = setTimeout(() => this.tune(channel), 15_000);
    }
  }

  private play(episodeId: number | null, filePath: string, second: number): void {
    const element = this.video().nativeElement;
    const src = mediaUrl(filePath);
    if (!src) { this.stop('SIN SEÑAL'); return; }
    this.episodeId = episodeId;
    this.message.set('');
    const seek = () => {
      element.currentTime = Math.max(0, second);
      this.spanStart = element.currentTime;
      this.currentTime.set(element.currentTime);
      this.start();
    };
    if (element.getAttribute('src') !== src) {
      element.src = src;
      element.addEventListener('loadedmetadata', seek, { once: true });
      element.load();
    } else {
      seek();
    }
  }

  private start(): void {
    this.video().nativeElement.play().then(() => this.blocked.set(false)).catch(() => {
      // Browsers block autoplay with sound: retry muted, then ask for a tap.
      if (!this.prefs.muted()) {
        this.prefs.muted.set(true);
        this.video().nativeElement.muted = true;
        this.video().nativeElement.play().catch(() => this.blocked.set(true));
      } else {
        this.blocked.set(true);
      }
    });
  }

  unblock(): void {
    this.blocked.set(false);
    this.video().nativeElement.play().catch(() => this.blocked.set(true));
  }

  private stop(message: string): void {
    const element = this.video().nativeElement;
    element.pause();
    element.removeAttribute('src');
    element.load();
    this.episodeId = null;
    this.message.set(message);
  }

  togglePlay(): void {
    const element = this.video().nativeElement;
    if (!element.getAttribute('src')) return;
    if (element.paused) this.unblock();
    else element.pause();
  }

  /** Jumps `seconds` forward (or back, when negative). */
  seekBy(seconds: number): void {
    this.seekTo(this.video().nativeElement.currentTime + seconds);
  }

  /** Jumps to `second`, reporting what was watched up to here first. */
  seekTo(second: number): void {
    const element = this.video().nativeElement;
    const duration = finite(element.duration);
    if (!duration) return;
    this.report();
    element.currentTime = Math.min(duration, Math.max(0, second));
    this.spanStart = element.currentTime;
    this.currentTime.set(element.currentTime);
  }

  tick(): void {
    const now = this.video().nativeElement.currentTime;
    this.currentTime.set(now);
    if (now < this.spanStart || now - this.spanStart > REPORT_SPAN + 10) { this.spanStart = now; return; }
    if (now - this.spanStart >= REPORT_SPAN) this.report();
  }

  /** Sends the span watched since the last report (episodes only). */
  report(): void {
    const element = this.video().nativeElement;
    const end = element.currentTime;
    const duration = element.duration;
    if (!this.episodeId || !duration || !isFinite(duration) || end - this.spanStart < 1) return;
    const start = Math.max(this.spanStart, end - 45);
    this.spanStart = end;
    this.api.progress(this.episodeId, start, end, duration, end).then(() => this.session.refreshViewer()).catch(() => {});
  }

  ended(): void {
    this.report();
    if (this.episode()) this.finished.emit();
  }

  failed(): void {
    if (this.video().nativeElement.getAttribute('src')) this.message.set('NO SE PUDO REPRODUCIR');
  }

  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}

function finite(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}
