import { afterNextRender, Component, computed, DestroyRef, inject, input, numberAttribute, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ON_AIR, onAirIndex } from '../../../core/data/live';
import { PlayerPrefs } from '../../../core/player-prefs';

type Overlay = 'controls' | 'zapping' | 'guide' | 'break' | 'idle';

const HIDE_AFTER_MS = 4000;
const ZAP_MS = 3000;

/** Design: "Web · Pantalla completa (overlay)" + "Móvil · Pantalla completa (horizontal)". */
@Component({
  selector: 'app-fullscreen',
  imports: [RouterLink],
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
  readonly id = input(5, { transform: numberAttribute });
  /** `?demo` shows the design's overlay-state switcher. */
  readonly demo = input<string>();

  readonly index = computed(() => onAirIndex(this.id()));
  readonly ch = computed(() => ON_AIR[this.index()]);
  readonly channels = ON_AIR;
  readonly seasonFx = true;

  readonly mode = signal<Overlay>('controls');
  readonly states: [Overlay, string][] = [['controls', 'Controles'], ['zapping', 'Cambio de canal'], ['guide', 'Guía'], ['break', 'Corte comercial'], ['idle', 'Sin controles']];

  // Mobile (compact) overlay state.
  readonly show = signal(true);
  readonly locked = signal(false);
  readonly mobileControls = computed(() => this.show() && !this.locked());

  private timer?: ReturnType<typeof setTimeout>;

  constructor() {
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
    const n = ON_AIR.length;
    this.router.navigate(['/ver', ON_AIR[(index + n) % n].id, 'pantalla-completa'], { replaceUrl: true, queryParamsHandling: 'preserve' });
    this.setMode('zapping');
  }

  exit(): void {
    this.router.navigate(['/ver', this.ch().id]);
  }

  onKey(e: KeyboardEvent): void {
    switch (e.key) {
      case 'Escape': this.mode() === 'guide' ? this.setMode('controls') : this.exit(); break;
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
    this.timer = setTimeout(() => this.mode.set('idle'), ms);
  }
}
