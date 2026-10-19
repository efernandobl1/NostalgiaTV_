import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminApi } from '../../../core/api/admin-api';
import { DashboardSummary, MediaStatus } from '../../../core/api/models';
import { ago, channelNumber, episodeCode, hhmm, years } from '../../../core/data/public-data';
import { Session } from '../../../core/session';
import { PageHeader } from '../../../shared/ui/page-header';

const amber = '#FFB547', cyan = '#6FD0EA', green = '#8BE08F', red = '#FF6B5E', muted = '#A29E91';
const JOB_COLORS: Record<string, string> = { Processing: cyan, Failed: red, Queued: muted, Completed: green, Skipped: muted };
const JOB_LABELS: Record<string, string> = { Processing: 'PROCESANDO', Failed: 'FALLIDO', Queued: 'EN COLA', Completed: 'COMPLETADO', Skipped: 'OMITIDO' };

function n(value: number): string { return value.toLocaleString('es').replace(/\./g, ' '); }
function clockOf(minute: number): string { return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`; }

@Component({
  selector: 'app-summary',
  imports: [RouterLink, PageHeader],
  host: { class: 'flex flex-col gap-7' },
  templateUrl: './summary.html',
})
export class Summary {
  private readonly admin = inject(AdminApi);
  private readonly session = inject(Session);
  readonly summary = signal<DashboardSummary | null>(null);
  readonly media = signal<MediaStatus | null>(null);
  readonly error = signal('');
  private readonly now = signal(Date.now());

  readonly today = computed(() => {
    const date = new Date(this.now());
    const day = date.toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '').toUpperCase();
    return `${day} · ${hhmm(date.toISOString())} · ${this.session.settings()?.timeZoneId ?? ''}`;
  });

  readonly d = computed(() => {
    const s = this.summary();
    const m = this.media();
    const jobsNote = m ? `${m.counts['Processing'] ?? 0} procesando · ${m.counts['Failed'] ?? 0} fallidos` : `${s?.failedMediaJobs ?? 0} fallidos`;
    const resources = m?.resources;
    return {
      kpis: [
        { label: 'CANALES AL AIRE', value: n(s?.liveChannelCount ?? 0), unit: `/ ${s?.channelCount ?? 0}`, note: s && s.channelCount > s.liveChannelCount ? `${s.channelCount - s.liveChannelCount} sin programación` : 'Todos los canales emiten', color: '#ECE8DC', href: '/admin/canales' },
        { label: 'EPISODIOS DISPONIBLES', value: n((s?.episodeCount ?? 0) - (s?.missingEpisodeFiles ?? 0)), unit: `/ ${n(s?.episodeCount ?? 0)}`, note: `${s?.missingEpisodeFiles ?? 0} sin archivo · ${s?.seriesCount ?? 0} series`, color: '#ECE8DC', href: '/admin/series' },
        { label: 'COLA DE MEDIA', value: n(s?.queuedMediaJobs ?? 0), unit: 'jobs', note: jobsNote, color: cyan, href: '/admin/media' },
        { label: 'COMENTARIOS PENDIENTES', value: n(s?.pendingComments ?? 0), unit: '', note: 'Esperan moderación', color: amber, href: '/admin/comentarios' },
      ],
      channels: (s?.channels ?? []).map(c => {
        const on = !!c.now;
        return {
          status: on ? 'AL AIRE' : c.activeEraId ? 'SIN SEÑAL' : 'SIN ERA', statusInk: on ? '#1A0906' : '#ECE8DC', statusBg: on ? red : '#3A3A33',
          code: `CH ${channelNumber(c.id)}`, name: c.name, era: c.activeEraName ?? 'sin seleccionar',
          nowCode: c.now ? (c.now.kind === 'Episode' ? episodeCode(c.now.seasonNumber, c.now.episodeNumber, null, c.now.episodePart) || 'AL AIRE' : 'INTERLUDIO') : 'FUERA DEL AIRE',
          nowTitle: c.now ? c.now.seriesName ?? c.now.title : c.activeEraId ? 'Sin programación' : 'Selecciona una era para emitir',
          pct: c.now ? Math.round(c.now.progress * 100) : 0,
          next: c.now ? `TERMINA ${hhmm(c.now.endsAtUtc)} · ${c.seriesCount} series` : `${years(c.startDate, c.endDate)} · ${c.eraCount} eras`,
        };
      }),
      jobs: (m?.jobs ?? []).slice(0, 5).map(j => ({
        series: j.seriesName, worker: j.worker, file: j.sourcePath,
        status: j.status === 'Processing' ? `PROCESANDO ${Math.round(j.progress)}%` : JOB_LABELS[j.status] ?? j.status.toUpperCase(),
        progress: j.status === 'Failed' ? 100 : Math.round(j.progress), color: JOB_COLORS[j.status] ?? muted,
      })),
      activity: (s?.latestActivity ?? []).map(a => ({ time: hhmm(a.createdAtUtc), user: a.user, action: a.description || a.action, resource: a.resource })),
      workers: (m?.workers ?? []).map(w => ({
        id: w.id, color: !w.enabled ? muted : w.online ? green : red,
        state: !w.enabled ? 'Pausado' : w.online ? `Activo · latido ${ago(w.heartbeatUtc)}` : 'Sin conexión',
      })),
      resources: resources
        ? `Ahora: modo ${resources.nightNow ? 'nocturno' : 'diurno'} · ${resources.currentCores} núcleos` +
          (resources.nightEnabled ? ` — nocturno ${clockOf(resources.nightStartMinute)}–${clockOf(resources.nightEndMinute)} · ${resources.nightCores} núcleos` : '')
        : 'Sin permiso para ver la cola de media.',
    };
  });

  constructor() {
    this.load();
    const timer = setInterval(() => { this.now.set(Date.now()); this.load(); }, 30_000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  private async load(): Promise<void> {
    try {
      this.summary.set(await this.admin.summary());
      this.error.set('');
    } catch {
      this.error.set('No se pudo cargar el resumen.');
    }
    if (this.session.canOpen('/admin/media')) this.admin.media('all', 'pending', 1, 5).then(m => this.media.set(m)).catch(() => {});
  }
}
