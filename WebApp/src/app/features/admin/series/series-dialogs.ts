import { Component, computed, input, output, signal } from '@angular/core';
import { Dialog } from '../../../shared/ui/dialog';

/** Design: "Diálogo · Serie" (create / edit). */
@Component({
  selector: 'app-series-dialog',
  imports: [Dialog],
  template: `
    <app-dialog eyebrow="CATÁLOGO · SERIE" [heading]="create() ? 'Nueva serie' : 'Editar serie'" (closed)="closed.emit()">
      <div class="flex gap-4 items-start">
        <label class="relative w-24 h-33 flex-none flex flex-col items-center justify-center gap-1 border border-dashed border-edge-2 rounded-lg cursor-pointer text-center text-[11px] text-muted [background:repeating-linear-gradient(0deg,_rgba(255,255,255,0.04)_0_1px,_transparent_1px_3px),_#1F1F1B]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFB547" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16V4"></path><path d="M7 9l5-5 5 5"></path><path d="M4 20h16"></path></svg>
          Cambiar logo
          <input class="absolute w-px h-px opacity-0" type="file" accept="image/*">
        </label>
        <div class="flex-1 min-w-0 flex flex-col gap-3.5">
          <label class="flex flex-col gap-1.5 text-[12px] text-muted">Nombre
            <input class="field" type="text" [value]="create() ? '' : 'Dragon Ball Z'">
          </label>
          <div class="grid grid-cols-3 gap-2.5">
            <label class="flex flex-col gap-1.5 text-[12px] text-muted">Inicio <input class="field field-date" type="date" value="1989-04-26"></label>
            <label class="flex flex-col gap-1.5 text-[12px] text-muted">Fin (opcional) <input class="field field-date" type="date" value="1996-01-31"></label>
            <label class="flex flex-col gap-1.5 text-[12px] text-muted">Rating <input class="field field-mono" type="number" step="0.1" min="0" max="10" value="8.8"></label>
          </div>
        </div>
      </div>

      <fieldset class="m-0 p-0 border-0 flex flex-col gap-2">
        <legend class="pb-2 text-[12px] text-muted">Categorías</legend>
        <div class="flex flex-wrap gap-1.5">
          @for (c of cats; track c) {
            <button type="button" [attr.aria-pressed]="!!picked()[c]" (click)="toggle(c)"
                    class="min-h-9 px-3 rounded-[18px] cursor-pointer font-medium text-[13px] border border-edge bg-transparent text-fg aria-pressed:border-amber aria-pressed:bg-amber aria-pressed:text-on-amber">{{ c }}</button>
          }
        </div>
      </fieldset>

      <label class="flex flex-col gap-1.5 text-[12px] text-muted">Carpeta de la serie
        <input class="field [font:13px_'IBM_Plex_Mono',_monospace]" type="text" value="/media/series/dbz">
      </label>
      <label class="flex flex-col gap-1.5 text-[12px] text-muted">Descripción
        <textarea class="field field-area" rows="3">Goku y sus amigos defienden la Tierra de enemigos cada vez más poderosos.</textarea>
      </label>
      <label class="flex flex-col gap-1.5 text-[12px] text-muted">Historia (cómo llegó a la TV local)
        <textarea class="field field-area" rows="3">[Notas sobre su emisión original]</textarea>
      </label>

      <ng-container footer>
        <button class="btn btn-ghost" type="button" (click)="closed.emit()">Cancelar</button>
        <button class="btn btn-primary" type="button" (click)="closed.emit()">{{ create() ? 'Crear serie' : 'Guardar cambios' }}</button>
      </ng-container>
    </app-dialog>
  `,
})
export class SeriesDialog {
  readonly mode = input<'create' | 'edit'>('edit');
  readonly create = computed(() => this.mode() === 'create');
  readonly closed = output<void>();
  readonly cats = ['Anime', 'Caricatura', 'Comedia', 'Acción', 'Aventura', 'Live action'];
  readonly picked = signal<Record<string, boolean>>({ Anime: true, 'Acción': true, Aventura: true });
  toggle(c: string): void { this.picked.update(p => ({ ...p, [c]: !p[c] })); }
}

/** Design: "Diálogo · Episodio" (create / edit). */
@Component({
  selector: 'app-episode-dialog',
  imports: [Dialog],
  template: `
    <app-dialog eyebrow="DRAGON BALL Z · EPISODIO" [heading]="create() ? 'Nuevo episodio' : 'Editar episodio'" (closed)="closed.emit()">
      <label class="flex flex-col gap-1.5 text-[12px] text-muted">Título
        <input class="field" type="text" [value]="create() ? '' : episodeTitle()">
      </label>
      <div class="grid grid-cols-3 gap-2.5">
        <label class="flex flex-col gap-1.5 text-[12px] text-muted">Temporada
          <select class="field field-select"><option>T0 · Especiales</option><option>T1</option><option selected>T2</option><option>T3</option><option>T4</option></select>
        </label>
        <label class="flex flex-col gap-1.5 text-[12px] text-muted">Tipo
          <select class="field field-select"><option selected>Episodio</option><option>Opening</option><option>Ending</option><option>Relleno</option><option>Especial</option><option>Película</option></select>
        </label>
        <label class="flex flex-col gap-1.5 text-[12px] text-muted">Número <input class="field field-mono" type="number" min="0" value="14"></label>
      </div>
      <span class="text-[12px] text-muted">Temporada + tipo + número deben ser únicos dentro de la serie.</span>

      <div class="flex flex-col gap-1.5">
        <span class="text-[12px] text-muted">Archivo de video</span>
        <div class="flex items-center gap-2.5 py-2.5 px-3 border border-edge rounded-md bg-ink">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFB547" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="M10 9l5 3-5 3z"></path></svg>
          <span class="flex-1 min-w-0 font-mono text-[12px] truncate">/media/series/dbz/T02/dbz_t2_e14.mp4</span>
          <label class="relative inline-flex items-center min-h-9 px-3 border border-edge rounded-md text-[13px] cursor-pointer">Reemplazar
            <input class="absolute w-px h-px opacity-0" type="file" accept="video/*">
          </label>
        </div>
        <span class="font-mono text-[11px] text-dim">21:40 · 720p · h264 · 2 puntos de corte</span>
      </div>

      <label class="flex items-center justify-between gap-3 min-h-13 px-3 border border-line rounded-md">
        <span class="flex flex-col gap-0.5">
          <span class="text-[14px]">Disponible para emisión</span>
          <span class="text-[12px] text-muted">Si se desactiva, la programación lo omite</span>
        </span>
        <input class="check" type="checkbox" checked>
      </label>

      <ng-container footer>
        <button class="btn btn-danger-text" type="button" (click)="closed.emit()">Eliminar episodio</button>
        <span class="flex-1"></span>
        <button class="btn btn-ghost" type="button" (click)="closed.emit()">Cancelar</button>
        <button class="btn btn-primary" type="button" (click)="closed.emit()">Guardar</button>
      </ng-container>
    </app-dialog>
  `,
})
export class EpisodeDialog {
  readonly mode = input<'create' | 'edit'>('edit');
  readonly episodeTitle = input('El poder oculto de Gohan');
  readonly create = computed(() => this.mode() === 'create');
  readonly closed = output<void>();
}

/** Design: "Diálogo · Temporada". */
@Component({
  selector: 'app-season-dialog',
  imports: [Dialog],
  template: `
    <app-dialog eyebrow="DRAGON BALL Z" heading="Agregar temporada" gap="gap-2.5" (closed)="closed.emit()">
      <label class="flex flex-col gap-1.5 text-[12px] text-muted">Número de temporada
        <input class="field [font:16px_'IBM_Plex_Mono',_monospace]" type="number" min="0" value="5">
      </label>
      <span class="text-[12px] text-muted">Usa 0 para especiales. Existentes: T0, T1, T2, T3, T4.</span>
      <ng-container footer>
        <button class="btn btn-ghost" type="button" (click)="closed.emit()">Cancelar</button>
        <button class="btn btn-primary" type="button" (click)="closed.emit()">Agregar</button>
      </ng-container>
    </app-dialog>
  `,
})
export class SeasonDialog {
  readonly closed = output<void>();
}

/** Design: "Diálogo · Punto de corte". */
@Component({
  selector: 'app-breakpoint-dialog',
  imports: [Dialog],
  template: `
    <app-dialog eyebrow="T2 · E14 · EL PODER OCULTO DE GOHAN" heading="Punto de corte" (closed)="closed.emit()">
      <div class="relative h-18 rounded-md scanlines flex items-end p-2" aria-hidden="true">
        <span class="font-mono text-[11px] text-muted">vista previa · 07:12.400</span>
        <span class="absolute left-[33%] top-0 bottom-0 w-0.5 bg-info"></span>
      </div>
      <div class="grid grid-cols-2 gap-2.5">
        <label class="flex flex-col gap-1.5 text-[12px] text-muted">Posición (mm:ss.mmm)
          <input class="field [font:15px_'IBM_Plex_Mono',_monospace]" type="text" value="07:12.400" inputmode="decimal">
        </label>
        <label class="flex flex-col gap-1.5 text-[12px] text-muted">Etiqueta (opcional)
          <input class="field" type="text" value="Corte A">
        </label>
      </div>
      <span class="text-[12px] text-muted">Debe ser mayor a 0 y distinto de los otros puntos del episodio.</span>
      <ng-container footer>
        <button class="btn btn-danger-text" type="button" (click)="closed.emit()">Eliminar</button>
        <span class="flex-1"></span>
        <button class="btn btn-ghost" type="button" (click)="closed.emit()">Cancelar</button>
        <button class="btn btn-primary" type="button" (click)="closed.emit()">Guardar</button>
      </ng-container>
    </app-dialog>
  `,
})
export class BreakpointDialog {
  readonly closed = output<void>();
}

/** Design: "Diálogo · Importar metadatos". */
@Component({
  selector: 'app-import-dialog',
  imports: [Dialog],
  template: `
    <app-dialog eyebrow="DRAGON BALL Z" heading="Importar metadatos" (closed)="closed.emit()">
      <div class="grid grid-cols-2 gap-2.5">
        <label class="flex flex-col gap-1.5 text-[12px] text-muted">Proveedor
          <select class="field field-select"><option>TMDB</option><option>TheTVDB</option></select>
        </label>
        <label class="flex flex-col gap-1.5 text-[12px] text-muted">ID externo <input class="field field-mono" type="text" value="12971"></label>
      </div>
      <label class="flex flex-col gap-1.5 text-[12px] text-muted">Idioma
        <select class="field field-select"><option>es-MX · Español (Latinoamérica)</option><option>es-ES · Español (España)</option><option>en-US · English</option></select>
      </label>
      <fieldset class="m-0 p-0 border-0 flex flex-col gap-0.5">
        <legend class="pb-1.5 text-[12px] text-muted">Sobrescribir</legend>
        <label class="flex items-center gap-2.5 min-h-10 text-[14px]"><input class="check" type="checkbox" checked>Descripción y rating</label>
        <label class="flex items-center gap-2.5 min-h-10 text-[14px]"><input class="check" type="checkbox" checked>Títulos de episodios</label>
        <label class="flex items-center gap-2.5 min-h-10 text-[14px]"><input class="check" type="checkbox">Logo / póster</label>
      </fieldset>
      <div class="py-2.5 px-3 rounded-md bg-raised text-[12px] text-muted">Último intento: <span class="text-danger">fallido</span> · TheTVDB · 03 oct 09:14</div>
      <ng-container footer>
        <button class="btn btn-ghost" type="button" (click)="closed.emit()">Cancelar</button>
        <button class="btn btn-primary" type="button" (click)="closed.emit()">Importar</button>
      </ng-container>
    </app-dialog>
  `,
})
export class ImportDialog {
  readonly closed = output<void>();
}
