import { Component, computed, input, output } from '@angular/core';
import { Dialog } from '../../../shared/ui/dialog';

/** Design: "Diálogo · Canal" (create / edit). */
@Component({
  selector: 'app-channel-dialog',
  imports: [Dialog],
  template: `
    <app-dialog eyebrow="CANALES" [heading]="create() ? 'Nuevo canal' : 'Editar canal'" (closed)="closed.emit()">
      <div class="flex gap-4 items-start">
        <label class="relative w-24 h-24 flex-none flex flex-col items-center justify-center gap-1 border border-dashed border-edge-2 rounded-[10px] cursor-pointer text-[11px] text-muted text-center [background:repeating-linear-gradient(0deg,_rgba(255,255,255,0.04)_0_1px,_transparent_1px_3px),_#1F1F1B]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFB547" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16V4"></path><path d="M7 9l5-5 5 5"></path><path d="M4 20h16"></path></svg>
          Logo
          <input class="absolute w-px h-px opacity-0" type="file" accept="image/*">
        </label>
        <div class="flex-1 min-w-0 flex flex-col gap-3.5">
          <label class="flex flex-col gap-1.5 text-[12px] text-muted">Nombre del canal
            <input class="field" type="text" [value]="create() ? '' : 'Canal 5 Retro'">
          </label>
          <div class="grid grid-cols-2 gap-2.5">
            <label class="flex flex-col gap-1.5 text-[12px] text-muted">Inicio
              <input class="field field-date" type="date" value="2024-03-01">
            </label>
            <label class="flex flex-col gap-1.5 text-[12px] text-muted">Cierre (opcional)
              <input class="field field-date" type="date">
            </label>
          </div>
        </div>
      </div>
      <label class="flex flex-col gap-1.5 text-[12px] text-muted">Historia del canal
        <textarea class="field field-area" rows="4">Canal de caricaturas y anime de la televisión abierta, con bloques de tarde y cortes comerciales de época.</textarea>
      </label>
      <div class="flex items-center gap-2.5 py-2.5 px-3 rounded-md bg-raised">
        <span class="flex-1 min-w-0 font-mono text-[12px] text-muted truncate">Enlace público: /c/7f3c2e10-…-a91e</span>
        <button class="btn btn-ghost btn-xs" type="button">Regenerar</button>
      </div>

      <ng-container footer>
        @if (!create()) { <button class="btn btn-danger-text" type="button" (click)="closed.emit()">Eliminar canal</button> }
        <span class="flex-1"></span>
        <button class="btn btn-ghost" type="button" (click)="closed.emit()">Cancelar</button>
        <button class="btn btn-primary" type="button" (click)="closed.emit()">{{ create() ? 'Crear canal' : 'Guardar cambios' }}</button>
      </ng-container>
    </app-dialog>
  `,
})
export class ChannelDialog {
  readonly mode = input<'create' | 'edit'>('edit');
  readonly create = computed(() => this.mode() === 'create');
  readonly closed = output<void>();
}
