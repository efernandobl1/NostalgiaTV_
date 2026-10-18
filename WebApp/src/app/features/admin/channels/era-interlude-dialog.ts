import { Component, inject, input, output, signal } from '@angular/core';
import { AdminApi } from '../../../core/api/admin-api';
import { errorMessage } from '../../../core/api/api';
import { EraSeriesItem, InterludeItem } from '../../../core/api/models';
import { Dialog } from '../../../shared/ui/dialog';
import { interludeLabel } from '../interludes/interlude-labels';

/** Design: "Diálogo · Interludio de era" — assign a bumper/ad to the era. */
@Component({
  selector: 'app-era-interlude-dialog',
  imports: [Dialog],
  template: `
    <app-dialog [eyebrow]="eraName().toUpperCase()" heading="Asignar interludio" (closed)="closed.emit()">
      <label class="flex flex-col gap-1.5 text-[12px] text-muted">Interludio
        <select class="field field-select" (change)="interludeId.set(+$any($event.target).value)">
          <option value="0">{{ interludes().length ? 'Elige un interludio aprobado…' : 'No hay interludios aprobados' }}</option>
          @for (i of interludes(); track i.id) { <option [value]="i.id">{{ i.title }} — {{ label(i.kind, i.bumperType) }}</option> }
        </select>
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
          <select class="field field-select" (change)="seriesId.set(+$any($event.target).value)">
            <option value="0">Elige una serie…</option>
            @for (s of series(); track s.seriesId) { <option [value]="s.seriesId">{{ s.name }}</option> }
          </select>
        </label>
      }
      <div class="grid grid-cols-2 gap-2.5">
        <label class="flex flex-col gap-1.5 text-[12px] text-muted">Peso (probabilidad) <input class="field field-mono" type="number" min="1" max="100" [value]="weight()" (input)="weight.set(+$any($event.target).value)"></label>
        <label class="flex flex-col gap-1.5 text-[12px] text-muted">Separación mínima (seg) <input class="field field-mono" type="number" min="0" max="604800" [value]="gap()" (input)="gap.set(+$any($event.target).value)"></label>
      </div>
      @if (error()) { <span class="text-[13px] text-danger" role="alert">{{ error() }}</span> }

      <ng-container footer>
        <button class="btn btn-ghost" type="button" (click)="closed.emit()">Cancelar</button>
        <button class="btn btn-primary" type="button" [disabled]="busy() || !interludeId() || (scope() === 1 && !seriesId())" (click)="save()">Asignar</button>
      </ng-container>
    </app-dialog>
  `,
})
export class EraInterludeDialog {
  private readonly admin = inject(AdminApi);
  readonly channelId = input.required<number>();
  readonly eraId = input.required<number>();
  readonly eraName = input('');
  readonly series = input<EraSeriesItem[]>([]);
  readonly closed = output<void>();
  readonly saved = output<void>();
  readonly label = interludeLabel;

  readonly interludes = signal<InterludeItem[]>([]);
  readonly interludeId = signal(0);
  readonly seriesId = signal(0);
  readonly scope = signal(0);
  readonly weight = signal(3);
  readonly gap = signal(900);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly scopes = [
    { label: 'Toda la era', hint: 'Puede aparecer en cualquier corte' },
    { label: 'Solo una serie', hint: 'Aparece únicamente en cortes de esa serie' },
  ];

  ngOnInit(): void {
    this.admin.interludes({ approved: true }).then(list => this.interludes.set(list)).catch(error => this.error.set(errorMessage(error)));
  }

  async save(): Promise<void> {
    this.busy.set(true);
    try {
      await this.admin.assignInterlude(this.channelId(), this.eraId(), this.interludeId(), this.scope() === 1 ? this.seriesId() : null, this.weight(), this.gap());
      this.saved.emit();
    } catch (error) {
      this.error.set(errorMessage(error, 'No se pudo asignar el interludio.'));
    } finally {
      this.busy.set(false);
    }
  }
}
