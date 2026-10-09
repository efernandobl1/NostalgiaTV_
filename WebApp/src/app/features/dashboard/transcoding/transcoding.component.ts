import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, exhaustMap, merge, of, Subject, switchMap, tap, timer } from 'rxjs';
import { JobView, MediaStatus, MediaWorker, ResourcePolicy, TranscodingService, WorkerId } from './transcoding.service';

@Component({
  selector: 'app-transcoding',
  imports: [DatePipe, DecimalPipe, FormsModule],
  templateUrl: './transcoding.component.html',
  styleUrl: './transcoding.component.scss',
})
export class TranscodingComponent {
  private readonly service = inject(TranscodingService);
  readonly status = signal<MediaStatus | null>(null);
  readonly error = signal(false);
  readonly actionError = signal('');
  readonly busy = signal<string | number | null>(null);
  readonly filter = signal<WorkerId | 'all'>('all');
  readonly view = signal<JobView>('pending');
  readonly page = signal(1);
  readonly jobsLoading = signal(true);
  private readonly refreshRequests = new Subject<void>();
  private readonly query = computed(() => ({ worker: this.filter(), view: this.view(), page: this.page(), pageSize: 20 }));
  readonly views: { id: JobView; title: string; statuses: string[] }[] = [
    { id: 'pending', title: 'Pendientes', statuses: ['Queued', 'Processing'] },
    { id: 'Completed', title: 'Completados', statuses: ['Completed'] },
    { id: 'Skipped', title: 'Omitidos', statuses: ['Skipped'] },
    { id: 'Failed', title: 'Errores', statuses: ['Failed'] },
    { id: 'all', title: 'Todos', statuses: [] },
  ];
  resourceDraft: ResourcePolicy | null = null;
  startTime = '00:00';
  endTime = '05:00';
  readonly resourcesSaving = signal(false);
  readonly resourcesMessage = signal('');
  readonly jobs = computed(() => this.status()?.jobs ?? []);
  readonly currentPage = computed(() => this.status()?.page ?? 1);
  readonly totalPages = computed(() => Math.max(1, Math.ceil((this.status()?.jobsTotal ?? 0) / 20)));
  readonly firstJob = computed(() => this.jobs().length ? (this.currentPage() - 1) * 20 + 1 : 0);
  readonly lastJob = computed(() => this.jobs().length ? this.firstJob() + this.jobs().length - 1 : 0);
  readonly emptyTitle = computed(() => ({ pending: 'No hay archivos pendientes.', Completed: 'No hay trabajos completados.',
    Skipped: 'No hay archivos omitidos.', Failed: 'No hay errores en este servicio.', all: 'No hay trabajos registrados.' })[this.view()]);
  readonly workers: { id: WorkerId; title: string; icon: string; description: string }[] = [
    { id: 'transcode', title: 'Convertir videos', icon: 'video_settings', description: 'MP4 · H.264 · AAC. Una conversión a la vez, sin borrar el original.' },
    { id: 'index', title: 'Actualizar videoteca', icon: 'video_library', description: 'Detecta episodios compatibles en las carpetas de cada serie y los incorpora al catálogo.' },
  ];

  constructor() {
    toObservable(this.query).pipe(
      tap(() => this.jobsLoading.set(true)),
      switchMap(query => merge(timer(0, 5000), this.refreshRequests).pipe(
        exhaustMap(() => this.service.getStatus(query).pipe(catchError(() => of(null)))),
      )),
      takeUntilDestroyed(),
    ).subscribe(status => {
      this.error.set(status === null);
      this.jobsLoading.set(false);
      if (status) {
        this.status.set(status);
        if (!this.resourceDraft && status.resourcePolicy) {
          this.resourceDraft = { ...status.resourcePolicy };
          this.startTime = this.time(status.resourcePolicy.nightStartMinute);
          this.endTime = this.time(status.resourcePolicy.nightEndMinute);
        }
      }
    });
  }

  private time(minutes: number): string { return `${Math.floor(minutes / 60).toString().padStart(2, '0')}:${(minutes % 60).toString().padStart(2, '0')}`; }
  saveResources(): void {
    if (!this.resourceDraft || this.resourcesSaving()) return;
    if (!/^\d{2}:\d{2}$/.test(this.startTime) || !/^\d{2}:\d{2}$/.test(this.endTime) || this.startTime === this.endTime) {
      this.actionError.set('Selecciona horas de inicio y fin distintas.'); return;
    }
    const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
    this.resourcesSaving.set(true); this.resourcesMessage.set(''); this.actionError.set('');
    this.service.saveResources({ ...this.resourceDraft, nightStartMinute: minutes(this.startTime), nightEndMinute: minutes(this.endTime) }).subscribe({
      next: () => { this.resourcesSaving.set(false); this.resourcesMessage.set('Horario guardado. El servicio lo aplica en unos segundos.'); this.refresh(); },
      error: () => { this.resourcesSaving.set(false); this.actionError.set('No se pudo guardar. Revisa los núcleos, el horario y la zona horaria.'); },
    });
  }

  worker(id: WorkerId): MediaWorker | undefined { return this.status()?.workers.find(worker => worker.id === id); }
  online(id: WorkerId): boolean {
    const heartbeat = this.worker(id)?.heartbeatUtc;
    return !!heartbeat && Date.now() - new Date(heartbeat).getTime() < (this.status()?.heartbeatToleranceSeconds ?? 180) * 1000;
  }
  count(id: WorkerId, statuses: string[]): number {
    return this.status()?.counts.filter(item => item.worker === id && statuses.includes(item.status)).reduce((total, item) => total + item.count, 0) ?? 0;
  }
  viewCount(statuses: string[]): number {
    return this.status()?.counts.filter(item => (this.filter() === 'all' || item.worker === this.filter()) &&
      (!statuses.length || statuses.includes(item.status))).reduce((total, item) => total + item.count, 0) ?? 0;
  }
  selectWorker(worker: WorkerId | 'all'): void { this.filter.set(worker); this.page.set(1); }
  selectView(view: JobView): void { this.view.set(view); this.page.set(1); }
  changePage(page: number): void { this.page.set(page); }
  filename(path: string): string { return path.split('/').pop() || path; }
  stateLabel(id: WorkerId): string {
    if (!this.online(id)) return 'Worker sin conexión';
    if (!this.worker(id)?.enabled) return this.count(id, ['Processing']) ? 'Terminando archivo actual' : 'En pausa';
    return this.count(id, ['Processing']) ? 'Procesando' : 'Esperando archivos';
  }
  label(status: string): string {
    return ({ Queued: 'En cola', Processing: 'Procesando', Completed: 'Completado', Skipped: 'Omitido', Failed: 'Error' } as Record<string, string>)[status] ?? status;
  }
  size(bytes: number): string { return bytes >= 1073741824 ? `${(bytes / 1073741824).toFixed(1)} GB` : `${(bytes / 1048576).toFixed(1)} MB`; }
  toggle(id: WorkerId): void {
    if (this.busy() !== null || this.error()) return;
    this.busy.set(id); this.actionError.set('');
    this.service.setEnabled(id, !this.worker(id)?.enabled).subscribe({
      next: () => { this.busy.set(null); this.refresh(); },
      error: () => { this.busy.set(null); this.actionError.set('No se pudo cambiar el servicio. Reintenta.'); },
    });
  }
  retry(id: number): void {
    if (this.busy() !== null) return;
    this.busy.set(id); this.actionError.set('');
    this.service.retry(id).subscribe({
      next: () => { this.busy.set(null); this.refresh(); },
      error: () => { this.busy.set(null); this.actionError.set('No se pudo reintentar el archivo. Comprueba su estado.'); },
    });
  }
  refresh(): void {
    this.refreshRequests.next();
  }
}
