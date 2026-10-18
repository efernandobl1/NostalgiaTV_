import { Component, computed, input, output } from '@angular/core';
import { Dialog } from '../../../shared/ui/dialog';

/** Design: "Diálogo · Usuario" (create / edit). */
@Component({
  selector: 'app-user-dialog',
  imports: [Dialog],
  template: `
    <app-dialog eyebrow="ACCESO · USUARIO" [heading]="editing() ? 'Editar usuario' : 'Nuevo usuario'" (closed)="closed.emit()">
      <div class="grid grid-cols-2 gap-2.5">
        <label class="flex flex-col gap-1.5 text-[12px] text-muted">Usuario
          <input class="field" type="text" [value]="editing() ? 'editor01' : ''" autocomplete="off">
        </label>
        <label class="flex flex-col gap-1.5 text-[12px] text-muted">Rol
          <select class="field field-select"><option>Administrador</option><option selected>Editor</option><option>Espectador</option></select>
        </label>
      </div>
      <label class="flex flex-col gap-1.5 text-[12px] text-muted">{{ editing() ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña' }}
        <input class="field" type="password" autocomplete="new-password" placeholder="Mínimo 8 caracteres">
      </label>
      @if (editing()) {
        <div class="flex flex-col gap-2 p-3 rounded-lg bg-raised">
          <span class="font-mono text-[11px] tracking-[0.1em] text-muted">SEGURIDAD</span>
          <div class="flex flex-wrap items-center justify-between gap-2.5 text-[14px]">
            <span><span class="text-amber">3 intentos fallidos</span> · sin bloqueo activo</span>
            <button class="btn btn-ghost btn-xs" type="button">Reiniciar intentos</button>
          </div>
          <div class="flex flex-wrap items-center justify-between gap-2.5 text-[14px]">
            <span>2 sesiones activas · versión de sesión 7</span>
            <button class="btn btn-ghost btn-xs text-danger hover:text-danger" type="button">Cerrar todas</button>
          </div>
        </div>
        <div class="flex flex-col gap-2">
          <span class="font-mono text-[11px] tracking-[0.1em] text-muted">INICIOS DE SESIÓN EXTERNOS</span>
          <div class="flex items-center gap-2.5 min-h-11 px-3 border border-line rounded-md text-[14px]">
            <span class="flex-1">Google · vinculado 12 sep 2026</span>
            <button class="btn btn-xs bg-transparent text-danger" type="button">Desvincular</button>
          </div>
        </div>
      }
      <ng-container footer>
        @if (editing()) { <button class="btn btn-danger-text" type="button" (click)="closed.emit()">Desactivar usuario</button> }
        <span class="flex-1"></span>
        <button class="btn btn-ghost" type="button" (click)="closed.emit()">Cancelar</button>
        <button class="btn btn-primary" type="button" (click)="closed.emit()">{{ editing() ? 'Guardar cambios' : 'Crear usuario' }}</button>
      </ng-container>
    </app-dialog>
  `,
})
export class UserDialog {
  readonly mode = input<'create' | 'edit'>('edit');
  readonly editing = computed(() => this.mode() === 'edit');
  readonly closed = output<void>();
}

/** Design: "Diálogo · Rol" (create / edit). */
@Component({
  selector: 'app-role-dialog',
  imports: [Dialog],
  template: `
    <app-dialog eyebrow="ACCESO · ROL" [heading]="create() ? 'Nuevo rol' : 'Editar rol'" (closed)="closed.emit()">
      <label class="flex flex-col gap-1.5 text-[12px] text-muted">Nombre
        <input class="field" type="text" [value]="create() ? '' : 'Editor'">
      </label>
      <label class="flex flex-col gap-1.5 text-[12px] text-muted">Descripción
        <textarea class="field field-area" rows="2">Catálogo, canales y programación</textarea>
      </label>
      <span class="text-[12px] text-muted">Los menús se asignan desde la pestaña Roles y menús.</span>
      <ng-container footer>
        <button class="btn btn-ghost" type="button" (click)="closed.emit()">Cancelar</button>
        <button class="btn btn-primary" type="button" (click)="closed.emit()">Guardar</button>
      </ng-container>
    </app-dialog>
  `,
})
export class RoleDialog {
  readonly mode = input<'create' | 'edit'>('edit');
  readonly create = computed(() => this.mode() === 'create');
  readonly closed = output<void>();
}
