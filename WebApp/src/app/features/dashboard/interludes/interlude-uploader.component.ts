import { Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { HttpEventType, HttpResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, firstValueFrom, tap } from 'rxjs';
import {
  BroadcastAdminService,
  Interlude,
  InterludeSeason,
  INTERLUDE_SEASONS,
} from '../broadcast-admin.service';

interface UploadItem {
  file: File;
  status: 'queued' | 'uploading' | 'assigning' | 'completed' | 'failed';
  progress: number;
  clip?: Interlude;
  message?: string;
}

@Component({
  selector: 'app-interlude-uploader',
  templateUrl: './interlude-uploader.component.html',
  styleUrl: './interlude-uploader.component.scss',
})
export class InterludeUploaderComponent {
  readonly kind = input<0 | 1>(0);
  readonly season = input<InterludeSeason>(0);
  readonly eraId = input<number | null>(null);
  readonly role = input<0 | 1 | 2>(0);
  readonly seasons = INTERLUDE_SEASONS;
  readonly seasonOverride = signal<InterludeSeason | null>(null);
  readonly effectiveSeason = computed(() => this.seasonOverride() ?? this.season());
  readonly busyChange = output<boolean>();
  readonly completed = output<Interlude[]>();
  readonly busy = signal(false);
  readonly items = signal<UploadItem[]>([]);
  readonly error = signal('');
  readonly hasFailed = computed(() => this.items().some((item) => item.status === 'failed'));
  private readonly service = inject(BroadcastAdminService);
  private readonly destroyRef = inject(DestroyRef);

  choose(event: Event): void {
    if (this.busy()) return;
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (!files.length) return;
    if (files.length > 30 || files.reduce((size, file) => size + file.size, 0) > 2_147_483_648) {
      this.error.set('Selecciona hasta 30 archivos y 2 GiB por tanda.');
      return;
    }
    if (files.some((file) => !/\.mp4$/i.test(file.name) || !file.size || file.size > 524_288_000)) {
      this.error.set('Cada archivo debe ser MP4, no vacío y de hasta 500 MiB.');
      return;
    }
    this.error.set('');
    this.items.set(files.map((file) => ({ file, status: 'queued', progress: 0 })));
    void this.run(this.items());
  }

  retry(): void {
    if (!this.busy()) void this.run(this.items().filter((item) => item.status === 'failed'));
  }
  chooseSeason(event: Event): void {
    const season = Number((event.target as HTMLSelectElement).value);
    if (!this.busy() && (season === 0 || season === 1 || season === 2))
      this.seasonOverride.set(season);
  }

  private update(item: UploadItem, changes: Partial<UploadItem>): void {
    Object.assign(item, changes);
    this.items.update((items) => [...items]);
  }

  private async run(items: UploadItem[]): Promise<void> {
    if (!items.length || this.destroyRef.destroyed) return;
    this.busy.set(true);
    this.busyChange.emit(true);
    // Snapshot the destination so all files in this batch use the same era and season.
    const eraId = this.eraId();
    const kind = this.kind();
    const season = this.effectiveSeason();
    const role = this.role();
    const completed: Interlude[] = [];
    try {
      for (const item of items) {
        if (this.destroyRef.destroyed) break;
        this.update(item, { message: undefined });
        try {
          if (!item.clip) {
            this.update(item, { status: 'uploading', progress: 0 });
            const body = new FormData();
            body.append('file', item.file);
            body.append('kind', String(kind));
            body.append('season', String(season));
            const response = await firstValueFrom(
              this.service.uploadInterludeWithProgress(body).pipe(
                takeUntilDestroyed(this.destroyRef),
                tap((event) => {
                  if (event.type === HttpEventType.UploadProgress)
                    this.update(item, {
                      progress: Math.min(
                        100,
                        Math.round((event.loaded / (event.total || item.file.size)) * 100),
                      ),
                    });
                }),
                filter((event): event is HttpResponse<Interlude> => event instanceof HttpResponse),
              ),
            );
            if (!response.body) throw new Error('Missing upload response');
            item.clip = response.body;
          }
          if (eraId) {
            this.update(item, { status: 'assigning', progress: 100 });
            await firstValueFrom(
              this.service
                .assign(eraId, item.clip.id, role, 1, role === 1 ? 3600 : 0)
                .pipe(takeUntilDestroyed(this.destroyRef)),
            );
          }
          this.update(item, { status: 'completed', progress: 100 });
          completed.push(item.clip);
        } catch {
          if (this.destroyRef.destroyed) break;
          this.update(item, {
            status: 'failed',
            message: item.clip
              ? 'El archivo se guardó, pero no se pudo añadir a la era. Reintenta sin volver a subirlo.'
              : 'No se pudo subir. Comprueba que usa video H.264 y audio AAC e inténtalo nuevamente.',
          });
        }
      }
    } finally {
      if (!this.destroyRef.destroyed) {
        this.busy.set(false);
        this.busyChange.emit(false);
        this.completed.emit(completed);
      }
    }
  }
}
