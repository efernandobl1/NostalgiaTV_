import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { AdminApi } from '../../../core/api/admin-api';
import { errorMessage } from '../../../core/api/api';
import { PendingAuthorizationItem, ViewerKpis, ViewerProfileDetail, ViewerProfileItem } from '../../../core/api/models';
import { ago, episodeCode, playTime } from '../../../core/data/public-data';
import { ConfirmDialog } from '../../../shared/ui/confirm-dialog';
import { PageHeader } from '../../../shared/ui/page-header';

const PAGE = 25;

@Component({
  selector: 'app-viewers',
  imports: [PageHeader, ConfirmDialog],
  host: { class: 'flex flex-col gap-6' },
  templateUrl: './viewers.html',
})
export class Viewers {
  private readonly admin = inject(AdminApi);

  readonly stats = signal<ViewerKpis | null>(null);
  readonly items = signal<ViewerProfileItem[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly q = signal('');
  readonly detail = signal<ViewerProfileDetail | null>(null);
  readonly authorizations = signal<PendingAuthorizationItem[]>([]);
  readonly error = signal('');
  readonly loading = signal(true);

  readonly kpis = computed(() => {
    const k = this.stats();
    return [
      { label: 'PERFILES', value: String(k?.profiles ?? 0), note: `${k?.linkedProfiles ?? 0} con cuenta · ${(k?.profiles ?? 0) - (k?.linkedProfiles ?? 0)} anónimos` },
      { label: 'DISPOSITIVOS ACTIVOS', value: String(k?.activeDevices ?? 0), note: `Viendo ahora: ${k?.watchingNow ?? 0}` },
      { label: 'CÓDIGOS DE VINCULACIÓN', value: String(k?.pendingAuthorizations ?? 0), note: 'Pendientes de confirmar' },
      { label: 'EPISODIOS COMPLETADOS', value: String(k?.episodesCompleted7d ?? 0), note: 'Últimos 7 días' },
    ];
  });
  readonly profiles = computed(() => this.items().map(p => ({
    id: p.id, name: p.username ?? 'Anónimo', initials: (p.username ?? 'AN').slice(0, 2).toUpperCase(),
    short: `${p.id.slice(0, 4)}…${p.id.slice(-4)}`, devices: p.deviceCount, seen: p.lastSeenUtc ? ago(p.lastSeenUtc) : 'nunca',
  })));
  readonly profile = signal(0);
  readonly sel = computed(() => this.profiles()[this.profile()] ?? null);
  readonly hasMore = computed(() => this.items().length < this.total());

  readonly devices = computed(() => {
    const now = Date.now();
    return (this.detail()?.devices ?? []).map(d => ({
      id: d.id, name: d.name, seen: ago(d.lastSeenUtc), color: now - new Date(d.lastSeenUtc).getTime() < 24 * 3600_000 ? '#8BE08F' : '#A29E91',
      expires: new Date(d.expiresAtUtc).toLocaleDateString('es', { day: '2-digit', month: 'short' }),
    }));
  });
  readonly progress = computed(() => (this.detail()?.progress ?? []).map(p => ({
    series: p.seriesName, code: episodeCode(p.seasonNumber, p.episodeNumber, null, p.episodePart), state: p.completed ? 'COMPLETADO' : `EN CURSO · ${playTime(p.currentSecond)}`,
    color: p.completed ? '#8BE08F' : '#FFB547', pct: p.completed ? 100 : 0, when: ago(p.updatedAtUtc), key: p.episodeId,
  })));
  readonly pending = computed(() => this.authorizations().map(a => ({
    name: a.name, kind: a.approved ? `Aprobado por ${a.username ?? 'un espectador'} · esperando a la TV` : 'Esperando aprobación',
    exp: `${Math.max(0, Math.round((new Date(a.expiresAtUtc).getTime() - Date.now()) / 60_000))} min`,
  })));

  /** null = closed, '' = revoke all, otherwise the device id. */
  readonly revoking = signal<string | null>(null);
  readonly revokeHeading = computed(() => {
    const id = this.revoking();
    const device = this.devices().find(d => d.id === id);
    return device ? `¿Revocar «${device.name}»?` : `¿Revocar todos los dispositivos de ${this.sel()?.name ?? ''}?`;
  });
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.admin.viewerKpis().then(k => this.stats.set(k)).catch(() => {});
    this.admin.pendingAuthorizations().then(a => this.authorizations.set(a)).catch(() => {});
    effect(() => {
      const q = this.q().trim();
      untracked(() => {
        if (this.searchTimer) clearTimeout(this.searchTimer);
        this.searchTimer = setTimeout(() => this.load(1, q), q ? 300 : 0);
      });
    });
    effect(() => {
      const p = this.sel();
      untracked(() => { if (p) this.loadDetail(p.id); else this.detail.set(null); });
    });
  }

  async load(page = 1, search = this.q().trim()): Promise<void> {
    try {
      const result = await this.admin.viewers(search || undefined, page, PAGE);
      this.items.set(page === 1 ? result.items : [...this.items(), ...result.items]);
      this.total.set(result.totalCount);
      this.page.set(page);
      if (page === 1) this.profile.set(0);
      this.error.set('');
    } catch (error) {
      this.error.set(errorMessage(error, 'No se pudieron cargar los perfiles.'));
    } finally {
      this.loading.set(false);
    }
  }

  private async loadDetail(id: string): Promise<void> {
    try { this.detail.set(await this.admin.viewer(id)); }
    catch (error) { this.error.set(errorMessage(error, 'No se pudo cargar el perfil.')); }
  }

  async revoke(): Promise<void> {
    const target = this.revoking();
    const ids = target ? [target] : this.devices().map(d => d.id);
    try {
      for (const id of ids) await this.admin.revokeDevice(id);
      const p = this.sel();
      if (p) await this.loadDetail(p.id);
      this.admin.viewerKpis().then(k => this.stats.set(k)).catch(() => {});
    } catch (error) {
      this.error.set(errorMessage(error, 'No se pudo revocar.'));
    }
  }
}
