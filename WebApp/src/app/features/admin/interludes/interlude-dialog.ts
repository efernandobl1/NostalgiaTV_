import { Component, output } from '@angular/core';
import { Dialog } from '../../../shared/ui/dialog';

/** Design: "Diálogo · Interludio". */
@Component({
  selector: 'app-interlude-dialog',
  imports: [Dialog],
  template: `
    <app-dialog eyebrow="BUMPER · YA VIENE" eyebrowColor="text-violet" heading="Editar interludio" (closed)="closed.emit()">
      <div class="flex items-center gap-3 p-2.5 rounded-lg bg-raised">
        <span class="w-24 h-13.5 flex-none rounded-sm [background:repeating-linear-gradient(0deg,_rgba(255,255,255,0.05)_0_1px,_transparent_1px_3px),_#2C2C27]" aria-hidden="true"></span>
        <span class="flex-1 min-w-0 flex flex-col gap-0.5">
          <span class="font-mono text-[12px] truncate">/media/interludes/ya-viene-c5-97.mp4</span>
          <span class="font-mono text-[11px] text-muted">0:05.200 · detectado con FFmpeg</span>
        </span>
        <button class="btn btn-ghost btn-xs" type="button">Reproducir</button>
      </div>
      <label class="flex flex-col gap-1.5 text-[12px] text-muted">Título
        <input class="field" type="text" value="Ya viene · Canal 5 (1997)">
      </label>
      <div class="grid grid-cols-3 gap-2.5">
        <label class="flex flex-col gap-1.5 text-[12px] text-muted">Tipo
          <select class="field field-select"><option>Bumper</option><option>Anuncio</option></select>
        </label>
        <label class="flex flex-col gap-1.5 text-[12px] text-muted">Bumper
          <select class="field field-select"><option>Ya viene</option><option>Continuamos con</option><option>Genérico</option></select>
        </label>
        <label class="flex flex-col gap-1.5 text-[12px] text-muted">Temporada
          <select class="field field-select"><option>Todo el año</option><option>Halloween</option><option>Navidad</option></select>
        </label>
        <label class="flex flex-col gap-1.5 text-[12px] text-muted">Región <input class="field field-mono" type="text" value="GT"></label>
        <label class="flex flex-col gap-1.5 text-[12px] text-muted">Año desde <input class="field field-mono" type="number" value="1996"></label>
        <label class="flex flex-col gap-1.5 text-[12px] text-muted">Año hasta <input class="field field-mono" type="number" value="1999"></label>
      </div>
      <label class="flex flex-col gap-1.5 text-[12px] text-muted">URL de origen
        <input class="field" type="url" placeholder="https://…">
      </label>
      <div class="flex flex-wrap gap-y-1 gap-x-5">
        <label class="flex items-center gap-2.5 min-h-11 text-[14px]"><input class="check" type="checkbox" checked>Aprobado para emisión</label>
        <label class="flex items-center gap-2.5 min-h-11 text-[14px]"><input class="check" type="checkbox" checked>Permite redistribución</label>
      </div>
      <label class="flex flex-col gap-1.5 text-[12px] text-muted">Licencia (obligatoria si permite redistribución)
        <input class="field border-danger" type="text" value="" placeholder="Ej. CC BY 4.0" aria-invalid="true">
        <span class="text-danger">Escribe la licencia para poder guardar.</span>
      </label>

      <ng-container footer>
        <button class="btn btn-danger-text" type="button" (click)="closed.emit()">Eliminar</button>
        <span class="flex-1"></span>
        <button class="btn btn-ghost" type="button" (click)="closed.emit()">Cancelar</button>
        <button class="btn btn-primary" type="button" (click)="closed.emit()">Guardar</button>
      </ng-container>
    </app-dialog>
  `,
})
export class InterludeDialog {
  readonly closed = output<void>();
}
