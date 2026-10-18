import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../../core/api/api';
import { PublicSeriesCard } from '../../core/api/models';
import { PublicData, years } from '../../core/data/public-data';
import { TvHeader } from './tv-header';

/** Design: "Android TV · Series (buscar y filtrar)". Search and filters run on the API. */
@Component({
  selector: 'app-tv-catalog',
  imports: [RouterLink, TvHeader],
  host: { class: 'w-full h-full overflow-hidden py-12 px-24 flex flex-col gap-8 bg-ink-2' },
  template: `
    <app-tv-header active="series" [full]="false" />

    <div class="flex items-center gap-5">
      <label class="tv-focus w-140 h-18 flex items-center gap-4 px-7 rounded-[36px] bg-panel-2 text-muted focus-within:shadow-[0_0_0_4px_#0B0B09,0_0_0_8px_#FFF3DA] focus-within:scale-[1.05]">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="M20 20l-3.5-3.5"></path></svg>
        <input class="flex-1 min-w-0 border-0 outline-none bg-transparent text-fg placeholder:text-muted text-[22px] font-medium font-sans" type="search"
               aria-label="Buscar series" placeholder="Buscar por nombre o con la voz" [value]="q()" (input)="q.set($any($event.target).value)">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"></rect><path d="M5 11a7 7 0 0 0 14 0M12 18v3"></path></svg>
      </label>
      <div class="flex gap-3" role="group" aria-label="Filtros">
        @for (c of chips(); track c.label; let i = $index) {
          <button type="button" class="tv-chip tv-focus h-16 px-7 rounded-[32px] text-[22px] font-semibold [--focus-scale:1.05]" [attr.aria-pressed]="i === chip()" (click)="chip.set(i)">{{ c.label }}</button>
        }
      </div>
    </div>

    <div class="flex items-baseline gap-4">
      <span class="font-display font-semibold text-[30px]">{{ chip() === 0 ? 'Todas las series' : chips()[chip()].label }}</span>
      <span class="text-[22px] text-muted">{{ total() }} series · ordenadas de la A a la Z</span>
    </div>

    <div class="flex-1 min-h-0 -m-3 p-3 overflow-y-auto no-scrollbar" data-tv-scroll>
      <div class="grid grid-cols-6 gap-7">
        @for (p of results(); track p.id; let i = $index) {
          <a class="tv-focus [--ring:#FFB547] [--focus-scale:1.05] flex flex-col gap-3 rounded-2xl no-underline" [attr.data-autofocus]="i === 0 ? '' : null" [routerLink]="['/tv/series', p.id]">
            <span class="relative flex items-end aspect-[2/3] p-4.5 rounded-2xl scan-raised">
              @if (p.ch) { <span class="absolute top-3.5 left-3.5 py-1 px-2.5 rounded-md font-mono text-[16px] text-on-live bg-live">AL AIRE</span> }
              <span class="font-display font-bold text-[26px] leading-[1.1] text-left text-fg">{{ p.name }}</span>
            </span>
            <span class="font-mono text-[18px] text-muted text-left">{{ p.years }}</span>
          </a>
        } @empty {
          <span class="col-span-6 py-10 text-center text-[24px] text-muted">{{ loading() ? 'Buscando series…' : 'Ninguna serie coincide.' }}</span>
        }
      </div>
    </div>
  `,
})
export class TvCatalog {
  private readonly api = inject(Api);
  private readonly data = inject(PublicData);
  readonly chip = signal(0);
  readonly q = signal('');
  readonly items = signal<PublicSeriesCard[]>([]);
  readonly total = signal(0);
  readonly loading = signal(true);

  /** "Todas", up to three categories, two decades and "Al aire". */
  readonly chips = computed(() => [
    { label: 'Todas' },
    ...this.data.categories().slice(0, 3).map(c => ({ label: c.name, category: c.id })),
    { label: '80s', decade: 1980 }, { label: '90s', decade: 1990 }, { label: 'Al aire', onAir: true },
  ] as { label: string; category?: number; decade?: number; onAir?: boolean }[]);

  readonly results = computed(() => this.items().map(s => ({ id: s.id, name: s.name, years: years(s.startYear, s.endYear), ch: s.onAir.length > 0 })));

  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.data.use();
    effect(() => {
      const chip = this.chips()[this.chip()] ?? { label: 'Todas' };
      const search = this.q().trim();
      untracked(() => {
        if (this.timer) clearTimeout(this.timer);
        this.timer = setTimeout(() => this.load(search, chip), search ? 300 : 0);
      });
    });
  }

  private async load(search: string, chip: { category?: number; decade?: number; onAir?: boolean }): Promise<void> {
    this.loading.set(true);
    try {
      const page = await this.api.series({ search, categoryIds: chip.category ? [chip.category] : [], decade: chip.decade ?? null, onAirToday: chip.onAir, sort: 'name', pageSize: 60 });
      this.items.set(page.items);
      this.total.set(page.totalCount);
    } catch {
      this.items.set([]);
      this.total.set(0);
    } finally {
      this.loading.set(false);
    }
  }
}
