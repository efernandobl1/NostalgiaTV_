import { Component, computed, output, signal } from '@angular/core';
import { Dialog } from '../../../shared/ui/dialog';

const LIST: [string, string, number][] = [
  ['Dragon Ball Z', '1989–1996', 5],
  ['Los Simpson', '1989 –', 6],
  ['Hey Arnold!', '1996–2004', 5],
  ['Pokémon', '1997 –', 4],
  ['Digimon Adventure', '1999–2000', 1],
  ['Los Caballeros del Zodiaco', '1986–1989', 5],
];

/** Design: "Diálogo · Series de la era" — pick series and optional seasons. */
@Component({
  selector: 'app-era-series-dialog',
  imports: [Dialog],
  template: `
    <app-dialog eyebrow="ÉPOCA DORADA 1996–2001" heading="Series de la era" [tight]="true" (closed)="closed.emit()">
      <label class="flex items-center gap-2 min-h-11 px-3 border border-edge rounded-md bg-ink">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A29E91" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="M20 20l-3.5-3.5"></path></svg>
        <input class="flex-1 min-w-0 border-0 outline-none bg-transparent text-fg text-[14px]" type="search" aria-label="Buscar series" placeholder="Buscar series…"
               (input)="query.set($any($event.target).value)">
      </label>
      <div class="flex flex-col max-h-105 overflow-y-auto border border-line rounded-lg">
        @for (r of rows(); track r.name) {
          <div class="flex flex-col gap-2 py-2.5 px-3 border-b border-raised-2">
            <label class="flex items-center gap-3 min-h-9 cursor-pointer">
              <input class="check" type="checkbox" [checked]="on()[r.index]" (change)="toggle(r.index)">
              <span class="flex-1 text-[14px] font-medium">{{ r.name }}</span>
              <span class="font-mono text-[11px] text-muted">{{ r.years }}</span>
            </label>
            @if (on()[r.index]) {
              <div class="flex flex-wrap gap-1.5 pl-7.5" role="group" aria-label="Temporadas">
                @for (t of r.seasons; track t) {
                  <button type="button" [attr.aria-pressed]="!!seasons()[r.index + '-' + t]" (click)="toggleSeason(r.index + '-' + t)"
                          class="min-h-8 px-2.5 rounded-sm cursor-pointer font-mono font-medium text-[12px] border border-edge bg-transparent text-fg aria-pressed:border-amber aria-pressed:bg-amber aria-pressed:text-on-amber">T{{ t }}</button>
                }
              </div>
            }
          </div>
        }
      </div>
      <span class="text-[12px] text-muted">Sin temporadas marcadas = se emiten todas.</span>

      <ng-container footer>
        <span class="text-[13px] text-muted">{{ count() }} series seleccionadas</span>
        <span class="flex-1"></span>
        <button class="btn btn-ghost" type="button" (click)="closed.emit()">Cancelar</button>
        <button class="btn btn-primary" type="button" (click)="closed.emit()">Guardar</button>
      </ng-container>
    </app-dialog>
  `,
})
export class EraSeriesDialog {
  readonly closed = output<void>();
  readonly query = signal('');
  readonly on = signal<Record<number, boolean>>({ 0: true, 2: true });
  readonly seasons = signal<Record<string, boolean>>({ '0-2': true, '0-3': true });
  readonly rows = computed(() => LIST
    .map(([name, years, n], index) => ({ index, name, years, seasons: Array.from({ length: n }, (_, k) => k + 1) }))
    .filter(r => r.name.toLowerCase().includes(this.query().toLowerCase())));
  readonly count = computed(() => Object.values(this.on()).filter(Boolean).length);

  toggle(i: number): void { this.on.update(s => ({ ...s, [i]: !s[i] })); }
  toggleSeason(key: string): void { this.seasons.update(s => ({ ...s, [key]: !s[key] })); }
}
