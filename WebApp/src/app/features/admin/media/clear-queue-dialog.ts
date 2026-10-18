import { Component, computed, inject, input, output, signal } from '@angular/core';
import { AdminApi } from '../../../core/api/admin-api';
import { errorMessage } from '../../../core/api/api';
import { SeriesListItem } from '../../../core/api/models';
import { Dialog } from '../../../shared/ui/dialog';

const DEFS: [string, string, string, string][] = [
  ['Completed', 'Completados', 'Solo borra el registro, no el archivo de salida', '#8BE08F'],
  ['Skipped', 'Omitidos', 'Archivos sin cambios desde el último análisis', '#8C887D'],
  ['Failed', 'Fallidos', 'Se pierde el mensaje de error', '#FF8A80'],
  ['Queued', 'En cola (cancelar)', 'Se vuelven a crear al escanear la carpeta', '#A29E91'],
];

/** Design: "Diálogo · Limpiar cola" — typed confirmation before bulk delete. */
@Component({
  selector: 'app-clear-queue-dialog',
  imports: [Dialog],
  template: `
    <app-dialog eyebrow="PROCESAMIENTO DE MEDIA" heading="Limpiar cola" gap="gap-4" (closed)="closed.emit()">
      <fieldset class="m-0 p-0 border-0 flex flex-col gap-1.5">
        <legend class="pb-2 text-[12px] text-muted">Qué jobs eliminar</legend>
        @for (s of defs; track s[0]) {
          <label class="flex items-center gap-3 min-h-12 px-3 border border-line rounded-md cursor-pointer">
            <input class="check" type="checkbox" [checked]="on()[s[0]]" (change)="toggle(s[0])">
            <span class="flex-1 flex flex-col gap-0.5">
              <span class="text-[14px]">{{ s[1] }}</span>
              <span class="text-[12px] text-muted">{{ s[2] }}</span>
            </span>
            <span class="font-mono text-[13px]" [style.color]="s[3]">{{ fmt(counts()[s[0]] ?? 0) }}</span>
          </label>
        }
        <span class="text-[12px] text-dim">Los jobs en procesamiento ({{ counts()['Processing'] ?? 0 }}) no se pueden eliminar; deshabilita el worker primero.</span>
      </fieldset>

      <div class="grid grid-cols-3 gap-2.5">
        <label class="flex flex-col gap-1.5 text-[12px] text-muted">Serie
          <select class="field field-select" (change)="seriesId.set(+$any($event.target).value || null)">
            <option value="">Todas</option>
            @for (s of series(); track s.id) { <option [value]="s.id">{{ s.name }}</option> }
          </select>
        </label>
        <label class="flex flex-col gap-1.5 text-[12px] text-muted">Worker
          <select class="field field-select" (change)="worker.set($any($event.target).value || null)">
            <option value="">Todos</option><option value="transcode">transcode</option><option value="index">index</option>
          </select>
        </label>
        <label class="flex flex-col gap-1.5 text-[12px] text-muted">Más antiguos que
          <select class="field field-select" (change)="days.set(+$any($event.target).value || null)">
            <option value="">Cualquier fecha</option><option value="1">1 día</option><option value="7">7 días</option><option value="30">30 días</option>
          </select>
        </label>
      </div>

      <div class="flex flex-col gap-2.5 p-3.5 border border-[#5A3A33] rounded-lg bg-[#221715]">
        <span class="text-[14px]">Se eliminarán <strong class="font-mono text-danger">{{ narrowed() ? 'hasta ' : '' }}{{ fmt(total()) }}</strong> jobs. Esta acción no se puede deshacer.</span>
        <label class="flex flex-col gap-1.5 text-[12px] text-muted">Escribe LIMPIAR para confirmar
          <input class="field field-mono tracking-[0.1em]" type="text" autocomplete="off" (input)="typed.set($any($event.target).value)">
        </label>
      </div>
      @if (error()) { <span class="text-[13px] text-danger" role="alert">{{ error() }}</span> }

      <ng-container footer>
        <button class="btn btn-ghost" type="button" (click)="closed.emit()">Cancelar</button>
        <button type="button" class="btn font-semibold px-4.5" [disabled]="locked() || busy()" (click)="clear()"
                [class]="locked() ? 'bg-edge text-dim' : 'bg-live text-on-live'">Eliminar {{ fmt(total()) }} jobs</button>
      </ng-container>
    </app-dialog>
  `,
})
export class ClearQueueDialog {
  private readonly admin = inject(AdminApi);
  readonly counts = input<Partial<Record<string, number>>>({});
  readonly closed = output<void>();
  readonly cleared = output<number>();
  readonly defs = DEFS;
  readonly on = signal<Record<string, boolean>>({ Completed: true, Skipped: true, Failed: false, Queued: false });
  readonly typed = signal('');
  readonly series = signal<SeriesListItem[]>([]);
  readonly seriesId = signal<number | null>(null);
  readonly worker = signal<string | null>(null);
  readonly days = signal<number | null>(null);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly total = computed(() => DEFS.reduce((n, d) => n + (this.on()[d[0]] ? this.counts()[d[0]] ?? 0 : 0), 0));
  /** With extra filters the count shown is an upper bound. */
  readonly narrowed = computed(() => !!(this.seriesId() || this.worker() || this.days()));
  readonly locked = computed(() => this.total() === 0 || this.typed().trim().toUpperCase() !== 'LIMPIAR');

  fmt(n: number): string { return n.toLocaleString('es'); }

  ngOnInit(): void { this.admin.series().then(s => this.series.set(s)).catch(() => {}); }

  toggle(k: string): void { this.on.update(s => ({ ...s, [k]: !s[k] })); }

  async clear(): Promise<void> {
    this.busy.set(true);
    try {
      const result = await this.admin.clearQueue({
        confirmation: this.typed().trim(), statuses: DEFS.map(d => d[0]).filter(s => this.on()[s]),
        seriesId: this.seriesId(), worker: this.worker(), olderThanDays: this.days(),
      });
      this.cleared.emit(result.deleted);
    } catch (error) {
      this.error.set(errorMessage(error, 'No se pudo limpiar la cola.'));
    } finally {
      this.busy.set(false);
    }
  }
}
