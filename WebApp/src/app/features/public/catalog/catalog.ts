import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SERIES, SERIES_CATEGORIES, SeriesItem } from '../../../core/data/series';
import { Poster } from '../../../shared/ui/poster';

const DECADES: [number, string][] = [[1970, '70s'], [1980, '80s'], [1990, '90s'], [2000, '2000s']];
const SORTS: ((a: SeriesItem, b: SeriesItem) => number)[] = [
  (a, b) => a.name.localeCompare(b.name, 'es'),
  (a, b) => +b.rating - +a.rating,
  (a, b) => a.years.localeCompare(b.years),
  (a, b) => b.years.localeCompare(a.years),
];
/** Mobile chips: [label, predicate]. */
const MOBILE_CHIPS: [string, (s: SeriesItem) => boolean][] = [
  ['Todas', () => true],
  ['Anime', s => s.tags.includes('Anime')],
  ['Caricatura', s => s.tags.includes('Caricatura')],
  ['Comedia', s => s.tags.includes('Comedia')],
  ['80s', s => s.decade === 1980],
  ['90s', s => s.decade === 1990],
  ['Al aire', s => !!s.ch],
  ['Viendo', s => s.pct > 0],
];

/** Design: "Web · Catálogo de series" + "Móvil · Series (buscar y filtrar)". */
@Component({
  selector: 'app-catalog',
  imports: [RouterLink, Poster],
  host: { class: 'flex-1 flex flex-col' },
  templateUrl: './catalog.html',
})
export class Catalog {
  readonly total = SERIES.length;
  readonly decades = DECADES;
  readonly q = signal('');
  readonly picked = signal<string[]>([]);
  readonly decade = signal<number | null>(null);
  readonly onAir = signal(false);
  readonly watching = signal(false);
  readonly sort = signal(0);

  readonly cats = computed(() => SERIES_CATEGORIES.map(name => ({
    name, on: this.picked().includes(name), n: SERIES.filter(s => s.tags.includes(name)).length,
  })));

  readonly results = computed(() => {
    const q = this.q().trim().toLowerCase();
    const picked = this.picked();
    return SERIES.filter(s =>
      (!q || s.name.toLowerCase().includes(q)) &&
      (!picked.length || picked.some(p => s.tags.includes(p))) &&
      (this.decade() === null || s.decade === this.decade()) &&
      (!this.onAir() || !!s.ch) && (!this.watching() || s.pct > 0),
    ).sort(SORTS[this.sort()]);
  });

  readonly activeChips = computed(() => {
    const chips: { label: string; remove: () => void }[] = this.picked().map(c => ({ label: c, remove: () => this.toggleCat(c) }));
    const d = this.decade();
    if (d !== null) chips.push({ label: `Década ${String(d).slice(2)}s`, remove: () => this.decade.set(null) });
    if (this.onAir()) chips.push({ label: 'Al aire hoy', remove: () => this.onAir.set(false) });
    if (this.watching()) chips.push({ label: 'Que estoy viendo', remove: () => this.watching.set(false) });
    return chips;
  });

  toggleCat(name: string): void {
    this.picked.update(p => (p.includes(name) ? p.filter(x => x !== name) : [...p, name]));
  }

  clear(): void {
    this.picked.set([]);
    this.decade.set(null);
    this.onAir.set(false);
    this.watching.set(false);
    this.q.set('');
  }

  // ── Mobile ──
  readonly mobileChips = MOBILE_CHIPS.map(([label]) => label);
  readonly chip = signal(0);
  readonly byRating = signal(false);
  readonly mobileResults = computed(() => {
    const q = this.q().trim().toLowerCase();
    const test = MOBILE_CHIPS[this.chip()][1];
    return SERIES.filter(s => test(s) && (!q || s.name.toLowerCase().includes(q))).sort(SORTS[this.byRating() ? 1 : 0]);
  });
}
