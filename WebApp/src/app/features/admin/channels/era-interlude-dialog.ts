import { Component, output, signal } from '@angular/core';
import { Dialog } from '../../../shared/ui/dialog';

/** Design: "Diálogo · Interludio de era" — assign a bumper/ad to the era. */
@Component({
  selector: 'app-era-interlude-dialog',
  imports: [Dialog],
  template: `
    <app-dialog eyebrow="ÉPOCA DORADA 1996–2001" heading="Asignar interludio" (closed)="closed.emit()">
      <label class="flex flex-col gap-1.5 text-[12px] text-muted">Interludio
        <select class="field field-select"><option>Ya viene · Canal 5 (1997) — Bumper</option><option>Continuamos con · Canal 5 — Bumper</option><option>Anuncio cereal (1998) — Anuncio</option></select>
      </label>
      <div class="flex flex-col gap-1.5" role="radiogroup" aria-label="Alcance">
        <span class="text-[12px] text-muted">Alcance</span>
        @for (s of scopes; track s.label; let i = $index) {
          <label class="flex items-center gap-3 min-h-12 px-3 border border-line rounded-md cursor-pointer">
            <input class="check" type="radio" name="scope" [checked]="scope() === i" (change)="scope.set(i)">
            <span class="flex flex-col gap-0.5">
              <span class="text-[14px]">{{ s.label }}</span>
              <span class="text-[12px] text-muted">{{ s.hint }}</span>
            </span>
          </label>
        }
      </div>
      @if (scope() === 1) {
        <label class="flex flex-col gap-1.5 text-[12px] text-muted">Serie de la era
          <select class="field field-select"><option>Dragon Ball Z</option><option>Hey Arnold!</option><option>Pokémon</option></select>
        </label>
      }
      <div class="grid grid-cols-2 gap-2.5">
        <label class="flex flex-col gap-1.5 text-[12px] text-muted">Peso (probabilidad) <input class="field field-mono" type="number" min="1" value="3"></label>
        <label class="flex flex-col gap-1.5 text-[12px] text-muted">Separación mínima (seg) <input class="field field-mono" type="number" min="0" value="900"></label>
      </div>

      <ng-container footer>
        <button class="btn btn-ghost" type="button" (click)="closed.emit()">Cancelar</button>
        <button class="btn btn-primary" type="button" (click)="closed.emit()">Asignar</button>
      </ng-container>
    </app-dialog>
  `,
})
export class EraInterludeDialog {
  readonly closed = output<void>();
  readonly scope = signal(0);
  readonly scopes = [
    { label: 'Toda la era', hint: 'Puede aparecer en cualquier corte' },
    { label: 'Solo una serie', hint: 'Aparece únicamente en cortes de esa serie' },
  ];
}
