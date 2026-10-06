import { Component, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BroadcastAdminService, BreakPoint } from '../broadcast-admin.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-break-points',
  imports: [FormsModule],
  template: `
    <section class="studio-page">
      @if (filePath()) {
        <video
          #preview
          [src]="mediaUrl()"
          controls
          playsinline
          preload="metadata"
          (loadedmetadata)="duration.set(preview.duration)"
        ></video>
      }
      <div>
        <h3>Puntos de corte publicitario</h3>
        <p>
          Marca el momento en que el canal puede pausar el episodio. La era decide qué anuncios
          reproducir.
        </p>
      </div>
      @if (loading()) {
        <p role="status">Cargando puntos de corte…</p>
      }
      @for (point of points(); track point.id) {
        <div class="point-row">
          <strong>{{ time(point.offsetSeconds) }}</strong
          ><span>{{ point.label || 'Pausa publicitaria' }}</span
          ><button
            class="admin-button admin-button--secondary"
            type="button"
            [disabled]="busy()"
            (click)="remove(point)"
            [attr.aria-label]="'Eliminar corte en ' + time(point.offsetSeconds)"
          >
            Eliminar
          </button>
        </div>
      }
      <form class="point-form" (ngSubmit)="add()">
        <label class="studio-field"
          >Tiempo (min:seg)<input
            name="position"
            [(ngModel)]="position"
            placeholder="08:30"
            required
            pattern="[0-9]+:[0-5][0-9]" /></label
        ><label class="studio-field"
          >Etiqueta opcional<input
            name="label"
            [(ngModel)]="label"
            maxlength="200"
            placeholder="Fin de la primera parte" /></label
        ><button class="admin-button" type="submit" [disabled]="busy() || loading()">
          Añadir corte
        </button>
      </form>
      <p class="studio-muted">
        Regenera la programación del canal después de añadir cortes. No se altera el archivo
        original.
      </p>
      @if (error()) {
        <p class="studio-error" role="alert">{{ error() }}</p>
      }
    </section>
  `,
  styles: `
    @use '../../../../styles/dashboard-components';
    .point-row {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 12px 0;
      border-bottom: 1px solid var(--dashboard-border);
      span {
        flex: 1;
        overflow-wrap: anywhere;
      }
      strong {
        color: var(--dashboard-yellow);
        font:
          24px/1 VT323,
          monospace;
      }
    }
    .point-form {
      display: grid;
      grid-template-columns: 150px 1fr auto;
      gap: 14px;
      align-items: end;
    }
    @media (max-width: 600px) {
      .point-form {
        grid-template-columns: 1fr;
      }
      .point-row {
        flex-wrap: wrap;
      }
    }
  `,
})
export class BreakPointsComponent {
  readonly episodeId = input.required<number>();
  readonly filePath = input<string>();
  private readonly service = inject(BroadcastAdminService);
  readonly points = signal<BreakPoint[]>([]);
  readonly duration = signal(0);
  readonly busy = signal(false);
  readonly loading = signal(true);
  readonly error = signal('');
  position = '';
  label = '';
  constructor() {
    effect(() => {
      const id = this.episodeId();
      this.loading.set(true);
      this.points.set([]);
      this.error.set('');
      this.service.getBreakPoints(id).subscribe({
        next: (points) => {
          if (id === this.episodeId()) {
            this.points.set(points);
            this.loading.set(false);
          }
        },
        error: () => {
          this.loading.set(false);
          this.error.set('No se pudieron cargar los puntos de corte.');
        },
      });
    });
  }
  mediaUrl(): string {
    return (
      environment.apiUrl +
      '/' +
      (this.filePath() ?? '').replace(/^\/?wwwroot\//, '').replace(/^\//, '')
    );
  }
  time(seconds: number): string {
    return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
  }
  add(): void {
    const match = /^(\d+):([0-5]\d)$/.exec(this.position);
    const seconds = match ? Number(match[1]) * 60 + Number(match[2]) : 0;
    if (!seconds || seconds > 86400 || (this.duration() && seconds >= this.duration())) {
      this.error.set('Introduce un tiempo válido dentro de la duración del episodio.');
      return;
    }
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.service.addBreakPoint(this.episodeId(), seconds, this.label).subscribe({
      next: (point) => {
        this.points.update((points) =>
          [...points, point].sort((a, b) => a.offsetSeconds - b.offsetSeconds),
        );
        this.busy.set(false);
        this.position = '';
        this.label = '';
      },
      error: () => {
        this.busy.set(false);
        this.error.set('No se pudo añadir el corte. Comprueba que no exista en ese segundo.');
      },
    });
  }
  remove(point: BreakPoint): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.service.deleteBreakPoint(this.episodeId(), point.id).subscribe({
      next: () => {
        this.points.update((points) => points.filter((item) => item.id !== point.id));
        this.busy.set(false);
      },
      error: () => {
        this.busy.set(false);
        this.error.set('No se pudo eliminar el corte.');
      },
    });
  }
}
