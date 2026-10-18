import { Component, inject, input, output, signal } from '@angular/core';
import { AdminApi } from '../../../core/api/admin-api';
import { errorMessage, mediaUrl } from '../../../core/api/api';
import { InterludeItem } from '../../../core/api/models';
import { Dialog } from '../../../shared/ui/dialog';
import { InterludeFields } from './interlude-form';
import { duration, interludeLabel } from './interlude-labels';

/** Design: "Diálogo · Interludio". */
@Component({
  selector: 'app-interlude-dialog',
  imports: [Dialog],
  template: `
    <app-dialog [eyebrow]="label(item().kind, item().bumperType).toUpperCase()" eyebrowColor="text-violet" heading="Editar interludio" (closed)="closed.emit()">
      <div class="flex items-center gap-3 p-2.5 rounded-lg bg-raised">
        @if (playing()) {
          <video class="w-40 aspect-video flex-none rounded-sm bg-black" [src]="src()" controls autoplay></video>
        } @else {
          <span class="w-24 h-13.5 flex-none rounded-sm [background:repeating-linear-gradient(0deg,_rgba(255,255,255,0.05)_0_1px,_transparent_1px_3px),_#2C2C27]" aria-hidden="true"></span>
        }
        <span class="flex-1 min-w-0 flex flex-col gap-0.5">
          <span class="font-mono text-[12px] truncate">{{ item().filePath }}</span>
          <span class="font-mono text-[11px] text-muted">{{ dur(item().durationSeconds) }} · en {{ item().eraCount }} {{ item().eraCount === 1 ? 'era' : 'eras' }}</span>
        </span>
        <button class="btn btn-ghost btn-xs" type="button" (click)="playing.set(!playing())">{{ playing() ? 'Cerrar' : 'Reproducir' }}</button>
      </div>
      <label class="flex flex-col gap-1.5 text-[12px] text-muted">Título
        <input class="field" type="text" maxlength="300" [value]="f.title()" (input)="f.title.set($any($event.target).value)">
      </label>
      <div class="grid grid-cols-3 gap-2.5">
        <label class="flex flex-col gap-1.5 text-[12px] text-muted">Tipo
          <select class="field field-select" (change)="f.kind.set($any($event.target).value)">
            <option value="Bumper" [selected]="f.kind() === 'Bumper'">Bumper</option><option value="Advertisement" [selected]="f.kind() === 'Advertisement'">Anuncio</option>
          </select>
        </label>
        <label class="flex flex-col gap-1.5 text-[12px] text-muted">Bumper
          <select class="field field-select" [disabled]="f.kind() !== 'Bumper'" (change)="f.bumperType.set($any($event.target).value)">
            <option value="ComingUp" [selected]="f.bumperType() === 'ComingUp'">Ya viene</option>
            <option value="WeContinueWith" [selected]="f.bumperType() === 'WeContinueWith'">Continuamos con</option>
            <option value="Generic" [selected]="f.bumperType() === 'Generic'">Genérico</option>
          </select>
        </label>
        <label class="flex flex-col gap-1.5 text-[12px] text-muted">Temporada
          <select class="field field-select" (change)="f.season.set($any($event.target).value)">
            <option value="AllYear" [selected]="f.season() === 'AllYear'">Todo el año</option>
            <option value="Halloween" [selected]="f.season() === 'Halloween'">Halloween</option>
            <option value="Christmas" [selected]="f.season() === 'Christmas'">Navidad</option>
          </select>
        </label>
        <label class="flex flex-col gap-1.5 text-[12px] text-muted">Región <input class="field field-mono" type="text" maxlength="20" [value]="f.region()" (input)="f.region.set($any($event.target).value)"></label>
        <label class="flex flex-col gap-1.5 text-[12px] text-muted">Año desde <input class="field field-mono" type="number" min="1900" max="2100" [value]="f.yearFrom()" (input)="f.yearFrom.set($any($event.target).value)"></label>
        <label class="flex flex-col gap-1.5 text-[12px] text-muted">Año hasta <input class="field field-mono" type="number" min="1900" max="2100" [value]="f.yearTo()" (input)="f.yearTo.set($any($event.target).value)"></label>
      </div>
      <label class="flex flex-col gap-1.5 text-[12px] text-muted">URL de origen
        <input class="field" type="url" maxlength="1000" placeholder="https://…" [value]="f.sourceUrl()" (input)="f.sourceUrl.set($any($event.target).value)">
      </label>
      <div class="flex flex-wrap gap-y-1 gap-x-5">
        <label class="flex items-center gap-2.5 min-h-11 text-[14px]"><input class="check" type="checkbox" [checked]="f.approved()" (change)="f.approved.set(!f.approved())">Aprobado para emisión</label>
        <label class="flex items-center gap-2.5 min-h-11 text-[14px]"><input class="check" type="checkbox" [checked]="f.redistribution()" (change)="f.redistribution.set(!f.redistribution())">Permite redistribución</label>
      </div>
      <label class="flex flex-col gap-1.5 text-[12px] text-muted">Licencia (obligatoria si permite redistribución)
        <input class="field" [class.border-danger]="f.licenseMissing()" type="text" maxlength="500" placeholder="Ej. CC BY 4.0" [attr.aria-invalid]="f.licenseMissing()"
               [value]="f.license()" (input)="f.license.set($any($event.target).value)">
        @if (f.licenseMissing()) { <span class="text-danger">Escribe la licencia para poder guardar.</span> }
      </label>
      @if (error()) { <span class="text-[13px] text-danger" role="alert">{{ error() }}</span> }

      <ng-container footer>
        <button class="btn btn-danger-text" type="button" (click)="confirmDelete() ? remove() : confirmDelete.set(true)">{{ confirmDelete() ? 'Confirmar: eliminar' : 'Eliminar' }}</button>
        <span class="flex-1"></span>
        <button class="btn btn-ghost" type="button" (click)="closed.emit()">Cancelar</button>
        <button class="btn btn-primary" type="button" [disabled]="busy() || f.licenseMissing()" (click)="save()">Guardar</button>
      </ng-container>
    </app-dialog>
  `,
})
export class InterludeDialog {
  private readonly admin = inject(AdminApi);
  readonly item = input.required<InterludeItem>();
  readonly closed = output<void>();
  readonly saved = output<void>();
  readonly f = new InterludeFields();
  readonly label = interludeLabel;
  readonly dur = duration;
  readonly playing = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly confirmDelete = signal(false);

  src(): string { return mediaUrl(this.item().filePath) ?? ''; }

  ngOnInit(): void { this.f.load(this.item()); }

  async save(): Promise<void> {
    this.busy.set(true);
    try {
      await this.admin.updateInterlude(this.item().id, this.f.value());
      if (this.f.approved() !== this.item().approvedForBroadcast) await this.admin.approveInterlude(this.item().id, this.f.approved());
      this.saved.emit();
    } catch (error) {
      this.error.set(errorMessage(error, 'No se pudo guardar el interludio.'));
    } finally {
      this.busy.set(false);
    }
  }

  async remove(): Promise<void> {
    try {
      await this.admin.deleteInterlude(this.item().id);
      this.saved.emit();
    } catch (error) {
      this.error.set(errorMessage(error, 'No se pudo eliminar el interludio.'));
    }
  }
}
