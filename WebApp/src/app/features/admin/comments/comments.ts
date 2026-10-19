import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { AdminApi } from '../../../core/api/admin-api';
import { errorMessage } from '../../../core/api/api';
import { ModerationPage } from '../../../core/api/models';
import { ago } from '../../../core/data/public-data';
import { PageHeader } from '../../../shared/ui/page-header';

const STATUSES = ['Pending', 'Approved', 'Rejected', 'Hidden'];
const STATUS: [string, string][] = [['PENDIENTE', '#FFB547'], ['APROBADO', '#8BE08F'], ['RECHAZADO', '#FF8A80'], ['OCULTO', '#A29E91']];

/** Moderation queue: approve, reject or hide comments (one or many). */
@Component({
  selector: 'app-comments',
  imports: [PageHeader],
  host: { class: 'flex flex-col gap-6' },
  templateUrl: './comments.html',
})
export class Comments {
  private readonly admin = inject(AdminApi);
  readonly labels = ['Pendientes', 'Aprobados', 'Rechazados', 'Ocultos'];
  readonly tab = signal(0);
  readonly target = signal<'' | 'channel' | 'series'>('');
  readonly data = signal<ModerationPage | null>(null);
  readonly page = signal(1);
  readonly error = signal('');
  readonly loading = signal(true);
  readonly counts = computed(() => STATUSES.map(s => this.data()?.counts[s] ?? 0));
  readonly status = computed(() => STATUS[this.tab()]);
  readonly items = computed(() => (this.data()?.items ?? [])
    .filter(c => !this.target() || c.targetType === this.target())
    .map(c => ({
      id: c.id, user: c.author, isSeries: c.targetType === 'series', target: `${c.targetType === 'series' ? 'SERIE' : 'CANAL'} · ${c.targetName}`,
      replyTo: c.parentCommentId ? `#${c.parentCommentId}` : '', time: ago(c.createdAtUtc), body: c.body,
    })));
  readonly hasMore = computed(() => { const d = this.data(); return !!d && d.page * d.pageSize < d.totalCount; });
  readonly selected = signal<Set<number>>(new Set());

  constructor() {
    effect(() => {
      const tab = this.tab();
      untracked(() => { this.selected.set(new Set()); this.load(tab, 1); });
    });
  }

  async load(tab = this.tab(), page = this.page()): Promise<void> {
    try {
      const result = await this.admin.comments(STATUSES[tab], undefined, page, 25);
      this.data.set(page > 1 && this.data() ? { ...result, items: [...this.data()!.items, ...result.items] } : result);
      this.page.set(page);
      this.error.set('');
    } catch (error) {
      this.error.set(errorMessage(error, 'No se pudo cargar la moderación.'));
    } finally {
      this.loading.set(false);
    }
  }

  async move(id: number, to: number): Promise<void> {
    if (to === this.tab()) return;
    try {
      await this.admin.moderate(id, STATUSES[to]);
      await this.load(this.tab(), 1);
    } catch (error) {
      this.error.set(errorMessage(error, 'No se pudo moderar el comentario.'));
    }
  }

  toggle(id: number): void {
    this.selected.update(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  async approveSelected(): Promise<void> {
    const ids = [...this.selected()];
    if (!ids.length) return;
    try {
      await this.admin.moderateMany(ids, 'Approved');
      this.selected.set(new Set());
      await this.load(this.tab(), 1);
    } catch (error) {
      this.error.set(errorMessage(error, 'No se pudieron aprobar los comentarios.'));
    }
  }
}
