import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LogoMark } from '../../../shared/ui/logo-mark';
import { ProgressBar } from '../../../shared/ui/progress-bar';
import { copyLink } from '../../../shared/utils/share';
import { CATEGORIES, CONTINUE_WATCHING, LIVE_CHANNELS, MOBILE_FILTERS, Season, SEASONS } from './home.data';

/** Design: "Web · Canales (página de inicio)" + "Móvil · Canales (inicio)". */
@Component({
  selector: 'app-home',
  imports: [RouterLink, LogoMark, ProgressBar],
  host: { class: 'flex-1 flex flex-col' },
  templateUrl: './home.html',
})
export class Home {
  readonly season = signal<Season>('halloween');
  readonly theme = computed(() => SEASONS[this.season()]);
  readonly cats = CATEGORIES;
  readonly cat = signal(0);
  readonly onlyLive = signal(false);
  readonly q = signal('');
  readonly sort = signal(0);
  readonly view = signal<'grid' | 'list'>('grid');
  readonly continueList = CONTINUE_WATCHING;
  readonly liveCount = LIVE_CHANNELS.filter(c => c.on).length;

  readonly channels = computed(() => {
    const q = this.q().trim().toLowerCase();
    const cat = CATEGORIES[this.cat()];
    const list = LIVE_CHANNELS.filter(c =>
      (this.cat() === 0 || c.tags.includes(cat)) &&
      (!this.onlyLive() || c.on) &&
      (!q || `${c.name} ${c.now}`.toLowerCase().includes(q)));
    return this.sort() === 1 ? [...list].sort((a, b) => a.name.localeCompare(b.name, 'es')) : list;
  });

  readonly mobileFilters = MOBILE_FILTERS;
  readonly mobileFilter = signal(0);
  readonly mobileChannels = computed(() => {
    const f = this.mobileFilter();
    if (f === 0) return LIVE_CHANNELS;
    if (f === 1) return LIVE_CHANNELS.filter(c => c.on);
    const tag = MOBILE_FILTERS[f].replace(/s$/, '');
    return LIVE_CHANNELS.filter(c => c.tags.includes(tag));
  });

  clearFilters(): void {
    this.cat.set(0);
    this.onlyLive.set(false);
    this.q.set('');
  }

  share(id: number): void { copyLink(`/canal/${id}`); }
}
