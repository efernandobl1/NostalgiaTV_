import { Component, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, of, throwError } from 'rxjs';
import {
  BroadcastAdminService,
  BreakRules,
  ClipAssignment,
  Interlude,
  interludeSeasonLabel,
} from '../broadcast-admin.service';

@Component({
  selector: 'app-commercial-breaks',
  imports: [FormsModule, RouterLink],
  templateUrl: './commercial-breaks.component.html',
  styleUrl: './commercial-breaks.component.scss',
})
export class CommercialBreaksComponent {
  readonly seasonLabel = interludeSeasonLabel;
  readonly eraId = input.required<number>();
  private readonly service = inject(BroadcastAdminService);
  readonly clips = signal<Interlude[]>([]);
  readonly assignments = signal<ClipAssignment[]>([]);
  readonly loading = signal(true);
  readonly loaded = signal(false);
  readonly enabled = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly feedback = signal('');
  readonly editing = signal<ClipAssignment | null>(null);
  editWeight = 1;
  editGap = 0;
  readonly roles = [
    { id: 0, title: 'Entrada a publicidad', subtitle: 'Bumper antes de los anuncios' },
    { id: 1, title: 'Anuncios', subtitle: 'Piezas publicitarias de esta era' },
    { id: 2, title: 'Regreso a la serie', subtitle: 'Bumper al terminar los anuncios' },
  ];
  rules: BreakRules = { minimumAds: 1, maximumAds: 3, maximumBreakSeconds: 180 };
  draft: Record<number, { clipId: number | null; weight: number; minimumGapSeconds: number }> = {
    0: { clipId: null, weight: 1, minimumGapSeconds: 0 },
    1: { clipId: null, weight: 1, minimumGapSeconds: 3600 },
    2: { clipId: null, weight: 1, minimumGapSeconds: 0 },
  };
  constructor() {
    effect(() => {
      const eraId = this.eraId();
      this.load(eraId);
    });
  }
  load(eraId = this.eraId()): void {
    this.loading.set(true);
    this.loaded.set(false);
    this.editing.set(null);
    this.error.set('');
    forkJoin({
      clips: this.service.getInterludes(),
      assignments: this.service.getAssignments(eraId),
      rules: this.service
        .getRules(eraId)
        .pipe(catchError((error) => (error.status === 404 ? of(null) : throwError(() => error)))),
    }).subscribe({
      next: (result) => {
        if (eraId !== this.eraId()) return;
        this.clips.set(result.clips);
        this.assignments.set(result.assignments);
        this.enabled.set(!!result.rules);
        this.rules = result.rules ?? { minimumAds: 1, maximumAds: 3, maximumBreakSeconds: 180 };
        this.loading.set(false);
        this.loaded.set(true);
      },
      error: () => {
        this.error.set('No se pudieron cargar las pausas publicitarias.');
        this.loading.set(false);
      },
    });
  }
  options(role: number): Interlude[] {
    return this.clips().filter(
      (clip) =>
        clip.kind === (role === 1 ? 1 : 0) &&
        !this.assignments().some((item) => item.role === role && item.interludeId === clip.id),
    );
  }
  assigned(role: number): ClipAssignment[] {
    return this.assignments().filter((item) => item.role === role);
  }
  clip(id: number): Interlude | undefined {
    return this.clips().find((clip) => clip.id === id);
  }
  saveRules(): void {
    if (this.busy()) return;
    if (
      this.enabled() &&
      (!Object.values(this.rules).every(Number.isInteger) ||
        this.rules.minimumAds < 1 ||
        this.rules.maximumAds < this.rules.minimumAds ||
        this.rules.maximumAds > 12 ||
        this.rules.maximumBreakSeconds < 1 ||
        this.rules.maximumBreakSeconds > 1800)
    ) {
      this.error.set('Elige entre 1 y 12 anuncios y una duración máxima de 1 a 1800 segundos.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    (this.enabled()
      ? this.service.setRules(this.eraId(), this.rules)
      : this.service.disableRules(this.eraId())
    ).subscribe({
      next: () => {
        this.busy.set(false);
        this.feedback.set('Reglas de publicidad guardadas');
      },
      error: () => {
        this.busy.set(false);
        this.error.set('No se pudieron guardar las reglas.');
      },
    });
  }
  assign(role: number): void {
    const draft = this.draft[role];
    if (!draft.clipId || this.busy()) return;
    if (!this.validFrequency(draft.weight, draft.minimumGapSeconds)) return;
    this.busy.set(true);
    this.error.set('');
    this.service
      .assign(this.eraId(), draft.clipId, role, draft.weight, draft.minimumGapSeconds)
      .subscribe({
        next: (item) => {
          this.assignments.update((items) => [...items, item]);
          draft.clipId = null;
          this.busy.set(false);
        },
        error: () => {
          this.busy.set(false);
          this.error.set(
            'No se pudo asignar el archivo. Revisa su frecuencia y separación mínima.',
          );
        },
      });
  }
  edit(item: ClipAssignment): void {
    this.editing.set(item);
    this.editWeight = item.weight;
    this.editGap = item.minimumGapSeconds;
  }
  saveAssignment(): void {
    const item = this.editing();
    if (!item || this.busy() || !this.validFrequency(this.editWeight, this.editGap)) return;
    this.busy.set(true);
    this.error.set('');
    this.service
      .assign(this.eraId(), item.interludeId, item.role, this.editWeight, this.editGap)
      .subscribe({
        next: (updated) => {
          this.assignments.update((items) =>
            items.map((value) => (value === item ? updated : value)),
          );
          this.editing.set(null);
          this.busy.set(false);
        },
        error: () => {
          this.busy.set(false);
          this.error.set('No se pudo cambiar la frecuencia del archivo.');
        },
      });
  }
  private validFrequency(weight: number, gap: number): boolean {
    const valid =
      Number.isInteger(weight) &&
      weight >= 1 &&
      weight <= 100 &&
      Number.isInteger(gap) &&
      gap >= 0 &&
      gap <= 604800;
    if (!valid)
      this.error.set(
        'La frecuencia debe estar entre 1 y 100; la separación, entre 0 y 604800 segundos.',
      );
    return valid;
  }
  remove(item: ClipAssignment): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.service.remove(this.eraId(), item.interludeId, item.role).subscribe({
      next: () => {
        this.assignments.update((items) => items.filter((value) => value !== item));
        this.busy.set(false);
      },
      error: () => {
        this.busy.set(false);
        this.error.set('No se pudo quitar el archivo de esta era.');
      },
    });
  }
}
