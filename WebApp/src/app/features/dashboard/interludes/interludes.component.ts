import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BroadcastAdminService, Interlude } from '../broadcast-admin.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-interludes',
  imports: [FormsModule, RouterLink],
  templateUrl: './interludes.component.html',
  styleUrl: './interludes.component.scss',
})
export class InterludesComponent {
  private readonly service = inject(BroadcastAdminService);
  readonly apiUrl = environment.apiUrl;
  readonly clips = signal<Interlude[]>([]);
  readonly filter = signal<number | null>(null);
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
        (!this.pendingOnly() || !clip.approvedForBroadcast) &&
        clip.title.toLocaleLowerCase().includes(this.search().toLocaleLowerCase()),
    ),
  );
  title = '';
  kind = 0;
  yearFrom: number | null = null;
  yearTo: number | null = null;
  region = '';
  private file?: File;
  constructor() {
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
  open(clip?: Interlude): void {
    this.selected.set(clip ?? null);
    this.title = clip?.title ?? '';
    this.kind = clip?.kind ?? 0;
    this.yearFrom = clip?.originalYearFrom ?? null;
    this.yearTo = clip?.originalYearTo ?? null;
    this.region = clip?.regionCode ?? '';
    this.file = undefined;
    this.error.set('');
    this.feedback.set('');
    this.editor.set(true);
  }
  chooseFile(event: Event): void {
    this.file = (event.target as HTMLInputElement).files?.[0];
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
    this.busy.set(true);
    this.error.set('');
    const clip = this.selected();
    const body = new FormData();
    body.append('title', this.title.trim());
    body.append('kind', String(this.kind));
    if (this.file) body.append('file', this.file);
    if (this.yearFrom !== null) body.append('originalYearFrom', String(this.yearFrom));
    if (this.yearTo !== null) body.append('originalYearTo', String(this.yearTo));
    if (this.region) body.append('regionCode', this.region);
    const request = clip
      ? this.service.updateInterlude({
          ...clip,
          title: this.title.trim(),
          originalYearFrom: this.yearFrom,
          originalYearTo: this.yearTo,
          regionCode: this.region || null,
        })
      : this.service.uploadInterlude(body);
    request.subscribe({
      next: (result) => {
        this.selected.set(result);
        this.busy.set(false);
        this.feedback.set('Archivo guardado');
        this.load();
      },
      error: () => {
        this.busy.set(false);
        this.error.set(
          'No se pudo guardar. Comprueba que el MP4 use H.264 y AAC y que no supere 500 MiB.',
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
