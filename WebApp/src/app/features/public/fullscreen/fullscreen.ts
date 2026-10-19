import { afterNextRender, Component, computed, DestroyRef, effect, inject, input, numberAttribute, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { createTuner } from '../../../core/data/live';
import { PlayerPrefs } from '../../../core/player-prefs';
import { PublicData } from '../../../core/data/public-data';
import { CrtSettings } from '../../../shared/ui/crt-settings';
import { VideoScreen } from '../../../shared/ui/video-screen';

type Overlay = 'controls' | 'zapping' | 'guide' | 'break' | 'idle';

const HIDE_AFTER_MS = 4000;
const ZAP_MS = 3000;

/** Design: "Web · Pantalla completa (overlay)" + "Móvil · Pantalla completa (horizontal)". */
@Component({
  selector: 'app-fullscreen',
  imports: [RouterLink, VideoScreen, CrtSettings],
  host: {
    class: 'fixed inset-0 z-50 block bg-black text-fg font-sans select-none',
    '(document:mousemove)': 'wake()',
    '(document:keydown)': 'onKey($event)',
  },
  templateUrl: './fullscreen.html',
})
export class Fullscreen {
  private readonly router = inject(Router);
  protected readonly player = inject(PlayerPrefs);

  /** Route param `:id`. */
  readonly id = input(0, { transform: numberAttribute });
  /** `?demo` shows the design's overlay-state switcher. */
  readonly demo = input<string>();

  readonly tuner = createTuner(this.id);
  readonly index = this.tuner.index;
  readonly ch = this.tuner.ch;
  readonly channels = this.tuner.channels;
  private readonly data = inject(PublicData);
  /** Seasonal glow over the picture, on with "Efectos de temporada" like the site atmosphere. */
  readonly seasonFx = this.data.effects;
  /** Mirrors the `compact:` variant so only one `<video>` plays. */
  readonly compact = signal(false);

  readonly mode = signal<Overlay>('controls');
  readonly states: [Overlay, string][] = [['controls', 'Controles'], ['zapping', 'Cambio de canal'], ['guide', 'Guía'], ['break', 'Corte comercial'], ['idle', 'Sin controles']];

  // Mobile (compact) overlay state.
  readonly show = signal(true);
  readonly locked = signal(false);
  readonly mobileControls = computed(() => this.show() && !this.locked());

  /** The CRT panel is open: keep the controls up and let Escape close it first. */
  readonly crtOpen = signal(false);

  private timer?: ReturnType<typeof setTimeout>;

  constructor() {
    const query = matchMedia('(max-width: 767px), (max-height: 500px)');
    this.compact.set(query.matches);
    query.addEventListener('change', e => this.compact.set(e.matches));
    // Commercial breaks switch the overlay on their own.
    effect(() => {
      const inBreak = this.ch().inBreak;
      untracked(() => {
        if (inBreak && this.mode() !== 'guide') this.setMode('break');
        else if (!inBreak && this.mode() === 'break') this.setMode('controls');
      });
    });
    afterNextRender(() => {
      document.documentElement.requestFullscreen?.().catch(() => undefined);
      this.schedule(HIDE_AFTER_MS);
    });
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.timer);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    });
  }

  setMode(mode: Overlay): void {
    this.mode.set(mode);
    if (mode === 'controls') this.schedule(HIDE_AFTER_MS);
    else if (mode === 'zapping') this.schedule(ZAP_MS);
    else clearTimeout(this.timer);
  }

  /** Mouse activity brings the controls back (except over the guide or a commercial break). */
  wake(): void {
    const m = this.mode();
    if (m === 'idle' || m === 'controls') this.setMode('controls');
  }

  tune(index: number): void {
    this.router.navigate(['/ver', this.tuner.at(index), 'pantalla-completa'], { replaceUrl: true, queryParamsHandling: 'preserve' });
    this.setMode('zapping');
  }

  exit(): void {
    this.router.navigate(['/ver', this.id()]);
  }

  onKey(e: KeyboardEvent): void {
    // Keys typed inside the CRT panel (sliders use the arrows) are not player shortcuts.
    if ((e.target as Element | null)?.closest?.('app-crt-settings')) return;
    switch (e.key) {
      case 'Escape': this.crtOpen() ? this.crtOpen.set(false) : this.mode() === 'guide' ? this.setMode('controls') : this.exit(); break;
      case 'ArrowUp': this.tune(this.index() + 1); break;
      case 'ArrowDown': this.tune(this.index() - 1); break;
      case 'g': case 'G': this.setMode(this.mode() === 'guide' ? 'controls' : 'guide'); break;
      case 'm': case 'M': this.player.toggleMute(); break;
      default: return;
    }
    e.preventDefault();
  }

  toggleMobile(): void {
    if (!this.locked()) this.show.update(s => !s);
  }

  private schedule(ms: number): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.crtOpen() ? this.schedule(ms) : this.mode.set('idle'), ms);
  }
}
