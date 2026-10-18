import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { AdminApi } from '../../../core/api/admin-api';
import { errorMessage, mediaUrl } from '../../../core/api/api';
import { BreakPointItem, CatalogItem, EpisodeItem, SeriesDetail, SeriesListItem } from '../../../core/api/models';
import { years } from '../../../core/data/public-data';
import { ConfirmDialog } from '../../../shared/ui/confirm-dialog';
import { PageHeader } from '../../../shared/ui/page-header';
import { BreakpointDialog, EpisodeDialog, formatOffset, ImportDialog, SeasonDialog, SeriesDialog, UploadDialog } from './series-dialogs';

type Dlg = 'series' | 'episode' | 'upload' | 'season' | 'breakpoint' | 'import' | 'confirm' | null;
interface Confirm { heading: string; message: string; label: string; action: () => Promise<unknown> }

/** Timeline length when the episode duration is unknown (the API stores no duration). */
const DEFAULT_LENGTH = 22 * 60;

@Component({
  selector: 'app-series',
  imports: [PageHeader, ConfirmDialog, SeriesDialog, EpisodeDialog, UploadDialog, SeasonDialog, BreakpointDialog, ImportDialog],
  host: { class: 'flex flex-col gap-6' },
  templateUrl: './series.html',
})
export class Series {
  private readonly admin = inject(AdminApi);

  readonly categories = signal<CatalogItem[]>([]);
  readonly episodeTypes = signal<CatalogItem[]>([]);
  readonly cats = computed(() => ['Todas', ...this.categories().map(c => c.name)]);
  readonly cat = signal(0);
  readonly q = signal('');
  readonly list = signal<SeriesListItem[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly notice = signal('');

  readonly series = computed(() => {
    const category = this.categories()[this.cat() - 1];
    return this.list().filter(s => !category || s.categories.some(c => c.id === category.id)).map(s => ({
      id: s.id, name: s.name, years: years(s.startDate, s.endDate), seasons: s.seasons.filter(n => n > 0).length, logo: mediaUrl(s.logoPath),
      files: `${s.episodeCount - s.missingEpisodeCount} / ${s.episodeCount} archivos`, warn: s.missingEpisodeCount > 0,
    }));
  });
  readonly seriesIndex = signal(0);
  readonly detail = signal<SeriesDetail | null>(null);
  readonly info = computed(() => {
    const d = this.detail();
    if (!d) return null;
    const date = (iso: string) => new Date(iso).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' });
    return {
      name: d.name, rating: d.rating?.toFixed(1) ?? '—', tags: d.categories.map(c => c.name), logo: mediaUrl(d.logoPath),
      dates: `${date(d.startDate)} → ${d.endDate ? date(d.endDate) : 'en emisión'}${d.folderPath ? ' · ' + d.folderPath : ''}`,
      synopsis: d.description ?? 'Sin descripción. Impórtala desde un proveedor o edítala a mano.',
    };
  });
  readonly extIds = computed(() => (this.detail()?.externalIds ?? []).map(x => ({ provider: x.providerName, id: x.externalId, providerId: x.providerId })));

  readonly seasonNumbers = computed(() => (this.detail()?.seasons ?? []).map(s => s.seasonNumber).sort((a, b) => a - b));
  readonly seasons = computed(() => [...(this.detail()?.seasons ?? [])].sort((a, b) => a.seasonNumber - b.seasonNumber)
    .map(s => `${s.seasonNumber === 0 ? 'T0 · Especiales' : 'T' + s.seasonNumber}${s.missingCount ? ' · ' + s.missingCount + ' sin archivo' : ''}`));
  readonly season = signal(0);
  readonly rawEpisodes = signal<EpisodeItem[]>([]);
  readonly marks = signal(new Map<number, number[]>());
  readonly episodes = computed(() => this.rawEpisodes().map(e => ({
    id: e.id, num: e.seasonNumber === 0 ? (e.episodeType.slice(0, 3).toUpperCase() + e.episodeNumber) : `E${e.episodeNumber}`, title: e.title, type: e.episodeType,
    file: e.filePath ? e.filePath.split('/').pop()! : 'sin archivo', ok: e.isAvailable, marks: this.marks().get(e.id) ?? [], item: e,
  })));
  readonly epIndex = signal(0);
  readonly ep = computed(() => this.episodes()[this.epIndex()] ?? null);
  readonly rawBreakPoints = signal<BreakPointItem[]>([]);
  readonly length = computed(() => Math.max(DEFAULT_LENGTH, ...this.rawBreakPoints().map(b => b.offsetSeconds * 1.1)));
  readonly bps = computed(() => this.rawBreakPoints().map(b => ({ id: b.id, pct: b.offsetSeconds * 100 / this.length(), at: formatOffset(b.offsetSeconds), label: b.label ?? 'Corte' })));
  readonly ticks = computed(() => [0, this.length() / 2, this.length()].map(s => formatOffset(s).slice(0, 5)));

  readonly dlg = signal<Dlg>(null);
  readonly mode = signal<'create' | 'edit'>('edit');
  readonly confirm = signal<Confirm>({ heading: '', message: '', label: '', action: async () => undefined });
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.admin.categories().then(c => this.categories.set(c)).catch(() => {});
    this.admin.episodeTypes().then(t => this.episodeTypes.set(t)).catch(() => {});
    effect(() => {
      const q = this.q().trim();
      untracked(() => {
        if (this.searchTimer) clearTimeout(this.searchTimer);
        this.searchTimer = setTimeout(() => this.loadList(q), q ? 300 : 0);
      });
    });
    effect(() => {
      const s = this.series()[this.seriesIndex()];
      untracked(() => { if (s) this.loadDetail(s.id); else { this.detail.set(null); this.rawEpisodes.set([]); } });
    });
    effect(() => {
      const number = this.seasonNumbers()[this.season()];
      const id = this.detail()?.id;
      untracked(() => { if (id !== undefined && number !== undefined) this.loadEpisodes(id, number); else this.rawEpisodes.set([]); });
    });
    effect(() => {
      const ep = this.ep();
      untracked(() => { if (ep) this.loadBreakPoints(ep.id); else this.rawBreakPoints.set([]); });
    });
  }

  private async loadList(search = this.q().trim(), selectId?: number): Promise<void> {
    try {
      const list = await this.admin.series(search || undefined);
      this.list.set(list);
      const index = selectId ? this.series().findIndex(s => s.id === selectId) : -1;
      this.seriesIndex.set(index >= 0 ? index : Math.min(this.seriesIndex(), Math.max(0, this.series().length - 1)));
      this.error.set('');
    } catch (error) {
      this.error.set(errorMessage(error, 'No se pudieron cargar las series.'));
    } finally {
      this.loading.set(false);
    }
  }

  private async loadDetail(id: number, keepSeason = false): Promise<void> {
    try {
      const detail = await this.admin.seriesDetail(id);
      this.detail.set(detail);
      if (!keepSeason) {
        const numbers = detail.seasons.map(s => s.seasonNumber).sort((a, b) => a - b);
        this.season.set(Math.max(0, numbers.findIndex(n => n > 0)));
      }
    } catch (error) {
      this.error.set(errorMessage(error, 'No se pudo cargar la serie.'));
    }
  }

  private async loadEpisodes(id: number, season: number): Promise<void> {
    try {
      const list = await this.admin.episodes(id, season);
      this.rawEpisodes.set(list);
      if (this.epIndex() >= list.length) this.epIndex.set(0);
    } catch (error) {
      this.error.set(errorMessage(error, 'No se pudieron cargar los episodios.'));
    }
  }

  private async loadBreakPoints(episodeId: number): Promise<void> {
    try {
      const list = await this.admin.breakPoints(episodeId);
      this.rawBreakPoints.set(list);
      const length = Math.max(DEFAULT_LENGTH, ...list.map(b => b.offsetSeconds * 1.1));
      this.marks.update(m => new Map(m).set(episodeId, list.map(b => b.offsetSeconds * 100 / length)));
    } catch { this.rawBreakPoints.set([]); }
  }

  open(dlg: Dlg, mode: 'create' | 'edit' = 'edit'): void { this.mode.set(mode); this.dlg.set(dlg); }

  editEpisode(i: number): void { this.epIndex.set(i); this.open('episode'); }

  /** After any change: reload the list, the series and its episodes. */
  async reload(selectId?: number): Promise<void> {
    this.dlg.set(null);
    const id = selectId ?? this.detail()?.id;
    await this.loadList(undefined, id);
    if (id) {
      await this.loadDetail(id, !selectId);
      const number = this.seasonNumbers()[this.season()];
      if (number !== undefined) await this.loadEpisodes(id, number);
      const ep = this.ep();
      if (ep) await this.loadBreakPoints(ep.id);
    }
  }

  async scan(): Promise<void> {
    const id = this.detail()?.id;
    if (!id) return;
    try {
      const r = await this.admin.scan(id);
      this.notice.set(`Carpeta escaneada: ${r.imported} importados · ${r.markedMissing} sin archivo · ${r.pending} esperan transcodificación.`);
      await this.reload();
    } catch (error) {
      this.error.set(errorMessage(error, 'No se pudo escanear la carpeta.'));
    }
  }

  private ask(heading: string, message: string, label: string, action: () => Promise<unknown>): void {
    this.confirm.set({ heading, message, label, action });
    this.dlg.set('confirm');
  }

  async runConfirm(): Promise<void> {
    try {
      await this.confirm().action();
    } catch (error) {
      this.error.set(errorMessage(error));
    }
  }

  removeEpisode(i: number): void {
    const e = this.episodes()[i];
    if (!e) return;
    this.ask(`¿Eliminar ${e.num} · ${e.title}?`, 'Se quitará de la programación futura y se borrarán sus puntos de corte.', 'Eliminar episodio',
      async () => { await this.admin.deleteEpisode(e.id); await this.reload(); });
  }

  removeBreakPoint(id: number): void {
    const ep = this.ep();
    if (!ep) return;
    this.ask('¿Eliminar este punto de corte?', 'Los próximos programas de este episodio se generarán sin este corte.', 'Eliminar punto',
      async () => { await this.admin.deleteBreakPoint(ep.id, id); await this.loadBreakPoints(ep.id); });
  }

  removeSeason(): void {
    const d = this.detail(), number = this.seasonNumbers()[this.season()];
    if (!d || number === undefined) return;
    this.ask(`¿Eliminar la temporada ${number === 0 ? 'de especiales' : 'T' + number}?`, 'Solo se puede eliminar una temporada sin episodios.', 'Eliminar temporada',
      async () => { await this.admin.removeSeason(d.id, number); this.season.set(0); await this.reload(); });
  }

  deleteSeries(): void {
    const d = this.detail();
    if (!d) return;
    this.ask(`¿Eliminar la serie ${d.name}?`, 'Se ocultará del catálogo y de todas las eras donde está asignada. Los archivos en disco no se borran.', 'Eliminar serie',
      async () => { await this.admin.deleteSeries(d.id); this.seriesIndex.set(0); await this.loadList(); });
  }

}
