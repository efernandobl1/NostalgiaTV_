import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Api, errorMessage } from '../../../core/api/api';
import { MyComment as MyCommentDto } from '../../../core/api/models';
import { ago, episodeCode, playTime } from '../../../core/data/public-data';
import { Session } from '../../../core/session';
import { ConfirmDialog } from '../../../shared/ui/confirm-dialog';
import { ProgressBar } from '../../../shared/ui/progress-bar';
import { passwordValid } from '../../auth/password';

type Status = 'pending' | 'published' | 'rejected';
interface MyComment { id: number; target: string; short: string; link: (string | number)[]; time: string; status: Status; body: string }

const STATUS = {
  pending: { label: 'PENDIENTE DE MODERACIÓN', short: 'PENDIENTE', color: '#FFB547' },
  published: { label: 'PUBLICADO', short: 'PUBLICADO', color: '#8BE08F' },
  rejected: { label: 'RECHAZADO', short: 'RECHAZADO', color: '#FF8A80' },
};

function statusOf(value: string): Status {
  const v = value.toLowerCase();
  return v === 'approved' || v === 'published' ? 'published' : v === 'rejected' ? 'rejected' : 'pending';
}

const PREFS_KEY = 'ntv.prefs';

interface Pref { key: string; label: string; hint: string; on: boolean }

/** Design: "Web · Perfil e historial" + "Móvil · Perfil e historial". */
@Component({
  selector: 'app-profile',
  imports: [RouterLink, ProgressBar, ConfirmDialog],
  host: { class: 'flex-1 flex flex-col' },
  templateUrl: './profile.html',
})
export class Profile {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  protected readonly session = inject(Session);
  readonly status = STATUS;

  readonly tab = signal(0);
  readonly filter = signal(0);
  readonly confirm = signal<'clear' | 'everywhere' | null>(null);
  readonly error = signal('');

  readonly deviceCount = computed(() => this.session.viewer()?.devices.length ?? 0);
  readonly watchedCount = computed(() => (this.session.viewer()?.progress ?? []).filter(p => p.completed).length);

  /** Latest episode per series, newest first. */
  readonly history = computed(() => {
    const seen = new Set<number>();
    return [...(this.session.viewer()?.progress ?? [])]
      .sort((a, b) => b.updatedAtUtc.localeCompare(a.updatedAtUtc))
      .filter(p => !seen.has(p.seriesId) && seen.add(p.seriesId))
      .map(p => ({
        id: p.seriesId, episodeId: p.episodeId, series: p.seriesName, code: episodeCode(p.seasonNumber, p.episodeNumber, null, p.episodePart), title: p.episodeTitle,
        pct: p.completed ? 100 : 0, done: p.completed, at: playTime(p.currentSecond), when: ago(p.updatedAtUtc), mobileWhen: ago(p.updatedAtUtc),
      }));
  });
  readonly filtered = computed(() => {
    const f = this.filter();
    return this.history().filter(h => f === 0 || (f === 1 ? !h.done : h.done));
  });

  private readonly rawComments = signal<MyCommentDto[]>([]);
  readonly comments = computed<MyComment[]>(() => this.rawComments().map(c => {
    const kind = c.targetType === 'series' ? 'Serie' : 'Canal';
    return {
      id: c.id, target: `${kind} · ${c.targetName}`, short: c.targetType === 'series' ? c.targetName : `Canal · ${c.targetName}`,
      link: c.targetType === 'series' ? ['/series', c.targetId] : ['/canal', c.targetId], time: ago(c.editedAtUtc ?? c.createdAtUtc),
      status: statusOf(c.status), body: c.body,
    };
  }));
  readonly editing = signal<number | null>(null);

  // Account
  readonly googleLinked = computed(() => (this.session.me()?.externalLogins ?? []).some(l => l.toLowerCase() === 'google'));
  readonly hasPassword = computed(() => this.session.me()?.hasPassword ?? false);
  readonly passwordError = signal('');

  /** Device preferences (kept in this browser). */
  readonly settings = signal<Pref[]>(this.readPrefs([
    { key: 'mobileData', label: 'Reproducir con datos móviles', hint: 'Si está apagado, solo con Wi-Fi', on: true },
    { key: 'channelNumber', label: 'Mostrar número al cambiar de canal', hint: 'Número verde estilo TV de tubo', on: true },
    { key: 'seasonal', label: 'Efectos de temporada', hint: 'Halloween y Navidad', on: true },
  ]));

  constructor() {
    effect(() => {
      const signedIn = this.session.signedIn();
      untracked(() => { if (signedIn) this.loadComments(); else this.rawComments.set([]); });
    });
  }

  private async loadComments(): Promise<void> {
    try { this.rawComments.set(await this.api.myComments()); } catch { /* shown as empty */ }
  }

  async removeHistory(seriesId: number): Promise<void> {
    try { await this.api.resetSeries(seriesId); } catch (error) { this.error.set(errorMessage(error)); }
    await this.session.refreshViewer();
  }

  async saveComment(id: number, body: string): Promise<void> {
    const text = body.trim();
    if (!text) return;
    try {
      const updated = await this.api.editComment(id, text);
      this.rawComments.update(l => l.map(c => (c.id === id ? updated : c)));
      this.editing.set(null);
    } catch (error) {
      this.error.set(errorMessage(error, 'No se pudo guardar el comentario.'));
    }
  }

  async deleteComment(id: number): Promise<void> {
    try {
      await this.api.deleteComment(id);
      this.rawComments.update(l => l.filter(c => c.id !== id));
    } catch (error) {
      this.error.set(errorMessage(error, 'No se pudo eliminar el comentario.'));
    }
  }

  /** Changing the password ends every session, so the viewer signs in again. */
  async savePassword(current: HTMLInputElement, next: HTMLInputElement): Promise<void> {
    this.passwordError.set('');
    if ((this.hasPassword() && !current.value) || !passwordValid(next.value)) {
      this.passwordError.set('Escribe tu contraseña actual y una nueva de al menos 12 caracteres.');
      return;
    }
    try {
      await this.api.changePassword(current.value, next.value);
      await this.session.forget();
      this.router.navigate(['/login'], { queryParams: { changed: 1 } });
    } catch (error) {
      this.passwordError.set(errorMessage(error, 'No se pudo cambiar la contraseña.'));
    }
  }

  async unlinkGoogle(): Promise<void> {
    try {
      await this.api.unlinkLogin('google');
      this.session.me.set(await this.api.me());
    } catch (error) {
      this.error.set(errorMessage(error, 'No se pudo desvincular Google.'));
    }
  }

  togglePref(key: string): void {
    this.settings.update(list => list.map(s => (s.key === key ? { ...s, on: !s.on } : s)));
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(Object.fromEntries(this.settings().map(s => [s.key, s.on])))); } catch { /* private mode */ }
  }

  private readPrefs(defaults: Pref[]): Pref[] {
    try {
      const saved = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as Record<string, boolean>;
      return defaults.map(d => ({ ...d, on: saved[d.key] ?? d.on }));
    } catch {
      return defaults;
    }
  }

  async onConfirm(): Promise<void> {
    const action = this.confirm();
    try {
      if (action === 'clear') {
        await this.api.clearHistory();
        await this.session.refreshViewer();
      }
      if (action === 'everywhere') {
        await this.api.revokeAllSessions();
        await this.session.forget();
        this.router.navigateByUrl('/sesion-cerrada');
      }
    } catch (error) {
      this.error.set(errorMessage(error));
    }
  }

  async signOut(): Promise<void> {
    await this.session.signOut();
    this.router.navigateByUrl('/sesion-cerrada');
  }
}
