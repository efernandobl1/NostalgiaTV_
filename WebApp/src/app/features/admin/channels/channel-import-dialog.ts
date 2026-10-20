import { Component, computed, inject, output, signal } from '@angular/core';
import { AdminApi } from '../../../core/api/admin-api';
import { errorMessage } from '../../../core/api/api';
import { ChannelPackageImportResult, ChannelPackagePreview } from '../../../core/api/models';
import { Dialog } from '../../../shared/ui/dialog';
import { interludeLabel } from '../interludes/interlude-labels';

/** Same cap as the API (ChannelPackage.MaxBytes). */
export const PACKAGE_MAX_BYTES = 1024 * 1024;

export interface PackageGap { label: string; detail: string }

function seasonList(numbers: number[]): string {
  return numbers.map(n => (n === 0 ? 'especiales' : `T${n}`)).join(', ');
}

/** What the local library lacks: series, seasons and interludes the import will leave out. */
export function packageGaps(preview: ChannelPackagePreview): PackageGap[] {
  const reason = (status: string) => (status === 'ambiguous' ? 'varias coincidencias, revisa la biblioteca' : 'no está en tu biblioteca');
  return [
    ...preview.series.filter(s => s.status !== 'matched').map(s => ({ label: `${s.name} (${s.startYear})`, detail: `Serie · ${reason(s.status)}` })),
    ...preview.series.filter(s => s.status === 'matched' && s.missingSeasons.length)
      .map(s => ({ label: s.name, detail: `Faltan temporadas: ${seasonList(s.missingSeasons)}` })),
    ...preview.interludes.filter(i => i.status !== 'matched')
      .map(i => ({ label: i.title, detail: `${interludeLabel(i.kind, i.bumperType)} · ${reason(i.status)}` })),
  ];
}

/** Design: "Diálogo · Importar canal" — pick a .ntv.json package, preview it, then create the channel. */
@Component({
  selector: 'app-channel-import-dialog',
  imports: [Dialog],
  template: `
    <app-dialog eyebrow="CANALES · PAQUETE" heading="Importar canal" [width]="680" (closed)="closed.emit()">
      <label class="flex flex-col gap-1.5 text-[12px] text-muted">Paquete del canal (.ntv.json, máximo 1 MiB)
        <input class="field" type="file" accept=".json,application/json" [disabled]="busy()" (change)="pick($any($event.target).files?.[0])">
      </label>
      <span class="text-[12px] text-muted">El paquete trae eras, series, temporadas, reglas de corte e interludios. No incluye videos: todo se enlaza con lo que ya existe en tu biblioteca.</span>

      @if (preview(); as p) {
        <label class="flex flex-col gap-1.5 text-[12px] text-muted">Nombre del nuevo canal
          <input class="field" type="text" maxlength="200" [value]="name()" (input)="name.set($any($event.target).value)">
        </label>
        @if (nameTaken()) { <span class="text-[13px] text-danger" role="alert">Ya existe un canal con ese nombre. Elige otro para importarlo.</span> }
        @if (p.sourceChannelId) { <span class="text-[12px] text-muted">Este paquete salió de un canal de esta biblioteca: se creará una copia con su propio enlace público.</span> }

        <section class="flex flex-col gap-2" aria-labelledby="pkg-create">
          <h3 class="m-0 font-display text-[16px] font-semibold" id="pkg-create">Se creará</h3>
          <div class="flex flex-col border border-line rounded-lg">
            @for (e of p.eras; track e.name) {
              <div class="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 px-3 border-b border-raised-2 last:border-b-0">
                <span class="font-mono text-[11px] text-muted">{{ e.historicalStartYear }}–{{ e.historicalEndYear ?? 'hoy' }}</span>
                <span class="flex-1 min-w-0 text-[14px] font-medium">{{ e.name }}</span>
                @if (e.onAir) { <span class="font-mono text-[10px] tracking-[0.1em] text-amber">● EN EMISIÓN</span> }
                <span class="w-full text-[12px] text-muted">
                  {{ e.seriesCount }} series · {{ e.interludeCount }} interludios ·
                  {{ e.breakRule ? e.breakRule.minimumAds + '–' + e.breakRule.maximumAds + ' anuncios, ' + e.breakRule.maximumBreakSeconds + ' s por corte' : 'sin cortes comerciales' }}
                  @if (e.missingSeries || e.missingInterludes) { <span class="text-danger"> · se omiten {{ e.missingSeries }} series y {{ e.missingInterludes }} interludios</span> }
                </span>
              </div>
            } @empty {
              <span class="p-3 text-[13px] text-muted">El canal no tiene eras.</span>
            }
          </div>
          <span class="text-[12px] text-muted">{{ matchedSeries() }} de {{ p.series.length }} series y {{ matchedInterludes() }} de {{ p.interludes.length }} interludios se enlazan con tu biblioteca.</span>
        </section>

        @if (gaps().length) {
          <section class="flex flex-col gap-2" aria-labelledby="pkg-missing">
            <h3 class="m-0 font-display text-[16px] font-semibold text-danger" id="pkg-missing">Falta en tu biblioteca</h3>
            <div class="flex flex-col max-h-60 overflow-y-auto border border-[#5A3A33] rounded-lg">
              @for (g of gaps(); track $index) {
                <div class="flex flex-wrap items-baseline gap-x-3 py-2 px-3 border-b border-raised-2 last:border-b-0">
                  <span class="text-[13px] font-medium">{{ g.label }}</span>
                  <span class="text-[12px] text-muted">{{ g.detail }}</span>
                </div>
              }
            </div>
            <span class="text-[12px] text-muted">Se importa sin ellos. Agrégalos a la biblioteca y vuelve a asignarlos a la era cuando quieras.</span>
          </section>
        } @else {
          <span class="text-[13px] text-ok" role="status">Todo lo que usa el paquete está en tu biblioteca.</span>
        }
      }
      @if (busy()) { <span class="text-[13px] text-muted" role="status">{{ preview() ? 'Importando canal…' : 'Revisando paquete…' }}</span> }
      @if (error()) { <span class="text-[13px] text-danger" role="alert">{{ error() }}</span> }

      <ng-container footer>
        <span class="flex-1"></span>
        <button class="btn btn-ghost" type="button" (click)="closed.emit()">Cancelar</button>
        <button class="btn btn-primary" type="button" [disabled]="busy() || !preview() || !name().trim() || nameTaken()" (click)="save()">Importar canal</button>
      </ng-container>
    </app-dialog>
  `,
})
export class ChannelImportDialog {
  private readonly admin = inject(AdminApi);
  readonly closed = output<void>();
  readonly imported = output<ChannelPackageImportResult>();

  readonly file = signal<File | null>(null);
  readonly preview = signal<ChannelPackagePreview | null>(null);
  readonly name = signal('');
  readonly busy = signal(false);
  readonly error = signal('');

  /** The preview only knows whether the package's own name is taken. */
  readonly nameTaken = computed(() => {
    const p = this.preview();
    return !!p && p.nameTaken && this.name().trim().toLowerCase() === p.name.toLowerCase();
  });
  readonly gaps = computed(() => { const p = this.preview(); return p ? packageGaps(p) : []; });
  readonly matchedSeries = computed(() => this.preview()?.series.filter(s => s.status === 'matched').length ?? 0);
  readonly matchedInterludes = computed(() => this.preview()?.interludes.filter(i => i.status === 'matched').length ?? 0);

  async pick(file: File | undefined): Promise<void> {
    this.preview.set(null);
    this.error.set('');
    this.file.set(null);
    if (!file) return;
    if (!/\.json$/i.test(file.name) || file.size === 0 || file.size > PACKAGE_MAX_BYTES) {
      this.error.set('Selecciona un paquete .ntv.json de hasta 1 MiB.');
      return;
    }
    this.busy.set(true);
    try {
      const preview = await this.admin.previewChannelImport(file);
      this.file.set(file);
      this.preview.set(preview);
      this.name.set(preview.name);
    } catch (error) {
      this.error.set(errorMessage(error, 'No se pudo revisar el paquete.'));
    } finally {
      this.busy.set(false);
    }
  }

  async save(): Promise<void> {
    const file = this.file();
    if (!file) return;
    this.busy.set(true);
    this.error.set('');
    try {
      this.imported.emit(await this.admin.importChannel(file, this.name().trim()));
    } catch (error) {
      this.error.set(errorMessage(error, 'No se pudo importar el canal.'));
    } finally {
      this.busy.set(false);
    }
  }
}
