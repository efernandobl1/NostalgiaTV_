import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api, mediaUrl } from '../../../core/api/api';
import { PublicSeriesCard } from '../../../core/api/models';
import { channelNumber, PublicData, years } from '../../../core/data/public-data';
import { Session } from '../../../core/session';
import { Poster } from '../../../shared/ui/poster';

const DECADES: [number, string][] = [[1970, '70s'], [1980, '80s'], [1990, '90s'], [2000, '2000s']];
const SORTS = ['name', 'rating', 'oldest', 'newest'];
const PAGE = 24;

export interface SeriesCardView { id: number; name: string; years: string; rating: string; ch: string; pct: number | null; image: string | null }

/** Design: "Web · Catálogo de series" + "Móvil · Series (buscar y filtrar)". Search and filters run on the API. */
@Component({
  selector: 'app-catalog',
  imports: [RouterLink, Poster],
  host: { class: 'flex-1 flex flex-col' },
  templateUrl: './catalog.html',
})
export class Catalog {
  private readonly api = inject(Api);
  private readonly session = inject(Session);
  protected readonly data = inject(PublicData);

  readonly decades = DECADES;
  readonly q = signal('');
  readonly picked = signal<number[]>([]);
  readonly decade = signal<number | null>(null);
  readonly onAir = signal(false);
  readonly watching = signal(false);
  readonly sort = signal(0);

  readonly items = signal<PublicSeriesCard[]>([]);
  readonly totalCount = signal(0);
  private readonly catalogSize = signal(0);
  readonly total = computed(() => this.catalogSize());
  readonly page = signal(1);
  readonly loading = signal(true);
  readonly error = signal('');

  /** Series the viewer has started (for "Que estoy viendo" and the progress bars). */
  private readonly watched = computed(() => new Set((this.session.viewer()?.progress ?? []).map(p => p.seriesId)));

  readonly cats = computed(() => this.data.categories().map(c => ({ id: c.id, name: c.name, on: this.picked().includes(c.id), n: c.seriesCount })));

  readonly results = computed<SeriesCardView[]>(() => this.items()
    .filter(s => !this.watching() || this.watched().has(s.id))
    .map(s => ({
      id: s.id, name: s.name, years: years(s.startYear, s.endYear), rating: s.rating?.toFixed(1) ?? '—',
      ch: s.onAir.length ? channelNumber(s.onAir[0].channelId) : '', pct: this.watched().has(s.id) ? 0 : null, image: mediaUrl(s.logoPath),
    })));

  readonly hasMore = computed(() => this.items().length < this.totalCount());

  readonly activeChips = computed(() => {
    const chips: { label: string; remove: () => void }[] = this.cats().filter(c => c.on).map(c => ({ label: c.name, remove: () => this.toggleCat(c.id) }));
    const d = this.decade();
    if (d !== null) chips.push({ label: `Década ${String(d).slice(2)}s`, remove: () => this.decade.set(null) });
    if (this.onAir()) chips.push({ label: 'Al aire hoy', remove: () => this.onAir.set(false) });
    if (this.watching()) chips.push({ label: 'Que estoy viendo', remove: () => this.watching.set(false) });
    return chips;
  });

  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.data.use();
    this.api.series({ pageSize: 1 }).then(r => this.catalogSize.set(r.totalCount)).catch(() => {});
    // Any filter change reloads the first page (search is debounced).
    effect(() => {
      const query = { search: this.q().trim(), categoryIds: this.picked(), decade: this.decade(), onAirToday: this.onAir(), sort: SORTS[this.sort()] };
      untracked(() => {
        if (this.searchTimer) clearTimeout(this.searchTimer);
        this.searchTimer = setTimeout(() => this.load(1, query), query.search ? 300 : 0);
      });
    });
  }

  private lastQuery: Parameters<Api['series']>[0] = {};

  async load(page: number, query = this.lastQuery): Promise<void> {
    this.lastQuery = query;
    this.loading.set(true);
    try {
      const result = await this.api.series({ ...query, page, pageSize: PAGE });
      this.items.set(page === 1 ? result.items : [...this.items(), ...result.items]);
      this.totalCount.set(result.totalCount);
      this.page.set(page);
      this.error.set('');
    } catch {
      this.error.set('No se pudo cargar el catálogo.');
    } finally {
      this.loading.set(false);
    }
  }

  more(): void { if (this.hasMore() && !this.loading()) this.load(this.page() + 1); }

  toggleCat(id: number): void {
    this.picked.update(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]));
  }

  clear(): void {
    this.picked.set([]);
    this.decade.set(null);
    this.onAir.set(false);
    this.watching.set(false);
    this.q.set('');
  }

  // ── Mobile: one chip at a time ──
  readonly mobileChips = computed(() => ['Todas', ...this.data.categories().slice(0, 3).map(c => c.name), '80s', '90s', 'Al aire', 'Viendo']);
  readonly chip = signal(0);
  readonly byRating = signal(false);

  pickChip(index: number): void {
    this.chip.set(index);
    const label = this.mobileChips()[index];
    const category = this.data.categories().find(c => c.name === label);
    this.picked.set(category ? [category.id] : []);
    this.decade.set(label === '80s' ? 1980 : label === '90s' ? 1990 : null);
    this.onAir.set(label === 'Al aire');
    this.watching.set(label === 'Viendo');
  }

  toggleRating(): void {
    this.byRating.update(v => !v);
    this.sort.set(this.byRating() ? 1 : 0);
  }
}
