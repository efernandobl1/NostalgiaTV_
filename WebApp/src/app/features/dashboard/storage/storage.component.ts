import { Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DashboardService } from '../dashboard.service';
import { StorageResponse } from '../../../shared/models/dashboard.model';

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) return 'No disponible';
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** unit).toFixed(unit ? 1 : 0)} ${units[unit]}`;
}

@Component({
  selector: 'app-storage',
  imports: [DatePipe, RouterLink],
  templateUrl: './storage.component.html',
  styleUrl: './storage.component.scss',
})
export class StorageComponent {
  readonly showSeries = input(false);
  readonly loaded = output<StorageResponse>();
  readonly storage = signal<StorageResponse | null>(null);
  readonly loading = signal(false);
  readonly error = signal(false);
  readonly usedPercent = computed(() => {
    const data = this.storage();
    return data?.totalBytes && data.usedBytes != null
      ? Math.min(100, Math.max(0, (data.usedBytes / data.totalBytes) * 100))
      : null;
  });
  readonly size = formatBytes;
  private readonly service = inject(DashboardService);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    this.refresh();
  }

  refresh(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set(false);
    this.service
      .getStorage()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.storage.set(data);
          this.loaded.emit(data);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(true);
          this.storage.set(null);
          this.loading.set(false);
        },
      });
  }
}
