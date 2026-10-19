import { Component, computed, DestroyRef, inject, input, output, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { AdminApi } from '../../../core/api/admin-api';
import { errorMessage, mediaUrl } from '../../../core/api/api';
import { CatalogItem, EpisodeItem, EpisodeUploadResult, ExternalIdItem, MetadataProviderItem, SeriesDetail } from '../../../core/api/models';
import { Dialog } from '../../../shared/ui/dialog';

/** "07:12.400" ⇄ seconds. */
export function formatOffset(seconds: number): string {
  const m = Math.floor(seconds / 60), s = seconds - m * 60;
  return `${String(m).padStart(2, '0')}:${s.toFixed(3).padStart(6, '0')}`;
}

export function parseOffset(value: string): number | null {
  const match = /^\s*(?:(\d+):)?(\d+(?:\.\d+)?)\s*$/.exec(value);
  if (!match) return null;
  const seconds = Number(match[1] ?? 0) * 60 + Number(match[2]);
  return seconds > 0 ? seconds : null;
}

/** Design: "Diálogo · Serie" (create / edit). */
@Component({
  selector: 'app-series-dialog',
  imports: [Dialog],
  template: `
    <app-dialog eyebrow="CATÁLOGO · SERIE" [heading]="create() ? 'Nueva serie' : 'Editar serie'" (closed)="closed.emit()">
      <div class="flex gap-4 items-start">
        <label class="relative w-24 h-33 flex-none flex flex-col items-center justify-center gap-1 border border-dashed border-edge-2 rounded-lg cursor-pointer text-center text-[11px] text-muted overflow-hidden [background:repeating-linear-gradient(0deg,_rgba(255,255,255,0.04)_0_1px,_transparent_1px_3px),_#1F1F1B]">
          @if (preview()) {
            <img class="absolute inset-0 w-full h-full object-contain" [src]="preview()" alt="">
          } @else {
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFB547" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16V4"></path><path d="M7 9l5-5 5 5"></path><path d="M4 20h16"></path></svg>
            Cambiar logo
          }
          <input class="absolute w-px h-px opacity-0" type="file" accept="image/png,image/jpeg,image/webp" (change)="pick($any($event.target).files?.[0])">
        </label>
        <div class="flex-1 min-w-0 flex flex-col gap-3.5">
          <label class="flex flex-col gap-1.5 text-[12px] text-muted">Nombre
            <input class="field" type="text" maxlength="200" [value]="name()" (input)="name.set($any($event.target).value)">
          </label>
          <div class="grid grid-cols-3 gap-2.5">
            <label class="flex flex-col gap-1.5 text-[12px] text-muted">Inicio <input class="field field-date" type="date" [value]="start()" (change)="start.set($any($event.target).value)"></label>
            <label class="flex flex-col gap-1.5 text-[12px] text-muted">Fin (opcional) <input class="field field-date" type="date" [value]="end()" (change)="end.set($any($event.target).value)"></label>
            <label class="flex flex-col gap-1.5 text-[12px] text-muted">Rating <input class="field field-mono" type="number" step="0.1" min="0" max="10" [value]="rating()" (input)="rating.set($any($event.target).value)"></label>
          </div>
        </div>
      </div>

      <fieldset class="m-0 p-0 border-0 flex flex-col gap-2">
        <legend class="pb-2 text-[12px] text-muted">Categorías</legend>
        <div class="flex flex-wrap gap-1.5">
          @for (c of categories(); track c.id) {
            <button type="button" [attr.aria-pressed]="picked().has(c.id)" (click)="toggle(c.id)"
                    class="min-h-9 px-3 rounded-[18px] cursor-pointer font-medium text-[13px] border border-edge bg-transparent text-fg aria-pressed:border-amber aria-pressed:bg-amber aria-pressed:text-on-amber">{{ c.name }}</button>
          } @empty {
            <span class="text-[13px] text-muted">Crea categorías en Ajustes.</span>
          }
        </div>
      </fieldset>

      @if (create()) {
        <label class="flex flex-col gap-1.5 text-[12px] text-muted">Temporadas iniciales
          <input class="field field-mono" type="number" min="0" max="200" [value]="initialSeasons()" (input)="initialSeasons.set(+$any($event.target).value)">
        </label>
      } @else if (series()?.folderPath) {
        <span class="font-mono text-[12px] text-muted">Carpeta: {{ series()!.folderPath }}</span>
      }
      <label class="flex flex-col gap-1.5 text-[12px] text-muted">Descripción
        <textarea class="field field-area" rows="3" maxlength="4000" [value]="description()" (input)="description.set($any($event.target).value)"></textarea>
      </label>
      <label class="flex flex-col gap-1.5 text-[12px] text-muted">Historia (cómo llegó a la TV local)
        <textarea class="field field-area" rows="3" maxlength="20000" [value]="history()" (input)="history.set($any($event.target).value)"></textarea>
      </label>
      @if (error()) { <span class="text-[13px] text-danger" role="alert">{{ error() }}</span> }

      <ng-container footer>
        <button class="btn btn-ghost" type="button" (click)="closed.emit()">Cancelar</button>
        <button class="btn btn-primary" type="button" [disabled]="busy() || !name().trim() || !start()" (click)="save()">{{ create() ? 'Crear serie' : 'Guardar cambios' }}</button>
      </ng-container>
    </app-dialog>
  `,
})
export class SeriesDialog {
  private readonly admin = inject(AdminApi);
  /** Null creates a new series. */
  readonly series = input<SeriesDetail | null>(null);
  readonly categories = input<CatalogItem[]>([]);
  readonly create = computed(() => this.series() === null);
  readonly closed = output<void>();
  readonly saved = output<SeriesDetail>();

  readonly name = signal('');
  readonly start = signal('');
  readonly end = signal('');
  readonly rating = signal<string | number>('');
  readonly description = signal('');
  readonly history = signal('');
  readonly initialSeasons = signal(1);
  readonly picked = signal(new Set<number>());
  readonly logo = signal<File | null>(null);
  readonly preview = signal<string | null>(null);
  readonly busy = signal(false);
  readonly error = signal('');

  ngOnInit(): void {
    const s = this.series();
    if (!s) return;
    this.name.set(s.name);
    this.start.set(s.startDate.slice(0, 10));
    this.end.set(s.endDate?.slice(0, 10) ?? '');
    this.rating.set(s.rating ?? '');
    this.description.set(s.description ?? '');
    this.history.set(s.history ?? '');
    this.picked.set(new Set(s.categories.map(c => c.id)));
    this.preview.set(mediaUrl(s.logoPath));
  }

  toggle(id: number): void { this.picked.update(p => { const next = new Set(p); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }

  pick(file: File | undefined): void {
    if (!file) return;
    this.logo.set(file);
    this.preview.set(URL.createObjectURL(file));
  }

  async save(): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    const rating = this.rating() === '' ? null : Number(this.rating());
    const value = {
      name: this.name().trim(), description: this.description().trim() || null, history: this.history().trim() || null, rating,
      startDate: this.start(), endDate: this.end() || null, categoryIds: [...this.picked()], initialSeasons: this.create() ? this.initialSeasons() : undefined,
    };
    try {
      const s = this.series();
      const result = s ? await this.admin.updateSeries(s.id, value, this.logo()) : await this.admin.createSeries(value, this.logo());
      // Categories are also sent in the form; set them explicitly so edits clear removed ones.
      this.saved.emit(s ? await this.admin.setCategories(result.id, [...this.picked()]) : result);
    } catch (error) {
      this.error.set(errorMessage(error, 'No se pudo guardar la serie.'));
    } finally {
      this.busy.set(false);
    }
  }
}

/** Design: "Diálogo · Episodio" — edit the metadata of an imported episode. */
@Component({
  selector: 'app-episode-dialog',
  imports: [Dialog],
  template: `
    <app-dialog [eyebrow]="seriesName().toUpperCase() + ' · EPISODIO'" heading="Editar episodio" (closed)="closed.emit()">
      <label class="flex flex-col gap-1.5 text-[12px] text-muted">Título
        <input class="field" type="text" maxlength="300" [value]="title()" (input)="title.set($any($event.target).value)">
      </label>
      <div class="grid grid-cols-4 gap-2.5">
        <label class="flex flex-col gap-1.5 text-[12px] text-muted">Temporada
          <select class="field field-select" (change)="season.set(+$any($event.target).value)">
            @for (t of seasons(); track t) { <option [value]="t" [selected]="t === season()">{{ t === 0 ? 'T0 · Especiales' : 'T' + t }}</option> }
          </select>
        </label>
        <label class="flex flex-col gap-1.5 text-[12px] text-muted">Tipo
          <select class="field field-select" (change)="typeId.set(+$any($event.target).value)">
            @for (t of types(); track t.id) { <option [value]="t.id" [selected]="t.id === typeId()">{{ t.name }}</option> }
          </select>
        </label>
        <label class="flex flex-col gap-1.5 text-[12px] text-muted">Número <input class="field field-mono" type="number" min="0" max="9999" [value]="number()" (input)="number.set(+$any($event.target).value)"></label>
        <label class="flex flex-col gap-1.5 text-[12px] text-muted">Parte <input class="field field-mono uppercase" type="text" maxlength="1" placeholder="—" [value]="part()" (input)="part.set($any($event.target).value.replace(/[^a-z]/gi, '').toUpperCase())"></label>
      </div>
      <span class="text-[12px] text-muted">Parte = A, B… si el episodio está dividido (se emiten seguidas). Temporada + tipo + número + parte deben ser únicos.</span>

      <div class="flex flex-col gap-1.5">
        <span class="text-[12px] text-muted">Archivo de video</span>
        <div class="flex items-center gap-2.5 py-2.5 px-3 border border-edge rounded-md bg-ink">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFB547" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="M10 9l5 3-5 3z"></path></svg>
          <span class="flex-1 min-w-0 font-mono text-[12px] truncate" [class.text-live]="!episode().isAvailable">{{ episode().filePath ?? 'sin archivo' }}</span>
        </div>
        <span class="font-mono text-[11px] text-dim">{{ size() }} · {{ episode().breakPointCount }} puntos de corte · para reemplazarlo sube el archivo de nuevo</span>
      </div>
      @if (error()) { <span class="text-[13px] text-danger" role="alert">{{ error() }}</span> }

      <ng-container footer>
        <button class="btn btn-danger-text" type="button" (click)="confirmDelete() ? remove() : confirmDelete.set(true)">{{ confirmDelete() ? 'Confirmar: eliminar' : 'Eliminar episodio' }}</button>
        <span class="flex-1"></span>
        <button class="btn btn-ghost" type="button" (click)="closed.emit()">Cancelar</button>
        <button class="btn btn-primary" type="button" [disabled]="busy() || !title().trim()" (click)="save()">Guardar</button>
      </ng-container>
    </app-dialog>
  `,
})
export class EpisodeDialog {
  private readonly admin = inject(AdminApi);
  readonly episode = input.required<EpisodeItem>();
  readonly seriesName = input('');
  readonly seasons = input<number[]>([]);
  readonly types = input<CatalogItem[]>([]);
  readonly closed = output<void>();
  readonly saved = output<void>();

  readonly title = signal('');
  readonly season = signal(1);
  readonly number = signal(1);
  readonly typeId = signal(1);
  readonly part = signal('');
  readonly busy = signal(false);
  readonly error = signal('');
  readonly confirmDelete = signal(false);
  readonly size = computed(() => {
    const bytes = this.episode().fileSizeBytes;
    return bytes ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : 'tamaño desconocido';
  });

  ngOnInit(): void {
    const e = this.episode();
    this.title.set(e.title);
    this.season.set(e.seasonNumber);
    this.number.set(e.episodeNumber);
    this.typeId.set(e.episodeTypeId);
    this.part.set(e.episodePart ?? '');
  }

  async save(): Promise<void> {
    this.busy.set(true);
    try {
      await this.admin.updateEpisode(this.episode().id, { title: this.title().trim(), seasonNumber: this.season(), episodeNumber: this.number(), episodeTypeId: this.typeId(), episodePart: this.part() || null });
      this.saved.emit();
    } catch (error) {
      this.error.set(errorMessage(error, 'No se pudo guardar el episodio.'));
    } finally {
      this.busy.set(false);
    }
  }

  async remove(): Promise<void> {
    try {
      await this.admin.deleteEpisode(this.episode().id);
      this.saved.emit();
    } catch (error) {
      this.error.set(errorMessage(error, 'No se pudo eliminar el episodio.'));
    }
  }
}

/** Uploads episode videos into a season, specials or movies; shows upload progress and the per-file result. */
@Component({
  selector: 'app-upload-dialog',
  imports: [Dialog],
  template: `
    <app-dialog [eyebrow]="seriesName().toUpperCase()" heading="Subir episodios" (closed)="cancel()">
      <div class="grid grid-cols-2 gap-2.5">
        <label class="flex flex-col gap-1.5 text-[12px] text-muted">Destino
          <select class="field field-select" (change)="target.set($any($event.target).value)">
            <option value="season">Temporada</option><option value="specials">Especiales</option><option value="movies">Películas</option>
          </select>
        </label>
        @if (target() === 'season') {
          <label class="flex flex-col gap-1.5 text-[12px] text-muted">Temporada
            <select class="field field-select" (change)="season.set(+$any($event.target).value)">
              @for (t of regularSeasons(); track t) { <option [value]="t" [selected]="t === season()">T{{ t }}</option> }
            </select>
          </label>
        }
      </div>
      <label class="relative flex flex-col items-center justify-center gap-2 min-h-28 border border-dashed border-edge-2 rounded-lg cursor-pointer text-[13px] text-muted text-center">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFB547" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16V4"></path><path d="M7 9l5-5 5 5"></path><path d="M4 20h16"></path></svg>
        {{ files().length ? files().length + ' archivos elegidos' : 'Elige uno o varios videos (MP4, MKV, AVI…)' }}
        <input class="absolute w-px h-px opacity-0" type="file" accept="video/*,.mkv,.avi" multiple (change)="pickFiles($any($event.target).files)">
      </label>
      <span class="text-[12px] text-muted">El número de episodio se toma del nombre del archivo. Los formatos que el navegador no reproduce esperan al transcodificador.</span>
      @if (progress() !== null) {
        <div class="h-1.5 rounded-[3px] bg-line"><div class="h-1.5 rounded-[3px] bg-amber" [style.width.%]="progress()"></div></div>
        <span class="font-mono text-[12px] text-muted">{{ progress() }}%</span>
      }
      @for (r of results(); track r.fileName) {
        <span class="text-[13px]" [class]="r.success ? 'text-ok' : 'text-danger'">{{ r.success ? '✓' : '✕' }} {{ r.fileName }}{{ r.message ? ' · ' + r.message : '' }}</span>
      }
      @if (error()) { <span class="text-[13px] text-danger" role="alert">{{ error() }}</span> }

      <ng-container footer>
        <button class="btn btn-ghost" type="button" (click)="cancel()">{{ results().length ? 'Cerrar' : 'Cancelar' }}</button>
        <button class="btn btn-primary" type="button" [disabled]="!files().length || progress() !== null" (click)="upload()">Subir</button>
      </ng-container>
    </app-dialog>
  `,
})
export class UploadDialog {
  private readonly admin = inject(AdminApi);
  readonly seriesId = input.required<number>();
  readonly seriesName = input('');
  readonly seasons = input<number[]>([]);
  readonly closed = output<void>();
  readonly uploaded = output<void>();

  readonly target = signal<'season' | 'specials' | 'movies'>('season');
  readonly season = signal(1);
  readonly files = signal<File[]>([]);
  readonly progress = signal<number | null>(null);
  readonly results = signal<EpisodeUploadResult[]>([]);
  readonly error = signal('');
  readonly regularSeasons = computed(() => { const list = this.seasons().filter(s => s > 0); return list.length ? list : [1]; });
  private subscription: Subscription | null = null;

  constructor() { inject(DestroyRef).onDestroy(() => this.subscription?.unsubscribe()); }

  ngOnInit(): void { this.season.set(this.regularSeasons()[0]); }

  pickFiles(list: FileList | null): void { this.files.set(list ? Array.from(list) : []); }

  upload(): void {
    this.progress.set(0);
    this.error.set('');
    this.subscription = this.admin.uploadEpisodes(this.seriesId(), this.target(), this.target() === 'season' ? this.season() : null, this.files()).subscribe({
      next: event => {
        this.progress.set(event.progress);
        if (event.result) { this.results.set(event.result); this.files.set([]); this.uploaded.emit(); }
      },
      error: error => { this.error.set(errorMessage(error, 'No se pudieron subir los archivos.')); this.progress.set(null); },
      complete: () => this.progress.set(null),
    });
  }

  cancel(): void {
    this.subscription?.unsubscribe();
    this.closed.emit();
  }
}

/** Design: "Diálogo · Temporada". */
@Component({
  selector: 'app-season-dialog',
  imports: [Dialog],
  template: `
    <app-dialog [eyebrow]="seriesName().toUpperCase()" heading="Agregar temporada" gap="gap-2.5" (closed)="closed.emit()">
      <label class="flex flex-col gap-1.5 text-[12px] text-muted">Número de temporada
        <input class="field [font:16px_'IBM_Plex_Mono',_monospace]" type="number" min="0" max="999" [value]="number()" (input)="number.set(+$any($event.target).value)">
      </label>
      <span class="text-[12px] text-muted">Usa 0 para especiales. Existentes: {{ existing() || 'ninguna' }}.</span>
      @if (error()) { <span class="text-[13px] text-danger" role="alert">{{ error() }}</span> }
      <ng-container footer>
        <button class="btn btn-ghost" type="button" (click)="closed.emit()">Cancelar</button>
        <button class="btn btn-primary" type="button" (click)="save()">Agregar</button>
      </ng-container>
    </app-dialog>
  `,
})
export class SeasonDialog {
  private readonly admin = inject(AdminApi);
  readonly seriesId = input.required<number>();
  readonly seriesName = input('');
  readonly seasons = input<number[]>([]);
  readonly closed = output<void>();
  readonly saved = output<void>();
  readonly number = signal(1);
  readonly error = signal('');
  readonly existing = computed(() => this.seasons().map(s => `T${s}`).join(', '));

  ngOnInit(): void { this.number.set(Math.max(0, ...this.seasons()) + 1); }

  async save(): Promise<void> {
    try {
      await this.admin.addSeason(this.seriesId(), this.number());
      this.saved.emit();
    } catch (error) {
      this.error.set(errorMessage(error, 'No se pudo agregar la temporada.'));
    }
  }
}

/** Design: "Diálogo · Punto de corte". */
@Component({
  selector: 'app-breakpoint-dialog',
  imports: [Dialog],
  template: `
    <app-dialog [eyebrow]="episodeLabel().toUpperCase()" heading="Punto de corte" (closed)="closed.emit()">
      <div class="grid grid-cols-2 gap-2.5">
        <label class="flex flex-col gap-1.5 text-[12px] text-muted">Posición (mm:ss.mmm)
          <input class="field [font:15px_'IBM_Plex_Mono',_monospace]" type="text" placeholder="07:12.400" inputmode="decimal" [value]="offset()" (input)="offset.set($any($event.target).value)">
        </label>
        <label class="flex flex-col gap-1.5 text-[12px] text-muted">Etiqueta (opcional)
          <input class="field" type="text" maxlength="200" [value]="label()" (input)="label.set($any($event.target).value)">
        </label>
      </div>
      <span class="text-[12px] text-muted">Debe ser mayor a 0 y distinto de los otros puntos del episodio.</span>
      @if (error()) { <span class="text-[13px] text-danger" role="alert">{{ error() }}</span> }
      <ng-container footer>
        <button class="btn btn-ghost" type="button" (click)="closed.emit()">Cancelar</button>
        <button class="btn btn-primary" type="button" (click)="save()">Guardar</button>
      </ng-container>
    </app-dialog>
  `,
})
export class BreakpointDialog {
  private readonly admin = inject(AdminApi);
  readonly episodeId = input.required<number>();
  readonly episodeLabel = input('');
  readonly closed = output<void>();
  readonly saved = output<void>();
  readonly offset = signal('');
  readonly label = signal('');
  readonly error = signal('');

  async save(): Promise<void> {
    const seconds = parseOffset(this.offset());
    if (seconds === null) { this.error.set('Escribe la posición como mm:ss.mmm (por ejemplo 07:12.400).'); return; }
    try {
      await this.admin.addBreakPoint(this.episodeId(), seconds, this.label().trim() || null);
      this.saved.emit();
    } catch (error) {
      this.error.set(errorMessage(error, 'No se pudo guardar el punto de corte.'));
    }
  }
}

/** Design: "Diálogo · Importar metadatos". */
@Component({
  selector: 'app-import-dialog',
  imports: [Dialog],
  template: `
    <app-dialog [eyebrow]="seriesName().toUpperCase()" heading="Importar metadatos" (closed)="closed.emit()">
      <div class="grid grid-cols-2 gap-2.5">
        <label class="flex flex-col gap-1.5 text-[12px] text-muted">Proveedor
          <select class="field field-select" (change)="pickProvider(+$any($event.target).value)">
            @for (p of providers(); track p.id) { <option [value]="p.id" [selected]="p.id === providerId()">{{ p.name }}</option> }
          </select>
        </label>
        <label class="flex flex-col gap-1.5 text-[12px] text-muted">ID externo <input class="field field-mono" type="text" maxlength="300" [value]="externalId()" (input)="externalId.set($any($event.target).value)"></label>
      </div>
      <label class="flex flex-col gap-1.5 text-[12px] text-muted">Idioma
        <select class="field field-select" (change)="language.set($any($event.target).value)">
          <option value="es-MX">es-MX · Español (Latinoamérica)</option><option value="es-ES">es-ES · Español (España)</option><option value="en-US">en-US · English</option>
        </select>
      </label>
      <fieldset class="m-0 p-0 border-0 flex flex-col gap-0.5">
        <legend class="pb-1.5 text-[12px] text-muted">Sobrescribir</legend>
        <label class="flex items-center gap-2.5 min-h-10 text-[14px]"><input class="check" type="checkbox" [checked]="details()" (change)="details.set(!details())">Descripción y rating</label>
        <label class="flex items-center gap-2.5 min-h-10 text-[14px]"><input class="check" type="checkbox" [checked]="titles()" (change)="titles.set(!titles())">Títulos de episodios</label>
      </fieldset>
      @if (result()) { <div class="py-2.5 px-3 rounded-md bg-raised text-[12px]" [class]="result()!.ok ? 'text-ok' : 'text-danger'">{{ result()!.text }}</div> }
      @if (error()) { <span class="text-[13px] text-danger" role="alert">{{ error() }}</span> }
      <ng-container footer>
        <button class="btn btn-ghost" type="button" (click)="closed.emit()">{{ result() ? 'Cerrar' : 'Cancelar' }}</button>
        <button class="btn btn-primary" type="button" [disabled]="busy() || !providerId() || !externalId().trim()" (click)="run()">{{ busy() ? 'Importando…' : 'Importar' }}</button>
      </ng-container>
    </app-dialog>
  `,
})
export class ImportDialog {
  private readonly admin = inject(AdminApi);
  readonly seriesId = input.required<number>();
  readonly seriesName = input('');
  readonly externalIds = input<ExternalIdItem[]>([]);
  readonly closed = output<void>();
  readonly imported = output<void>();

  readonly providers = signal<MetadataProviderItem[]>([]);
  readonly providerId = signal(0);
  readonly externalId = signal('');
  readonly language = signal('es-MX');
  readonly details = signal(true);
  readonly titles = signal(true);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly result = signal<{ ok: boolean; text: string } | null>(null);

  async ngOnInit(): Promise<void> {
    try {
      const providers = await this.admin.providers();
      this.providers.set(providers);
      if (providers.length) this.pickProvider(this.externalIds()[0]?.providerId ?? providers[0].id);
    } catch (error) {
      this.error.set(errorMessage(error));
    }
  }

  pickProvider(id: number): void {
    this.providerId.set(id);
    this.externalId.set(this.externalIds().find(x => x.providerId === id)?.externalId ?? '');
  }

  async run(): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    try {
      await this.admin.setExternalId(this.seriesId(), this.providerId(), this.externalId().trim());
      const r = await this.admin.importMetadata(this.seriesId(), this.providerId(), this.language(), this.details(), this.titles());
      const ok = r.status.toLowerCase() === 'completed';
      this.result.set({ ok, text: ok ? `Importación completada · ${r.updatedEpisodes} episodios actualizados` : `Importación ${r.status.toLowerCase()}${r.message ? ' · ' + r.message : ''}` });
      this.imported.emit();
    } catch (error) {
      this.error.set(errorMessage(error, 'No se pudo importar.'));
    } finally {
      this.busy.set(false);
    }
  }
}
