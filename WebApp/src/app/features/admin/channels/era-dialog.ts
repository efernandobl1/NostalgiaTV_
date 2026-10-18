import { Component, computed, inject, input, output, signal } from '@angular/core';
import { AdminApi } from '../../../core/api/admin-api';
import { errorMessage } from '../../../core/api/api';
import { EraItem } from '../../../core/api/models';
import { Dialog } from '../../../shared/ui/dialog';

/** Design: "Diálogo · Era" (create / edit), with the era's commercial-break rule. */
@Component({
  selector: 'app-era-dialog',
  imports: [Dialog],
  template: `
    <app-dialog [eyebrow]="channelName().toUpperCase() + ' · ERA'" [heading]="create() ? 'Nueva era' : 'Editar era'" (closed)="closed.emit()">
      <label class="flex flex-col gap-1.5 text-[12px] text-muted">Nombre de la era
        <input class="field" type="text" maxlength="200" [value]="name()" (input)="name.set($any($event.target).value)">
      </label>
      <div class="grid grid-cols-2 gap-2.5">
        <label class="flex flex-col gap-1.5 text-[12px] text-muted">Inicio histórico
          <input class="field field-date" type="date" [value]="start()" (change)="start.set($any($event.target).value)">
        </label>
        <label class="flex flex-col gap-1.5 text-[12px] text-muted">Fin histórico (opcional)
          <input class="field field-date" type="date" [value]="end()" (change)="end.set($any($event.target).value)">
        </label>
      </div>
      <label class="flex flex-col gap-1.5 text-[12px] text-muted">Descripción
        <textarea class="field field-area" rows="3" maxlength="4000" [value]="description()" (input)="description.set($any($event.target).value)"></textarea>
      </label>
      <fieldset class="m-0 p-0 border-0 flex flex-col gap-1.5">
        <legend class="pb-1.5 text-[12px] text-muted">Reglas de corte (vacío = sin cortes comerciales)</legend>
        <div class="grid grid-cols-3 gap-2.5">
          <label class="flex flex-col gap-1.5 text-[12px] text-muted">Mín. anuncios <input class="field field-mono" type="number" min="1" max="12" [value]="minAds()" (input)="minAds.set($any($event.target).value)"></label>
          <label class="flex flex-col gap-1.5 text-[12px] text-muted">Máx. anuncios <input class="field field-mono" type="number" min="1" max="12" [value]="maxAds()" (input)="maxAds.set($any($event.target).value)"></label>
          <label class="flex flex-col gap-1.5 text-[12px] text-muted">Máx. segundos <input class="field field-mono" type="number" min="1" max="1800" [value]="maxSeconds()" (input)="maxSeconds.set($any($event.target).value)"></label>
        </div>
      </fieldset>
      @if (error()) { <span class="text-[13px] text-danger" role="alert">{{ error() }}</span> }

      <ng-container footer>
        @if (!create()) {
          <button class="btn btn-danger-text" type="button" (click)="confirmDelete() ? remove() : confirmDelete.set(true)">{{ confirmDelete() ? 'Confirmar: eliminar era' : 'Eliminar era' }}</button>
        }
        <span class="flex-1"></span>
        <button class="btn btn-ghost" type="button" (click)="closed.emit()">Cancelar</button>
        <button class="btn btn-primary" type="button" [disabled]="busy() || !name().trim() || !start()" (click)="save()">{{ create() ? 'Crear era' : 'Guardar cambios' }}</button>
      </ng-container>
    </app-dialog>
  `,
})
export class EraDialog {
  private readonly admin = inject(AdminApi);
  readonly channelId = input.required<number>();
  readonly channelName = input('');
  /** Null creates a new era. */
  readonly era = input<EraItem | null>(null);
  readonly create = computed(() => this.era() === null);
  readonly closed = output<void>();
  readonly saved = output<void>();

  readonly name = signal('');
  readonly start = signal('');
  readonly end = signal('');
  readonly description = signal('');
  readonly minAds = signal<string | number>('');
  readonly maxAds = signal<string | number>('');
  readonly maxSeconds = signal<string | number>('');
  readonly busy = signal(false);
  readonly error = signal('');
  readonly confirmDelete = signal(false);

  ngOnInit(): void {
    const e = this.era();
    if (!e) return;
    this.name.set(e.name);
    this.start.set(e.historicalStartDate.slice(0, 10));
    this.end.set(e.historicalEndDate?.slice(0, 10) ?? '');
    this.description.set(e.description ?? '');
    if (e.breakRule) {
      this.minAds.set(e.breakRule.minimumAds);
      this.maxAds.set(e.breakRule.maximumAds);
      this.maxSeconds.set(e.breakRule.maximumBreakSeconds);
    }
  }

  async save(): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    const value = { name: this.name().trim(), description: this.description().trim() || null, historicalStartDate: this.start(), historicalEndDate: this.end() || null };
    const rule = [this.minAds(), this.maxAds(), this.maxSeconds()].map(v => Number(v) || 0);
    try {
      const current = this.era();
      const era = current ? await this.admin.updateEra(this.channelId(), current.id, value) : await this.admin.createEra(this.channelId(), value);
      if (rule.every(v => v > 0)) await this.admin.setBreakRule(this.channelId(), era.id, { minimumAds: rule[0], maximumAds: rule[1], maximumBreakSeconds: rule[2] });
      else if (current?.breakRule) await this.admin.removeBreakRule(this.channelId(), era.id);
      this.saved.emit();
    } catch (error) {
      this.error.set(errorMessage(error, 'No se pudo guardar la era.'));
    } finally {
      this.busy.set(false);
    }
  }

  async remove(): Promise<void> {
    const e = this.era();
    if (!e) return;
    try {
      await this.admin.deleteEra(this.channelId(), e.id);
      this.saved.emit();
    } catch (error) {
      this.error.set(errorMessage(error, 'No se pudo eliminar la era.'));
    }
  }
}
