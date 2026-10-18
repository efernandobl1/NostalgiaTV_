import { Component, computed, input, output } from '@angular/core';
import { Dialog } from '../../../shared/ui/dialog';

/** Design: "Diálogo · Era" (create / edit). */
@Component({
  selector: 'app-era-dialog',
  imports: [Dialog],
  template: `
    <app-dialog eyebrow="CANAL 5 RETRO · ERA" [heading]="create() ? 'Nueva era' : 'Editar era'" (closed)="closed.emit()">
      <label class="flex flex-col gap-1.5 text-[12px] text-muted">Nombre de la era
        <input class="field" type="text" [value]="create() ? '' : 'Época dorada'">
      </label>
      <div class="grid grid-cols-2 gap-2.5">
        <label class="flex flex-col gap-1.5 text-[12px] text-muted">Inicio histórico
          <input class="field field-date" type="date" value="1996-01-01">
        </label>
        <label class="flex flex-col gap-1.5 text-[12px] text-muted">Fin histórico (opcional)
          <input class="field field-date" type="date" value="2001-12-31">
        </label>
      </div>
      <label class="flex flex-col gap-1.5 text-[12px] text-muted">Carpeta de interludios
        <input class="field [font:13px_'IBM_Plex_Mono',_monospace]" type="text" value="/media/eras/epoca-dorada">
      </label>
      <label class="flex flex-col gap-1.5 text-[12px] text-muted">Descripción
        <textarea class="field field-area" rows="3">Auge del anime en la tarde y cortes de 2 a 4 anuncios.</textarea>
      </label>
      <fieldset class="m-0 p-0 border-0 flex flex-col gap-1.5">
        <legend class="pb-1.5 text-[12px] text-muted">Reglas de corte</legend>
        <div class="grid grid-cols-3 gap-2.5">
          <label class="flex flex-col gap-1.5 text-[12px] text-muted">Mín. anuncios <input class="field field-mono" type="number" min="1" value="2"></label>
          <label class="flex flex-col gap-1.5 text-[12px] text-muted">Máx. anuncios <input class="field field-mono" type="number" min="1" value="4"></label>
          <label class="flex flex-col gap-1.5 text-[12px] text-muted">Máx. segundos <input class="field field-mono" type="number" min="1" value="180"></label>
        </div>
      </fieldset>

      <ng-container footer>
        @if (!create()) { <button class="btn btn-danger-text" type="button" (click)="closed.emit()">Eliminar era</button> }
        <span class="flex-1"></span>
        <button class="btn btn-ghost" type="button" (click)="closed.emit()">Cancelar</button>
        <button class="btn btn-primary" type="button" (click)="closed.emit()">{{ create() ? 'Crear era' : 'Guardar cambios' }}</button>
      </ng-container>
    </app-dialog>
  `,
})
export class EraDialog {
  readonly mode = input<'create' | 'edit'>('edit');
  readonly create = computed(() => this.mode() === 'create');
  readonly closed = output<void>();
}
