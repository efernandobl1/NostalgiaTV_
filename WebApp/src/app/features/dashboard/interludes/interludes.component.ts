import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { switchMap, of } from 'rxjs';
import {
  BroadcastAdminService,
  Interlude,
  InterludeSeason,
  INTERLUDE_SEASONS,
  interludeSeasonLabel,
} from '../broadcast-admin.service';
import { environment } from '../../../../environments/environment';
import { InterludeUploaderComponent } from './interlude-uploader.component';

@Component({
  selector: 'app-interludes',
  imports: [FormsModule, RouterLink, InterludeUploaderComponent],
  templateUrl: './interludes.component.html',
  styleUrl: './interludes.component.scss',
})
export class InterludesComponent {
  private readonly service = inject(BroadcastAdminService);
  private readonly route = inject(ActivatedRoute);
  readonly apiUrl = environment.apiUrl;
  readonly clips = signal<Interlude[]>([]);
  readonly filter = signal<number | null>(null);
  readonly seasonFilter = signal<InterludeSeason | null>(null);
  readonly seasons = INTERLUDE_SEASONS;
  readonly halloweenLibrary = computed(() => this.seasonFilter() === 1);
  readonly seasonLabel = interludeSeasonLabel;
  readonly search = signal('');
  readonly pendingOnly = signal(false);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly feedback = signal('');
  readonly editor = signal(false);
  readonly selected = signal<Interlude | null>(null);
  readonly visible = computed(() =>
    this.clips().filter(
      (clip) =>
        (this.filter() === null || clip.kind === this.filter()) &&
        (this.seasonFilter() === null || (clip.season ?? 0) === this.seasonFilter()) &&
        (!this.pendingOnly() || !clip.approvedForBroadcast) &&
        clip.title.toLocaleLowerCase().includes(this.search().toLocaleLowerCase()),
    ),
  );
  title = '';
  kind = 0;
  season: InterludeSeason = 0;
  yearFrom: number | null = null;
  yearTo: number | null = null;
  region = '';
  sourceUrl = '';
  license = '';
  redistributionAllowed = false;
  readonly targetEraId = signal<number | null>(null);
  readonly targetChannelId = signal<number | null>(null);
  readonly targetRole = signal<0 | 1 | 2>(0);
  readonly assignmentPending = signal(false);
  private file?: File;
  uploaded(clips: Interlude[]): void {
    this.clips.update((items) => [...items, ...clips]);
  }
  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const season = params.get('season');
      this.seasonFilter.set(season === 'halloween' ? 1 : season === 'christmas' ? 2 : null);
      const eraId = Number(params.get('eraId'));
      const channelId = Number(params.get('channelId'));
      this.targetChannelId.set(Number.isSafeInteger(channelId) && channelId > 0 ? channelId : null);
      const role = Number(params.get('role'));
      this.targetEraId.set(Number.isSafeInteger(eraId) && eraId > 0 ? eraId : null);
      this.targetRole.set(role === 1 || role === 2 ? role : 0);
      if (params.get('new') === '1') this.open(undefined, this.targetRole() === 1 ? 1 : 0);
    });
    this.load();
  }
  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.service.getInterludes().subscribe({
      next: (clips) => {
        this.clips.set(clips);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar el archivo publicitario.');
        this.loading.set(false);
      },
    });
  }
  open(clip?: Interlude, kind: 0 | 1 = 0): void {
    this.selected.set(clip ?? null);
    this.title = clip?.title ?? '';
    this.kind = clip?.kind ?? kind;
    this.season = clip?.season ?? this.seasonFilter() ?? 0;
    this.yearFrom = clip?.originalYearFrom ?? null;
    this.yearTo = clip?.originalYearTo ?? null;
    this.region = clip?.regionCode ?? '';
    this.sourceUrl = clip?.sourceUrl ?? '';
    this.license = clip?.license ?? '';
    this.redistributionAllowed = clip?.redistributionAllowed ?? false;
    this.assignmentPending.set(!clip && this.targetEraId() !== null);
    this.file = undefined;
    this.error.set('');
    this.feedback.set('');
    this.editor.set(true);
  }
  chooseFile(event: Event): void {
    this.file = (event.target as HTMLInputElement).files?.[0];
    if (this.file && !this.title.trim())
      this.title = this.file.name.replace(/\.mp4$/i, '').slice(0, 300);
  }
  save(): void {
    if (this.busy()) return;
    if (!this.title.trim() || (!this.selected() && !this.file)) {
      this.error.set('Introduce el título y selecciona un archivo MP4.');
      return;
    }
    if (this.yearFrom !== null && this.yearTo !== null && this.yearTo < this.yearFrom) {
      this.error.set('El año final no puede ser anterior al inicial.');
      return;
    }
    if (this.redistributionAllowed && !this.license.trim()) {
      this.error.set('Indica la licencia o permiso para compartir este archivo.');
      return;
    }
    if (this.assignmentPending() && this.kind !== (this.targetRole() === 1 ? 1 : 0)) {
      this.error.set(
        'El tipo de archivo debe coincidir con la entrada, anuncio o regreso elegido.',
      );
      return;
    }
    this.busy.set(true);
    this.error.set('');
    const clip = this.selected();
    const body = new FormData();
    body.append('title', this.title.trim());
    body.append('kind', String(this.kind));
    body.append('season', String(this.season));
    if (this.file) body.append('file', this.file);
    if (this.yearFrom !== null) body.append('originalYearFrom', String(this.yearFrom));
    if (this.yearTo !== null) body.append('originalYearTo', String(this.yearTo));
    if (this.region) body.append('regionCode', this.region);
    body.append('sourceUrl', this.sourceUrl.trim());
    body.append('license', this.license.trim());
    body.append('redistributionAllowed', String(this.redistributionAllowed));
    const request = clip
      ? this.service.updateInterlude({
          ...clip,
          title: this.title.trim(),
          season: this.season,
          originalYearFrom: this.yearFrom,
          originalYearTo: this.yearTo,
          regionCode: this.region || null,
          sourceUrl: this.sourceUrl.trim() || null,
          license: this.license.trim() || null,
          redistributionAllowed: this.redistributionAllowed,
        })
      : this.service.uploadInterlude(body);
    request
      .pipe(
        switchMap((result) => {
          this.selected.set(result);
          const eraId = this.targetEraId();
          return this.assignmentPending() && eraId
            ? this.service
                .assign(eraId, result.id, this.targetRole(), 1, this.targetRole() === 1 ? 3600 : 0)
                .pipe(
                  switchMap(() => {
                    this.assignmentPending.set(false);
                    return of(result);
                  }),
                )
            : of(result);
        }),
      )
      .subscribe({
        next: (result) => {
          this.selected.set(result);
          this.busy.set(false);
          this.feedback.set(
            this.targetEraId()
              ? 'Archivo guardado y añadido a la era. Revisa su aprobación antes de emitirlo.'
              : 'Archivo guardado',
          );
          this.load();
        },
        error: () => {
          this.busy.set(false);
          this.error.set(
            this.selected() && this.assignmentPending()
              ? 'El archivo se guardó, pero no se pudo añadir a la era. Pulsa Guardar para reintentar sin volver a subirlo.'
              : 'No se pudo guardar. Comprueba la licencia, que el MP4 use H.264 y AAC y que no supere 500 MiB.',
          );
        },
      });
  }
  approve(): void {
    const clip = this.selected();
    if (!clip || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.service.approve(clip.id, !clip.approvedForBroadcast).subscribe({
      next: () => {
        this.selected.set({ ...clip, approvedForBroadcast: !clip.approvedForBroadcast });
        this.busy.set(false);
        this.feedback.set(
          clip.approvedForBroadcast ? 'Retirado de la emisión' : 'Aprobado para emisión',
        );
        this.load();
      },
      error: () => {
        this.busy.set(false);
        this.error.set('No se pudo cambiar la aprobación.');
      },
    });
  }
  delete(): void {
    const clip = this.selected();
    if (!clip || this.busy()) return;
    if (!confirm(`¿Eliminar el registro de ${clip.title}? El archivo físico se conservará.`))
      return;
    this.busy.set(true);
    this.error.set('');
    this.service.deleteInterlude(clip.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.editor.set(false);
        this.selected.set(null);
        this.feedback.set('Registro eliminado. El archivo físico se conservó.');
        this.load();
      },
      error: () => {
        this.busy.set(false);
        this.error.set(
          'No se pudo eliminar. Quítalo de las eras y espera a que su historial de programación expire.',
        );
      },
    });
  }
  duration(seconds: number): string {
    return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
  }
}
