import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, exhaustMap, of, timer } from 'rxjs';
import { MediaStatus, MediaWorker, TranscodingService, WorkerId } from './transcoding.service';

@Component({
  selector: 'app-transcoding',
  imports: [DatePipe, DecimalPipe],
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
  readonly jobs = computed(() => this.status()?.jobs.filter(job => this.filter() === 'all' || job.worker === this.filter()) ?? []);
  readonly workers: { id: WorkerId; title: string; icon: string; description: string }[] = [
    { id: 'transcode', title: 'Convertir videos', icon: 'video_settings', description: 'MP4 · H.264 · AAC. Una conversión a la vez, sin borrar el original.' },
    { id: 'index', title: 'Actualizar videoteca', icon: 'video_library', description: 'Detecta episodios compatibles en las carpetas de cada serie y los incorpora al catálogo.' },
  ];

  constructor() {
    timer(0, 5000).pipe(
      exhaustMap(() => this.service.getStatus().pipe(catchError(() => of(null)))),
      takeUntilDestroyed(),
    ).subscribe(status => { this.error.set(status === null); if (status) this.status.set(status); });
  }

  worker(id: WorkerId): MediaWorker | undefined { return this.status()?.workers.find(worker => worker.id === id); }
  online(id: WorkerId): boolean {
    const heartbeat = this.worker(id)?.heartbeatUtc;
    return !!heartbeat && Date.now() - new Date(heartbeat).getTime() < (this.status()?.heartbeatToleranceSeconds ?? 180) * 1000;
  }
  count(id: WorkerId, statuses: string[]): number {
    return this.status()?.counts.filter(item => item.worker === id && statuses.includes(item.status)).reduce((total, item) => total + item.count, 0) ?? 0;
  }
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
    this.service.getStatus().subscribe({ next: status => { this.status.set(status); this.error.set(false); }, error: () => this.error.set(true) });
  }
}
