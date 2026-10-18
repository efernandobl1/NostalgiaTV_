import { Component, computed, DestroyRef, effect, inject, signal, untracked } from '@angular/core';
import { Subscription } from 'rxjs';
import { AdminApi } from '../../../core/api/admin-api';
import { errorMessage } from '../../../core/api/api';
import { InterludeItem } from '../../../core/api/models';
import { ConfirmDialog } from '../../../shared/ui/confirm-dialog';
import { PageHeader } from '../../../shared/ui/page-header';
import { InterludeDialog } from './interlude-dialog';
import { InterludeFields } from './interlude-form';
import { BUMPER_LABELS, duration, SEASON_LABELS } from './interlude-labels';

@Component({
  selector: 'app-interludes',
  imports: [PageHeader, ConfirmDialog, InterludeDialog],
  host: { class: 'flex flex-col gap-6' },
  templateUrl: './interludes.html',
})
export class Interludes {
  private readonly admin = inject(AdminApi);

  readonly all = signal<InterludeItem[]>([]);
  readonly kind = signal(0);
  readonly bumper = signal('');
  readonly season = signal('');
  readonly kinds = computed<[string, number][]>(() => {
    const list = this.all();
    return [['Todos', list.length], ['Bumpers', list.filter(i => i.kind === 'Bumper').length], ['Anuncios', list.filter(i => i.kind === 'Advertisement').length]];
  });
  readonly rows = computed(() => this.all()
    .filter(i => this.kind() === 0 || (this.kind() === 1 ? i.kind === 'Bumper' : i.kind === 'Advertisement'))
    .filter(i => !this.bumper() || i.bumperType === this.bumper())
    .map(i => ({
      id: i.id, title: i.title, item: i,
      kind: i.kind === 'Bumper' ? `BUMPER · ${(BUMPER_LABELS[i.bumperType ?? ''] ?? 'Genérico').toUpperCase()}` : 'ANUNCIO',
      color: i.kind === 'Bumper' ? '#B8A6FF' : '#6FD0EA', season: SEASON_LABELS[i.season] ?? i.season, dur: duration(i.durationSeconds),
      years: i.originalYearFrom ? (i.originalYearTo && i.originalYearTo !== i.originalYearFrom ? `${i.originalYearFrom}–${i.originalYearTo}` : String(i.originalYearFrom)) : '—',
      approved: i.approvedForBroadcast ? 'Aprobado' : 'Pendiente', apColor: i.approvedForBroadcast ? '#8BE08F' : '#FFB547', license: i.license ?? '—',
    })));

  readonly loading = signal(true);
  readonly error = signal('');
  readonly notice = signal('');
  readonly dlg = signal<'edit' | 'delete' | null>(null);
  readonly selected = signal<InterludeItem | null>(null);

  // Upload panel
  readonly f = new InterludeFields();
  readonly file = signal<File | null>(null);
  readonly progress = signal<number | null>(null);
  private subscription: Subscription | null = null;

  constructor() {
    effect(() => {
      const season = this.season();
      untracked(() => this.load(season));
    });
    inject(DestroyRef).onDestroy(() => this.subscription?.unsubscribe());
  }

  async load(season = this.season()): Promise<void> {
    try {
      this.all.set(await this.admin.interludes({ season: season || undefined }));
      this.error.set('');
    } catch (error) {
      this.error.set(errorMessage(error, 'No se pudo cargar la biblioteca.'));
    } finally {
      this.loading.set(false);
    }
  }

  edit(item: InterludeItem): void { this.selected.set(item); this.dlg.set('edit'); }
  askDelete(item: InterludeItem): void { this.selected.set(item); this.dlg.set('delete'); }

  async remove(): Promise<void> {
    const item = this.selected();
    if (!item) return;
    try {
      await this.admin.deleteInterlude(item.id);
      await this.load();
    } catch (error) {
      this.error.set(errorMessage(error, 'No se pudo eliminar el interludio.'));
    }
  }

  async saved(): Promise<void> {
    this.dlg.set(null);
    await this.load();
  }

  pick(file: File | undefined): void {
    if (!file) return;
    this.file.set(file);
    if (!this.f.title()) this.f.title.set(file.name.replace(/\.[^.]+$/, ''));
  }

  upload(): void {
    const file = this.file();
    if (!file || this.f.licenseMissing()) return;
    const approve = this.f.approved();
    this.progress.set(0);
    this.error.set('');
    this.subscription = this.admin.uploadInterlude(this.f.value(), file).subscribe({
      next: async event => {
        this.progress.set(event.progress);
        if (event.result) {
          if (approve && !event.result.approvedForBroadcast) await this.admin.approveInterlude(event.result.id, true).catch(() => undefined);
          this.notice.set(`«${event.result.title}» subido · ${duration(event.result.durationSeconds)}.`);
          this.file.set(null);
          this.f.title.set('');
          await this.load();
        }
      },
      error: error => { this.error.set(errorMessage(error, 'No se pudo subir el interludio.')); this.progress.set(null); },
      complete: () => this.progress.set(null),
    });
  }
}
