import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { seriesIdByName } from '../../core/data/series';

type Slot = [min: number, title: string, time: string, sub: string];

/** 14:00–16:00 window as drawn in the TV board. */
const ROWS: { id: number; num: string; name: string; slots: Slot[] }[] = [
  { id: 5, num: '05', name: 'Canal 5 Retro', slots: [[18, 'Hey Arnold!', '13:48', 'T2 · E04'], [24, 'Dragon Ball Z', '14:15', 'T2 · E14 · El poder oculto de Gohan'], [24, 'Pokémon', '14:39', 'T3 · E02'], [54, 'Digimon: La película', '15:03', 'Especial · 89 min']] },
  { id: 12, num: '12', name: 'Cartoon Clásico', slots: [[40, 'Hey Arnold!', '14:00', 'T1 · E07'], [24, 'Los Simpson', '14:40', 'T5 · E22'], [56, 'Los Simpson', '15:04', 'T5 · E23–24']] },
  { id: 23, num: '23', name: 'Anime 90s', slots: [[36, 'Caballeros del Zodiaco', '14:00', 'T1 · E31'], [24, 'Digimon Adventure', '14:36', 'T1 · E12'], [60, 'Pokémon', '15:00', 'T1 · E04–05']] },
  { id: 31, num: '31', name: 'Tarde de Sábado', slots: [[62, 'Digimon: La película', '13:58', 'Especial'], [58, 'Pokémon', '15:00', 'T1 · E05–06']] },
  { id: 40, num: '40', name: 'Noche Retro', slots: [[120, 'Fuera del aire', '—', 'Sin era seleccionada']] },
];

/** Design: "Android TV · Guía". OK tunes the channel; long-press OK opens the series. */
@Component({
  selector: 'app-tv-guide',
  imports: [RouterLink],
  host: { class: 'w-full h-full overflow-hidden py-12 px-24 flex flex-col gap-8 bg-ink-2' },
  template: `
    <div class="flex gap-10 h-75">
      <div class="flex-1 flex flex-col justify-end gap-3">
        <span class="font-mono text-[22px] tracking-[0.1em] text-amber uppercase">CH {{ sel().num }} {{ sel().name }} · {{ sel().time }}</span>
        <h1 class="m-0 font-display font-bold text-[64px] leading-none">{{ sel().title }}</h1>
        <span class="text-[26px] text-fg-2">{{ sel().sub }}</span>
        <span class="text-[22px] text-muted">OK para sintonizar · mantén OK para ver la serie</span>
      </div>
      <div class="w-133.5 h-75 flex-none rounded-[18px] border-2 border-line flex items-center justify-center font-mono text-[18px] text-faint scan-panel-2" aria-hidden="true">[ VISTA PREVIA ]</div>
    </div>

    <div class="flex-1 flex flex-col gap-2.5">
      <div class="flex">
        <span class="w-65 flex-none font-display font-semibold text-[26px]">Hoy</span>
        <div class="flex-1 flex">
          @for (h of hours; track h) { <span class="flex-1 font-mono text-[22px] text-muted">{{ h }}</span> }
        </div>
      </div>
      @for (r of rows; track r.id; let ri = $index) {
        <div class="flex h-26">
          <a class="w-65 flex-none flex items-center gap-4 pr-4 rounded-[14px] text-fg hover:text-fg no-underline outline-none focus:bg-raised-2" [routerLink]="['/tv/canal', r.id]">
            <span class="font-display font-bold text-[40px] text-amber">{{ r.num }}</span>
            <span class="text-[22px] font-semibold leading-[1.15]">{{ r.name }}</span>
          </a>
          <div class="flex-1 flex gap-2">
            @for (s of r.slots; track $index; let si = $index) {
              <button type="button" class="min-w-0 box-border flex flex-col justify-center items-start gap-1 px-5 rounded-[14px] text-left font-[inherit] outline-none transition-transform bg-panel-2 text-fg border-2 border-raised-2 focus:bg-fg focus:text-ink-2 focus:border-0 focus:shadow-[0_0_0_4px_#FFB547] focus:scale-[1.02]"
                      [style.flex]="s[0] + ' 0 0'" [attr.data-autofocus]="ri === 0 && si === 1 ? '' : null"
                      (focus)="focus.set([ri, si])" (pointerdown)="press()" (keydown.enter)="press()" (keyup.enter)="release(r.id, s[1])" (pointerup)="release(r.id, s[1])">
                <span class="w-full text-[24px] font-semibold truncate">{{ s[1] }}</span>
                <span class="w-full font-mono text-[18px] opacity-80 whitespace-nowrap overflow-hidden">{{ s[3] }}</span>
              </button>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class TvGuide {
  private readonly router = inject(Router);
  readonly rows = ROWS;
  readonly hours = ['14:00', '14:30', '15:00', '15:30', '16:00'];
  readonly focus = signal<[number, number]>([0, 1]);
  readonly sel = computed(() => {
    const [ri, si] = this.focus();
    const r = ROWS[ri], s = r.slots[si];
    return { num: r.num, name: r.name, title: s[1], time: s[2], sub: s[3] };
  });

  private pressedAt = 0;

  press(): void {
    if (!this.pressedAt) this.pressedAt = Date.now();
  }

  /** Short press tunes the channel; holding OK for 600 ms opens the series page. */
  release(channelId: number, title: string): void {
    const held = this.pressedAt && Date.now() - this.pressedAt >= 600;
    this.pressedAt = 0;
    const seriesId = seriesIdByName(title);
    if (held && seriesId) this.router.navigate(['/tv/series', seriesId]);
    else if (channelId !== 40) this.router.navigate(['/tv/ver', channelId]);
  }
}
