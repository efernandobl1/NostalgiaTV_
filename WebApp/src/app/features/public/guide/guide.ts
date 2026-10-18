import { Component, computed, ElementRef, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { seriesIdByName } from '../../../core/data/series';
import { GRID_HOURS, GUIDE_ROWS, MOBILE_CH5, MobileSlot, NOW_FRACTION, SlotKind, TITLE_TAGS } from './guide.data';

const SLOT_COLORS: Record<string, string> = {
  now: 'background: #FFB547; color: #1A1206;',
  special: 'background: #2C2A44; color: #E2DCFF;',
  default: 'background: #24241F; color: #ECE8DC;',
};

function link(title: string, kind: SlotKind, channelId: number): (string | number)[] {
  if (kind === 'now') return ['/ver', channelId];
  const id = seriesIdByName(title);
  return id ? ['/series', id] : ['/canal', channelId];
}

function clock(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

/** Design: "Web · Guía de programación" + "Móvil · Guía". */
@Component({
  selector: 'app-guide',
  imports: [RouterLink],
  host: { class: 'flex-1 flex flex-col' },
  templateUrl: './guide.html',
})
export class Guide {
  private readonly grid = viewChild<ElementRef<HTMLElement>>('grid');

  readonly days = ['Hoy', 'Mañana', 'Lunes'];
  readonly day = signal(0);
  readonly cats = ['Todas', 'Anime', 'Caricatura', 'Comedia'];
  readonly cat = signal(0);
  readonly q = signal('');
  readonly specialsOnly = signal(false);
  readonly hours = GRID_HOURS;
  readonly nowLeft = `calc(200px + (100% - 200px) * ${NOW_FRACTION})`;
  readonly isToday = computed(() => this.day() === 0);

  readonly rows = computed(() => {
    const q = this.q().trim().toLowerCase();
    const cat = this.cats[this.cat()];
    const today = this.isToday();
    return GUIDE_ROWS.map(r => ({
      ...r,
      slots: r.slots.map(slot => {
        const kind = slot.kind === 'now' && !today ? undefined : slot.kind;
        const tags = TITLE_TAGS.find(([frag]) => slot.title.includes(frag))?.[1] ?? [];
        const match = (!q || slot.title.toLowerCase().includes(q)) &&
          (this.cat() === 0 || tags.includes(cat)) &&
          (!this.specialsOnly() || kind === 'special' || slot.sub === 'Especial');
        return {
          ...slot,
          link: link(slot.title, kind, r.id),
          style: `flex: ${slot.min} 0 0; ${SLOT_COLORS[kind ?? 'default'] ?? SLOT_COLORS['default']} opacity: ${match ? 1 : 0.3};`,
        };
      }),
    }));
  });

  goToNow(): void {
    this.day.set(0);
    const el = this.grid()?.nativeElement;
    if (el) el.scrollTo({ left: Math.max(0, (el.scrollWidth - 200) * NOW_FRACTION - 40), behavior: 'smooth' });
  }

  // ── Mobile ──
  readonly mobileDays = ['Hoy', 'Mañana', 'Lun 19'];
  readonly channels = GUIDE_ROWS;
  readonly channel = signal(0);
  readonly mobileSlots = computed(() => {
    const row = GUIDE_ROWS[this.channel()];
    const today = this.isToday();
    let list: MobileSlot[];
    if (row.id === 5) {
      list = MOBILE_CH5;
    } else {
      let t = 14 * 60;
      list = row.slots.map(slot => {
        const item: MobileSlot = { time: clock(t), dur: `${slot.min}m`, title: slot.title, sub: slot.sub, kind: slot.kind };
        t += slot.min;
        return item;
      });
    }
    return list.map(slot => {
      const kind = today ? slot.kind : slot.kind === 'special' ? 'special' : undefined;
      return {
        ...slot, kind,
        link: link(slot.title, kind, row.id),
        tag: kind === 'now' ? 'AHORA' : kind === 'special' ? 'ESPECIAL' : '',
        tagColor: kind === 'now' ? '#FF8A80' : '#B8A6FF',
        timeColor: kind === 'now' ? '#FF8A80' : kind === 'past' ? '#8C887D' : '#ECE8DC',
      };
    });
  });
}
