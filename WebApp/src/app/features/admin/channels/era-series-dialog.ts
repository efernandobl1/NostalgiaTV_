import { Component, computed, inject, input, output, signal } from '@angular/core';
import { AdminApi } from '../../../core/api/admin-api';
import { errorMessage } from '../../../core/api/api';
import { SeriesListItem } from '../../../core/api/models';
import { years } from '../../../core/data/public-data';
import { Dialog } from '../../../shared/ui/dialog';

/** Design: "Diálogo · Series de la era" — pick series and optional seasons. */
@Component({
  selector: 'app-era-series-dialog',
  imports: [Dialog],
  template: `
    <app-dialog [eyebrow]="eraName().toUpperCase()" heading="Series de la era" gap="gap-3" (closed)="closed.emit()">
      <label class="flex items-center gap-2 min-h-11 px-3 border border-edge rounded-md bg-ink">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A29E91" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="M20 20l-3.5-3.5"></path></svg>
        <input class="flex-1 min-w-0 border-0 outline-none bg-transparent text-fg text-[14px]" type="search" aria-label="Buscar series" placeholder="Buscar series…"
               (input)="query.set($any($event.target).value)">
      </label>
      <div class="flex flex-col max-h-105 overflow-y-auto border border-line rounded-lg">
        @for (r of rows(); track r.id) {
          <div class="flex flex-col gap-2 py-2.5 px-3 border-b border-raised-2">
            <label class="flex items-center gap-3 min-h-9 cursor-pointer">
              <input class="check" type="checkbox" [checked]="picked().has(r.id)" (change)="toggle(r.id)">
              <span class="flex-1 text-[14px] font-medium">{{ r.name }}</span>
              <span class="font-mono text-[11px] text-muted">{{ r.years }}</span>
            </label>
            @if (picked().has(r.id)) {
              <div class="flex flex-wrap gap-1.5 pl-7.5" role="group" aria-label="Temporadas">
                @for (t of r.seasons; track t) {
                  <button type="button" [attr.aria-pressed]="picked().get(r.id)!.has(t)" (click)="toggleSeason(r.id, t)"
                          class="min-h-8 px-2.5 rounded-sm cursor-pointer font-mono font-medium text-[12px] border border-edge bg-transparent text-fg aria-pressed:border-amber aria-pressed:bg-amber aria-pressed:text-on-amber">{{ t === 0 ? 'Especiales' : 'T' + t }}</button>
                }
              </div>
            }
          </div>
        } @empty {
          <span class="p-4 text-[14px] text-muted">{{ loading() ? 'Cargando series…' : 'No hay series que coincidan.' }}</span>
        }
      </div>
      <span class="text-[12px] text-muted">Sin temporadas marcadas = se emiten todas.</span>
      @if (error()) { <span class="text-[13px] text-danger" role="alert">{{ error() }}</span> }

      <ng-container footer>
        <span class="text-[13px] text-muted">{{ picked().size }} series seleccionadas</span>
        <span class="flex-1"></span>
        <button class="btn btn-ghost" type="button" (click)="closed.emit()">Cancelar</button>
        <button class="btn btn-primary" type="button" [disabled]="busy()" (click)="save()">Guardar</button>
      </ng-container>
    </app-dialog>
  `,
})
export class EraSeriesDialog {
  private readonly admin = inject(AdminApi);
  readonly channelId = input.required<number>();
  readonly eraId = input.required<number>();
  readonly eraName = input('');
  readonly closed = output<void>();
  readonly saved = output<void>();

  readonly query = signal('');
  readonly all = signal<SeriesListItem[]>([]);
  /** Series id → selected seasons (empty = all). */
  readonly picked = signal(new Map<number, Set<number>>());
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal('');

  readonly rows = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.all().filter(s => !q || s.name.toLowerCase().includes(q))
      .map(s => ({ id: s.id, name: s.name, years: years(s.startDate, s.endDate), seasons: [...s.seasons].sort((a, b) => a - b) }));
  });

  async ngOnInit(): Promise<void> {
    try {
      const [all, current] = await Promise.all([this.admin.series(), this.admin.eraSeries(this.channelId(), this.eraId())]);
      this.all.set(all);
      this.picked.set(new Map(current.map(s => [s.seriesId, new Set(s.seasons)])));
    } catch (error) {
      this.error.set(errorMessage(error, 'No se pudieron cargar las series.'));
    } finally {
      this.loading.set(false);
    }
  }

  toggle(id: number): void {
    this.picked.update(map => { const next = new Map(map); if (next.has(id)) next.delete(id); else next.set(id, new Set()); return next; });
  }

  toggleSeason(id: number, season: number): void {
    this.picked.update(map => {
      const next = new Map(map);
      const seasons = new Set(next.get(id));
      if (seasons.has(season)) seasons.delete(season); else seasons.add(season);
      next.set(id, seasons);
      return next;
    });
  }

  async save(): Promise<void> {
    this.busy.set(true);
    try {
      await this.admin.setEraSeries(this.channelId(), this.eraId(), [...this.picked()].map(([seriesId, seasons]) => ({ seriesId, seasons: seasons.size ? [...seasons] : null })));
      this.saved.emit();
    } catch (error) {
      this.error.set(errorMessage(error, 'No se pudieron guardar las series.'));
    } finally {
      this.busy.set(false);
    }
  }
}
