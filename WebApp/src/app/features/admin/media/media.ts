import { Component, computed, DestroyRef, effect, inject, signal, untracked } from '@angular/core';
import { AdminApi } from '../../../core/api/admin-api';
import { errorMessage } from '../../../core/api/api';
import { MediaStatus } from '../../../core/api/models';
import { ago } from '../../../core/data/public-data';
import { ConfirmDialog } from '../../../shared/ui/confirm-dialog';
import { PageHeader } from '../../../shared/ui/page-header';
import { ClearQueueDialog } from './clear-queue-dialog';

const C: Record<string, [string, string]> = {
  Queued: ['EN COLA', '#A29E91'], Processing: ['PROCESANDO', '#6FD0EA'], Completed: ['COMPLETADO', '#8BE08F'],
  Failed: ['FALLIDO', '#FF8A80'], Skipped: ['OMITIDO', '#8C887D'],
};
const TABS: [string, string][] = [['Pendientes', 'pending'], ['Todos', 'all'], ['En cola', 'Queued'], ['Procesando', 'Processing'], ['Completados', 'Completed'], ['Fallidos', 'Failed'], ['Omitidos', 'Skipped']];
const fmt = (n: number) => n.toLocaleString('es');
const size = (bytes: number) => bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(1)} GB` : `${Math.round(bytes / 1024 ** 2)} MB`;
const clock = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
const minuteOf = (value: string) => { const [h, m] = value.split(':').map(Number); return (h || 0) * 60 + (m || 0); };

@Component({
  selector: 'app-media',
  imports: [PageHeader, ConfirmDialog, ClearQueueDialog],
  host: { class: 'flex flex-col gap-6' },
  templateUrl: './media.html',
})
export class Media {
  private readonly admin = inject(AdminApi);
  readonly status = signal<MediaStatus | null>(null);
  readonly tab = signal(0);
  readonly worker = signal('all');
  readonly page = signal(1);
  readonly pageSize = signal(20);
  readonly sel = signal<Set<number>>(new Set());
  readonly dlg = signal<'clear' | 'delete' | null>(null);
  readonly error = signal('');
  readonly notice = signal('');

  readonly counts = computed<Partial<Record<string, number>>>(() => this.status()?.counts ?? {});
  readonly tabs = computed(() => {
    const c = this.counts();
    const total = Object.values(c).reduce<number>((a, b) => a + (b ?? 0), 0);
    return TABS.map(([label, key]) => [label, key, key === 'all' ? total : key === 'pending' ? (c['Queued'] ?? 0) + (c['Processing'] ?? 0) : c[key] ?? 0] as [string, string, number]);
  });
  readonly failed = computed(() => this.counts()['Failed'] ?? 0);

  readonly workers = computed(() => (this.status()?.workers ?? []).map(w => {
    const running = (this.status()?.jobs ?? []).filter(j => j.worker === w.id && j.status === 'Processing').length;
    return {
      id: w.id, enabled: w.enabled, color: !w.enabled ? '#A29E91' : w.online ? '#8BE08F' : '#FF6B5E',
      beat: !w.enabled ? 'Deshabilitado' : w.heartbeatUtc ? `Latido ${ago(w.heartbeatUtc)}${w.online ? '' : ' · sin conexión'}` : 'Sin latido',
      load: `${running} ${running === 1 ? 'job' : 'jobs'} en proceso`,
    };
  }));

  readonly resources = computed(() => this.status()?.resources ?? null);
  /** Day/night bar across 24 h. */
  readonly bands = computed(() => {
    const r = this.resources();
    if (!r || !r.nightEnabled) return [{ w: 24, label: `DÍA · ${r?.dayCores ?? 1} núcleos`, night: false }];
    const start = r.nightStartMinute / 60, end = r.nightEndMinute / 60;
    const night = `NOCHE · ${r.nightCores}`, day = `DÍA · ${r.dayCores} núcleos`;
    return start > end
      ? [{ w: end, label: night, night: true }, { w: start - end, label: day, night: false }, { w: 24 - start, label: '', night: true }]
      : [{ w: start, label: day, night: false }, { w: end - start, label: night, night: true }, { w: 24 - end, label: '', night: false }];
  });
  readonly dayCores = signal(1);
  readonly nightCores = signal(2);
  readonly nightEnabled = signal(false);
  readonly nightStart = signal('23:00');
  readonly nightEnd = signal('06:00');

  readonly jobs = computed(() => (this.status()?.jobs ?? []).map(j => ({
    id: j.id, series: j.seriesName, worker: j.worker, path: j.sourcePath, size: size(j.sourceSize), progress: Math.round(j.progress),
    msg: j.message ?? '—', status: C[j.status]?.[0] ?? j.status, color: C[j.status]?.[1] ?? '#A29E91', selected: this.sel().has(j.id), processing: j.status === 'Processing',
  })));
  readonly total = computed(() => this.status()?.totalJobs ?? 0);
  readonly matching = computed(() => fmt(this.total()));
  readonly selCount = computed(() => fmt(this.sel().size));
  readonly allOnPage = computed(() => this.jobs().length > 0 && this.jobs().every(j => j.selected));
  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));
  readonly pages = computed(() => {
    const n = this.pageCount(), p = this.page();
    const list = [...new Set([1, p - 1, p, p + 1, n].filter(x => x >= 1 && x <= n))].sort((a, b) => a - b);
    return list.flatMap((x, i) => (i && x - list[i - 1] > 1 ? ['…', String(x)] : [String(x)]));
  });
  readonly range = computed(() => {
    const from = this.total() ? (this.page() - 1) * this.pageSize() + 1 : 0;
    return `${from}–${Math.min(this.total(), this.page() * this.pageSize())}`;
  });

  constructor() {
    effect(() => {
      const view = TABS[this.tab()][1], worker = this.worker(), page = this.page(), pageSize = this.pageSize();
      untracked(() => this.load(view, worker, page, pageSize));
    });
    const timer = setInterval(() => this.load(), 10_000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  async load(view = TABS[this.tab()][1], worker = this.worker(), page = this.page(), pageSize = this.pageSize()): Promise<void> {
    try {
      const first = !this.status();
      const status = await this.admin.media(worker, view, page, pageSize);
      this.status.set(status);
      if (first) {
        const r = status.resources;
        this.dayCores.set(r.dayCores); this.nightCores.set(r.nightCores); this.nightEnabled.set(r.nightEnabled);
        this.nightStart.set(clock(r.nightStartMinute)); this.nightEnd.set(clock(r.nightEndMinute));
      }
      this.error.set('');
    } catch (error) {
      this.error.set(errorMessage(error, 'No se pudo cargar la cola de media.'));
    }
  }

  pickTab(i: number): void { this.tab.set(i); this.page.set(1); this.clearSel(); }
  toggle(id: number): void { this.sel.update(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }
  togglePage(): void {
    const value = !this.allOnPage();
    this.sel.update(s => { const n = new Set(s); for (const j of this.jobs()) { if (value && !j.processing) n.add(j.id); else n.delete(j.id); } return n; });
  }
  clearSel(): void { this.sel.set(new Set()); }

  async toggleWorker(id: string, enabled: boolean): Promise<void> {
    try { await this.admin.setWorker(id, !enabled); await this.load(); }
    catch (error) { this.error.set(errorMessage(error, 'No se pudo cambiar el worker.')); }
  }

  async saveResources(): Promise<void> {
    try {
      await this.admin.setResources({ dayCores: this.dayCores(), nightCores: this.nightCores(), nightEnabled: this.nightEnabled(), nightStartMinute: minuteOf(this.nightStart()), nightEndMinute: minuteOf(this.nightEnd()) });
      this.notice.set('Política de recursos guardada.');
      await this.load();
    } catch (error) {
      this.error.set(errorMessage(error, 'No se pudo guardar la política de recursos.'));
    }
  }

  async retry(ids?: number[]): Promise<void> {
    try {
      const jobIds = ids ?? (await this.admin.media(this.worker(), 'Failed', 1, 100)).jobs.map(j => j.id);
      if (!jobIds.length) return;
      await this.admin.retryJobs(jobIds);
      this.notice.set(`${jobIds.length} jobs vuelven a la cola.`);
      this.clearSel();
      await this.load();
    } catch (error) {
      this.error.set(errorMessage(error, 'No se pudieron reintentar los jobs.'));
    }
  }

  async deleteSelected(): Promise<void> {
    try {
      await this.admin.deleteJobs([...this.sel()]);
      this.clearSel();
      await this.load();
    } catch (error) {
      this.error.set(errorMessage(error, 'No se pudieron eliminar los jobs.'));
    }
  }

  async cleared(count: number): Promise<void> {
    this.dlg.set(null);
    this.notice.set(`${fmt(count)} jobs eliminados.`);
    await this.load();
  }

  retrySelected(): void { this.retry([...this.sel()]); }
}
