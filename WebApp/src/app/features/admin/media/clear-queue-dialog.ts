import { Component, computed, output, signal } from '@angular/core';
import { Dialog } from '../../../shared/ui/dialog';

const DEFS: [string, string, string, number, string][] = [
  ['Completed', 'Completados', 'Solo borra el registro, no el archivo de salida', 1309, '#8BE08F'],
  ['Skipped', 'Omitidos', 'Archivos sin cambios desde el último análisis', 5, '#8C887D'],
  ['Failed', 'Fallidos', 'Se pierde el mensaje de error', 7, '#FF8A80'],
  ['Queued', 'En cola (cancelar)', 'Se vuelven a crear al escanear la carpeta', 18, '#A29E91'],
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
            <span class="font-mono text-[13px]" [style.color]="s[4]">{{ s[3] }}</span>
          </label>
        }
        <span class="text-[12px] text-dim">Los jobs en procesamiento (3) no se pueden eliminar; deshabilita el worker primero.</span>
      </fieldset>

      <div class="grid grid-cols-3 gap-2.5">
        <label class="flex flex-col gap-1.5 text-[12px] text-muted">Serie
          <select class="field field-select"><option>Todas</option><option>Dragon Ball Z</option><option>Pokémon</option><option>Los Simpson</option></select>
        </label>
        <label class="flex flex-col gap-1.5 text-[12px] text-muted">Worker
          <select class="field field-select"><option>Todos</option><option>transcode</option><option>probe</option><option>thumbnails</option></select>
        </label>
        <label class="flex flex-col gap-1.5 text-[12px] text-muted">Más antiguos que
          <select class="field field-select"><option>Cualquier fecha</option><option>1 día</option><option>7 días</option><option>30 días</option></select>
        </label>
      </div>

      <div class="flex flex-col gap-2.5 p-3.5 border border-[#5A3A33] rounded-lg bg-[#221715]">
        <span class="text-[14px]">Se eliminarán <strong class="font-mono text-danger">{{ totalLabel() }}</strong> jobs. Esta acción no se puede deshacer.</span>
        <label class="flex flex-col gap-1.5 text-[12px] text-muted">Escribe LIMPIAR para confirmar
          <input class="field field-mono tracking-[0.1em]" type="text" autocomplete="off" (input)="typed.set($any($event.target).value)">
        </label>
      </div>

      <ng-container footer>
        <button class="btn btn-ghost" type="button" (click)="closed.emit()">Cancelar</button>
        <button type="button" class="btn font-semibold px-4.5" [disabled]="locked()" (click)="closed.emit()"
                [class]="locked() ? 'bg-edge text-dim' : 'bg-live text-on-live'">Eliminar {{ totalLabel() }} jobs</button>
      </ng-container>
    </app-dialog>
  `,
})
export class ClearQueueDialog {
  readonly closed = output<void>();
  readonly defs = DEFS;
  readonly on = signal<Record<string, boolean>>({ Completed: true, Skipped: true, Failed: false, Queued: false });
  readonly typed = signal('');
  readonly total = computed(() => DEFS.reduce((n, d) => n + (this.on()[d[0]] ? d[3] : 0), 0));
  readonly totalLabel = computed(() => this.total().toLocaleString('es-GT'));
  readonly locked = computed(() => this.total() === 0 || this.typed().trim().toUpperCase() !== 'LIMPIAR');
  toggle(k: string): void { this.on.update(s => ({ ...s, [k]: !s[k] })); }
}
