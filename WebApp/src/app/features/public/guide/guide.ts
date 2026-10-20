import { Component, computed, effect, ElementRef, inject, signal, untracked, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../../../core/api/api';
import { GuideRow, GuideSlot } from '../../../core/api/models';
import { ChannelEvents, debounce } from '../../../core/data/channel-events';
import { airedPct, channelNumber, dayKey, hhmm, PublicData, slotLine } from '../../../core/data/public-data';
import { Session } from '../../../core/session';

type SlotKind = 'now' | 'special' | 'past' | undefined;
/** A program block of the grid, or empty air time (`spacer`). */
interface GridSlot { spacer?: boolean; title?: string; sub?: string; link?: (string | number)[]; style: string }

const WINDOW_MIN = 240;
const SLOT_COLORS: Record<string, string> = {
  now: 'background: #FFB547; color: #1A1206;',
  special: 'background: #2C2A44; color: #E2DCFF;',
  default: 'background: #24241F; color: #ECE8DC;',
};

function kindOf(slot: GuideSlot, now: number): SlotKind {
  if (slot.isNow) return 'now';
  if (slot.isSpecial) return 'special';
  return new Date(slot.endsAtUtc).getTime() <= now ? 'past' : undefined;
}

function link(slot: GuideSlot, kind: SlotKind, channelId: number): (string | number)[] {
  return kind === 'now' ? ['/ver', channelId] : ['/series', slot.seriesId];
}

/** Design: "Web · Guía de programación" + "Móvil · Guía". */
@Component({
  selector: 'app-guide',
  imports: [RouterLink],
  host: { class: 'flex-1 flex flex-col' },
  templateUrl: './guide.html',
})
export class Guide {
  private readonly api = inject(Api);
  private readonly data = inject(PublicData);
  private readonly session = inject(Session);
  private readonly grid = viewChild<ElementRef<HTMLElement>>('grid');

  /** Noon (UTC) of the platform's calendar day `offset` days ahead: labels match the day the guide returns. */
  private date(offset: number): Date { return new Date(`${dayKey(offset, this.session.settings()?.timeZoneId)}T12:00:00Z`); }

  /** Today and the next two days (the API covers two days ahead). */
  readonly days = [0, 1, 2].map(offset => {
    if (offset === 0) return 'Hoy';
    if (offset === 1) return 'Mañana';
    return this.date(offset).toLocaleDateString('es', { weekday: 'long', timeZone: 'UTC' }).replace(/^./, c => c.toUpperCase());
  });
  readonly mobileDays = [0, 1, 2].map(offset => {
    if (offset < 2) return this.days[offset];
    const date = this.date(offset);
    return `${date.toLocaleDateString('es', { weekday: 'short', timeZone: 'UTC' }).replace('.', '').replace(/^./, c => c.toUpperCase())} ${date.getUTCDate()}`;
  });
  readonly title = computed(() => this.date(this.day()).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).toUpperCase());
  readonly day = signal(0);
  readonly cats = computed(() => ['Todas', ...this.data.categories().slice(0, 4).map(c => c.name)]);
  readonly cat = signal(0);
  readonly q = signal('');
  readonly specialsOnly = signal(false);
  readonly isToday = computed(() => this.day() === 0);
  readonly loading = signal(true);
  readonly error = signal('');

  private readonly guide = signal<GuideRow[]>([]);
  /** Series of the selected category (the guide itself carries no categories). */
  private readonly catSeries = signal<Set<number> | null>(null);
  private readonly now = signal(Date.now());

  /** Grid window: from the last half hour today, from 16:00 other days. */
  private readonly start = computed(() => {
    const date = new Date(this.now());
    date.setDate(date.getDate() + this.day());
    if (this.isToday()) date.setMinutes(date.getMinutes() < 30 ? 0 : 30, 0, 0);
    else date.setHours(16, 0, 0, 0);
    return date.getTime();
  });
  readonly hours = computed(() => Array.from({ length: WINDOW_MIN / 30 }, (_, i) => hhmm(new Date(this.start() + i * 30 * 60_000).toISOString())));
  readonly nowFraction = computed(() => Math.min(1, Math.max(0, (this.now() - this.start()) / (WINDOW_MIN * 60_000))));
  readonly nowLeft = computed(() => `calc(200px + (100% - 200px) * ${this.nowFraction()})`);
  readonly nowLabel = computed(() => hhmm(new Date(this.now()).toISOString()));

  private matches(slot: GuideSlot): boolean {
    const q = this.q().trim().toLowerCase();
    const set = this.catSeries();
    return (!q || slot.seriesName.toLowerCase().includes(q) || slot.title.toLowerCase().includes(q))
      && (this.cat() === 0 || !set || set.has(slot.seriesId))
      && (!this.specialsOnly() || slot.isSpecial);
  }

  readonly rows = computed(() => {
    const from = this.start(), to = from + WINDOW_MIN * 60_000, now = this.now();
    return this.guide().map(row => {
      const visible = row.slots
        .map(slot => ({ slot, a: Math.max(from, new Date(slot.startsAtUtc).getTime()), b: Math.min(to, new Date(slot.endsAtUtc).getTime()) }))
        .filter(x => x.b > x.a)
        .sort((x, y) => x.a - y.a);
      // Every block grows by its minutes in the window; empty time becomes a spacer so blocks line up with the hours.
      const slots: GridSlot[] = [];
      let cursor = from;
      for (const { slot, a, b } of visible) {
        if (a - cursor >= 60_000) slots.push({ spacer: true, style: `flex: ${(a - cursor) / 60_000} 0 0;` });
        const kind = kindOf(slot, now);
        const shown = kind === 'past' ? undefined : kind;
        slots.push({
          title: slot.seriesName, sub: slotLine(slot) || hhmm(slot.startsAtUtc), link: link(slot, kind, row.channelId),
          style: `flex: ${(b - a) / 60_000} 0 0; ${SLOT_COLORS[shown ?? 'default']} opacity: ${this.matches(slot) ? 1 : 0.3};`,
        });
        cursor = Math.max(cursor, b);
      }
      if (slots.length && to - cursor >= 60_000) slots.push({ spacer: true, style: `flex: ${(to - cursor) / 60_000} 0 0;` });
      return {
        id: row.channelId, num: channelNumber(row.channelId), name: row.channelName,
        slots: slots.length ? slots : [{ title: 'Fuera del aire', sub: 'Sin programación', link: ['/canal', row.channelId], style: `flex: ${WINDOW_MIN} 0 0; ${SLOT_COLORS['default']}` } as GridSlot],
      };
    });
  });

  constructor() {
    this.data.use();
    const timer = setInterval(() => this.now.set(Date.now()), 60_000);
    effect(onCleanup => onCleanup(() => clearInterval(timer)));
    effect(() => {
      const day = this.day();
      untracked(() => this.load(day));
    });
    // A rewritten schedule (an era on air, new interludes) or a new channel changes the grid; new segments do not.
    const reload = debounce(() => this.load(this.day(), true), 2_000);
    inject(ChannelEvents).listen(change => { if (change.reason !== 'segment') reload(); });
    effect(() => {
      const name = this.cats()[this.cat()];
      untracked(() => {
        const category = this.data.categories().find(c => c.name === name);
        if (!category) { this.catSeries.set(null); return; }
        this.api.series({ categoryIds: [category.id], pageSize: 200 }).then(page => this.catSeries.set(new Set(page.items.map(s => s.id)))).catch(() => this.catSeries.set(null));
      });
    });
  }

  /** `quiet` (a live update) keeps the grid on screen while loading and keeps it if the request fails. */
  private async load(day: number, quiet = false): Promise<void> {
    if (!quiet) this.loading.set(true);
    try {
      const guide = await this.api.guide(dayKey(day, this.session.settings()?.timeZoneId));
      if (this.day() !== day) return;
      this.guide.set(guide);
      this.error.set('');
    } catch {
      if (quiet) return;
      this.guide.set([]);
      this.error.set('No se pudo cargar la guía.');
    } finally {
      if (!quiet) this.loading.set(false);
    }
  }

  goToNow(): void {
    this.day.set(0);
    const el = this.grid()?.nativeElement;
    if (el) el.scrollTo({ left: Math.max(0, (el.scrollWidth - 200) * this.nowFraction() - 40), behavior: 'smooth' });
  }

  // ── Mobile ──
  readonly channels = computed(() => this.guide().map(r => ({ id: r.channelId, num: channelNumber(r.channelId), short: r.channelName.split(' ').slice(0, 2).join(' ') })));
  readonly channel = signal(0);
  readonly mobileSlots = computed(() => {
    const row = this.guide()[this.channel()];
    const now = this.now();
    return (row?.slots ?? []).map(slot => {
      const kind = kindOf(slot, now);
      return {
        time: hhmm(slot.startsAtUtc), dur: `${Math.round((new Date(slot.endsAtUtc).getTime() - new Date(slot.startsAtUtc).getTime()) / 60_000)}m`,
        title: slot.seriesName, sub: slotLine(slot), kind, link: link(slot, kind, row!.channelId),
        pct: kind === 'now' ? airedPct(slot.startsAtUtc, slot.endsAtUtc, now) : 0,
        tag: kind === 'now' ? 'AHORA' : kind === 'special' ? 'ESPECIAL' : '',
        tagColor: kind === 'now' ? '#FF8A80' : '#B8A6FF',
        timeColor: kind === 'now' ? '#FF8A80' : kind === 'past' ? '#8C887D' : '#ECE8DC',
      };
    });
  });
}
