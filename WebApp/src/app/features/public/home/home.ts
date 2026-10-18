import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { continueWatching, lastChannel, PublicData } from '../../../core/data/public-data';
import { Session } from '../../../core/session';
import { LogoMark } from '../../../shared/ui/logo-mark';
import { ProgressBar } from '../../../shared/ui/progress-bar';
import { copyLink } from '../../../shared/utils/share';
import { SEASONS } from './home.data';

/** Design: "Web · Canales (página de inicio)" + "Móvil · Canales (inicio)". */
@Component({
  selector: 'app-home',
  imports: [RouterLink, LogoMark, ProgressBar],
  host: { class: 'flex-1 flex flex-col' },
  templateUrl: './home.html',
})
export class Home {
  protected readonly data = inject(PublicData);
  private readonly session = inject(Session);

  readonly theme = computed(() => SEASONS[this.data.season()]);
  readonly cats = computed(() => ['Todos', ...new Set(this.data.channels().flatMap(c => c.tags))].slice(0, 6));
  readonly cat = signal(0);
  readonly onlyLive = signal(false);
  readonly q = signal('');
  readonly sort = signal(0);
  readonly view = signal<'grid' | 'list'>('grid');
  readonly continueList = computed(() => continueWatching(this.session.viewer()?.progress ?? []));
  readonly liveCount = computed(() => this.data.onAir().length);
  readonly today = new Date().toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '').toUpperCase();
  readonly last = computed(() => this.data.channel(lastChannel() ?? -1) ?? null);
  /** Hero of the phone home: the first channel on the air. */
  readonly featured = computed(() => this.data.onAir()[0] ?? null);

  readonly channels = computed(() => {
    const q = this.q().trim().toLowerCase();
    const cat = this.cats()[this.cat()];
    const list = this.data.channels().filter(c =>
      (this.cat() === 0 || c.tags.includes(cat)) &&
      (!this.onlyLive() || c.on) &&
      (!q || `${c.name} ${c.now}`.toLowerCase().includes(q)));
    return this.sort() === 1 ? [...list].sort((a, b) => a.name.localeCompare(b.name, 'es')) : list;
  });

  readonly mobileFilters = computed(() => ['Todos', 'Al aire', ...this.cats().slice(1)]);
  readonly mobileFilter = signal(0);
  readonly mobileChannels = computed(() => {
    const f = this.mobileFilter();
    const all = this.data.channels();
    if (f === 0) return all;
    if (f === 1) return all.filter(c => c.on);
    const tag = this.mobileFilters()[f];
    return all.filter(c => c.tags.includes(tag));
  });

  constructor() { this.data.use(); }

  clearFilters(): void {
    this.cat.set(0);
    this.onlyLive.set(false);
    this.q.set('');
  }

  share(id: number): void { copyLink(`/canal/${id}`); }
}
