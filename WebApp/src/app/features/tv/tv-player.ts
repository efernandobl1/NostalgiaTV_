import { afterNextRender, Component, DestroyRef, inject, input, numberAttribute, signal } from '@angular/core';
import { Router } from '@angular/router';
import { createTuner } from '../../core/data/live';
import { TvPrefs } from '../../core/tv-prefs';
import { VideoScreen } from '../../shared/ui/video-screen';

const OSD_MS = 5000;

/** Design: "Android TV · Reproductor en vivo". ▲▼ zap, OK opens the guide, ◀ goes back. */
@Component({
  selector: 'app-tv-player',
  imports: [VideoScreen],
  host: {
    class: 'relative block w-full h-full overflow-hidden tv-screen [--screen-edge:#050504]',
    '(document:keydown)': 'onKey($event)',
  },
  template: `
    <app-video-screen [channel]="id()" (state)="tuner.onState($event)" />
    <div class="absolute inset-0 outline-none" tabindex="0" data-autofocus aria-label="Video en vivo"></div>
    @if (ch().inBreak) {
      <span class="absolute top-14 left-24 py-3 px-5 rounded-xl font-mono text-[22px] tracking-[0.1em] text-[#0A1A1F] bg-info">CORTE · VOLVEMOS EN {{ ch().breakLeft }}</span>
    }
    @if (tvPrefs.values().channelNumber) {
      <span class="absolute top-14 right-24 font-display font-bold text-[120px] leading-none text-ok [text-shadow:0_0_18px_rgba(139,224,143,0.55)] transition-opacity" [class.opacity-35]="!osd()">{{ ch().num }}</span>
    }

    @if (osd()) {
      <div class="absolute left-0 right-0 bottom-0 pt-35 px-24 pb-14 flex flex-col gap-7 bg-[linear-gradient(0deg,rgba(5,5,4,0.96)_40%,rgba(5,5,4,0))]">
        <div class="flex items-end gap-10">
          <span class="w-37 h-37 flex-none rounded-[22px] flex items-center justify-center font-display font-bold text-[64px] text-amber bg-panel-2 border-2 border-edge">{{ ch().num }}</span>
          <div class="flex-1 flex flex-col gap-2.5">
            <span class="font-mono text-[24px] tracking-[0.1em] text-amber uppercase">{{ ch().name }}{{ ch().era ? ' · ' + ch().era : '' }}</span>
            <span class="font-display font-bold text-[72px] leading-none">{{ ch().now }}</span>
            <span class="text-[28px] text-fg-2">{{ ch().detail }}</span>
          </div>
          <div class="w-110 flex-none flex flex-col gap-2 py-6 px-7 rounded-[18px] bg-[rgba(236,232,220,0.08)]">
            <span class="font-mono text-[20px] tracking-[0.12em] text-muted">A CONTINUACIÓN{{ ch().ends ? ' · ' + ch().ends : '' }}</span>
            <span class="font-semibold text-[30px]">{{ ch().next }}</span>
          </div>
        </div>
        <div class="flex items-center gap-6">
          <span class="font-mono text-[24px] text-muted">{{ ch().starts }}</span>
          <span class="flex-1 h-2.5 rounded-[5px] bg-[rgba(255,255,255,0.15)]"><span class="block h-2.5 rounded-[5px] bg-amber" [style.width.%]="ch().pct"></span></span>
          <span class="font-mono text-[24px] text-muted">{{ ch().ends }}</span>
        </div>
        <div class="flex items-center gap-12 text-[22px] text-muted">
          <span><strong class="font-mono text-fg">▲ ▼</strong> Cambiar canal</span>
          <span><strong class="font-mono text-fg">OK</strong> Guía</span>
          <span><strong class="font-mono text-fg">◀</strong> Volver</span>
          <span class="flex-1"></span>
          <button class="tv-focus min-w-22 h-16 border-2 border-edge rounded-[32px] bg-transparent text-fg font-mono font-semibold text-[22px] cursor-pointer" type="button" (click)="tune(index() - 1)">CH−</button>
          <button class="tv-focus min-w-22 h-16 border-2 border-edge rounded-[32px] bg-transparent text-fg font-mono font-semibold text-[22px] cursor-pointer" type="button" (click)="tune(index() + 1)">CH+</button>
        </div>
      </div>
    }
  `,
})
export class TvPlayer {
  private readonly router = inject(Router);
  /** "Mostrar número al cambiar de canal": the green tube-TV number in the corner. */
  protected readonly tvPrefs = inject(TvPrefs);
  readonly id = input(0, { transform: numberAttribute });
  readonly tuner = createTuner(this.id);
  readonly index = this.tuner.index;
  readonly ch = this.tuner.ch;
  readonly osd = signal(true);
  private timer?: ReturnType<typeof setTimeout>;

  constructor() {
    afterNextRender(() => this.wake());
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  tune(index: number): void {
    this.router.navigate(['/tv/ver', this.tuner.at(index)], { replaceUrl: true });
    this.wake();
  }

  onKey(e: KeyboardEvent): void {
    const onButton = (e.target as HTMLElement).tagName === 'BUTTON';
    if (e.key === 'ArrowUp') this.tune(this.index() + 1);
    else if (e.key === 'ArrowDown') this.tune(this.index() - 1);
    else if (e.key === 'Enter' && !onButton) this.router.navigateByUrl('/tv/guia');
    else { this.wake(); return; }
    e.preventDefault();
  }

  private wake(): void {
    this.osd.set(true);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.osd.set(false), OSD_MS);
  }
}
