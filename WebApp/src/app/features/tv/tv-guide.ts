import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Api } from '../../core/api/api';
import { GuideRow } from '../../core/api/models';
import { channelNumber, dayKey, hhmm, slotLine } from '../../core/data/public-data';
import { Session } from '../../core/session';

const WINDOW_MIN = 120;

interface Slot { min: number; title: string; time: string; sub: string; seriesId: number | null }
interface Row { id: number; num: string; name: string; slots: Slot[] }

/** Design: "Android TV · Guía". OK tunes the channel; long-press OK opens the series. */
@Component({
  selector: 'app-tv-guide',
  imports: [RouterLink],
  host: { class: 'w-full h-full overflow-hidden py-12 px-24 flex flex-col gap-8 bg-ink-2' },
  template: `
    <div class="flex gap-10 h-75">
      <div class="flex-1 flex flex-col justify-end gap-3">
        @if (sel(); as s) {
          <span class="font-mono text-[22px] tracking-[0.1em] text-amber uppercase">CH {{ s.num }} {{ s.name }} · {{ s.time }}</span>
          <h1 class="m-0 font-display font-bold text-[64px] leading-none">{{ s.title }}</h1>
          <span class="text-[26px] text-fg-2">{{ s.sub }}</span>
          <span class="text-[22px] text-muted">OK para sintonizar · mantén OK para ver la serie</span>
        } @else {
          <h1 class="m-0 font-display font-bold text-[64px] leading-none">{{ loading() ? 'Cargando la guía…' : 'Sin programación' }}</h1>
        }
      </div>
      <div class="w-133.5 h-75 flex-none rounded-[18px] border-2 border-line scan-panel-2" aria-hidden="true"></div>
    </div>

    <div class="flex-1 min-h-0 flex flex-col gap-2.5 overflow-y-auto no-scrollbar" data-tv-scroll>
      <div class="flex">
        <span class="w-65 flex-none font-display font-semibold text-[26px]">Hoy</span>
        <div class="flex-1 flex">
          @for (h of hours(); track h) { <span class="flex-1 font-mono text-[22px] text-muted">{{ h }}</span> }
        </div>
      </div>
      @for (r of rows(); track r.id; let ri = $index) {
        <div class="flex h-26 flex-none">
          <a class="w-65 flex-none flex items-center gap-4 pr-4 rounded-[14px] text-fg hover:text-fg no-underline outline-none focus:bg-raised-2" [routerLink]="['/tv/canal', r.id]">
            <span class="font-display font-bold text-[40px] text-amber">{{ r.num }}</span>
            <span class="text-[22px] font-semibold leading-[1.15]">{{ r.name }}</span>
          </a>
          <div class="flex-1 flex gap-2">
            @for (s of r.slots; track $index; let si = $index) {
              <button type="button" class="min-w-0 box-border flex flex-col justify-center items-start gap-1 px-5 rounded-[14px] text-left font-[inherit] outline-none transition-transform bg-panel-2 text-fg border-2 border-raised-2 focus:bg-fg focus:text-ink-2 focus:border-0 focus:shadow-[0_0_0_4px_#FFB547] focus:scale-[1.02]"
                      [style.flex]="s.min + ' 0 0'" [attr.data-autofocus]="ri === 0 && si === 0 ? '' : null"
                      (focus)="focus.set([ri, si])" (pointerdown)="press()" (keydown.enter)="press()" (keyup.enter)="release(r.id, s)" (pointerup)="release(r.id, s)">
                <span class="w-full text-[24px] font-semibold truncate">{{ s.title }}</span>
                <span class="w-full font-mono text-[18px] opacity-80 whitespace-nowrap overflow-hidden">{{ s.sub }}</span>
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
  private readonly api = inject(Api);
  private readonly session = inject(Session);
  readonly loading = signal(true);
  private readonly guide = signal<GuideRow[]>([]);
  /** Two hours from the last half hour. */
  private readonly start = (() => { const d = new Date(); d.setMinutes(d.getMinutes() < 30 ? 0 : 30, 0, 0); return d.getTime(); })();
  readonly hours = computed(() => [0, 30, 60, 90, 120].map(m => hhmm(new Date(this.start + m * 60_000).toISOString())));

  readonly rows = computed<Row[]>(() => {
    const from = this.start, to = from + WINDOW_MIN * 60_000;
    return this.guide().map(row => {
      const slots = row.slots
        .map(s => ({ s, a: Math.max(from, new Date(s.startsAtUtc).getTime()), b: Math.min(to, new Date(s.endsAtUtc).getTime()) }))
        .filter(x => x.b > x.a)
        .map(({ s, a, b }) => ({ min: Math.max(1, Math.round((b - a) / 60_000)), title: s.seriesName, time: hhmm(s.startsAtUtc), sub: slotLine(s) || hhmm(s.startsAtUtc), seriesId: s.seriesId }));
      return { id: row.channelId, num: channelNumber(row.channelId), name: row.channelName,
        slots: slots.length ? slots : [{ min: WINDOW_MIN, title: 'Fuera del aire', time: '—', sub: 'Sin programación', seriesId: null }] };
    });
  });

  readonly focus = signal<[number, number]>([0, 0]);
  readonly sel = computed(() => {
    const [ri, si] = this.focus();
    const r = this.rows()[ri], s = r?.slots[si];
    return r && s ? { num: r.num, name: r.name, title: s.title, time: s.time, sub: s.sub } : null;
  });

  private pressedAt = 0;

  constructor() {
    this.api.guide(dayKey(0, this.session.settings()?.timeZoneId)).then(rows => this.guide.set(rows)).catch(() => this.guide.set([])).finally(() => this.loading.set(false));
  }

  press(): void {
    if (!this.pressedAt) this.pressedAt = Date.now();
  }

  /** Short press tunes the channel; holding OK for 600 ms opens the series page. */
  release(channelId: number, slot: Slot): void {
    const held = this.pressedAt && Date.now() - this.pressedAt >= 600;
    this.pressedAt = 0;
    if (held && slot.seriesId) this.router.navigate(['/tv/series', slot.seriesId]);
    else if (slot.seriesId) this.router.navigate(['/tv/ver', channelId]);
  }
}
