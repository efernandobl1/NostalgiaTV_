import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface WatchProgress {
  currentSecond: number; completed: boolean; updatedAt?: number;
  ranges?: [number, number][]; episodeId?: number;
}
export interface EpisodeRef { id: number; season: number; episodeNumber: number; }
interface PendingProgress { id: string; seriesId: number; episode: EpisodeRef; start: number; end: number; duration: number; current: number; }
export interface ViewerSession {
  profileId: string;
  devices: { id: string; name: string; lastSeenUtc: string; current: boolean }[];
  progress: { episodeId: number; seriesId: number; season: number; episodeNumber: number; currentSecond: number; completed: boolean; updatedAtUtc: string }[];
}

@Injectable({ providedIn: 'root' })
export class WatchedService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/api/v1/viewer`;
  readonly revision = signal(0);
  readonly session = signal<ViewerSession | null>(null);
  readonly syncError = signal('');
  private timer?: ReturnType<typeof setInterval>;
  private draining = false;
  constructor() {
    try { if (localStorage.getItem('viewer-linked') === 'true') this.refresh(); } catch { /* Storage is optional. */ }
    inject(DestroyRef).onDestroy(() => clearInterval(this.timer));
  }
  private key(seriesId: number): string { return `watched_${this.session()?.profileId ? this.session()!.profileId + '_' : ''}${seriesId}`; }
  private epKey(ep: EpisodeRef): string { return ep.episodeNumber > 0 ? `s${ep.season}e${ep.episodeNumber}` : `id${ep.id}`; }
  getProgress(seriesId: number): Record<string, WatchProgress> {
    this.revision();
    return this.readProgress(this.key(seriesId));
  }
  private readProgress(key: string): Record<string, WatchProgress> {
    try {
      const progress = JSON.parse(localStorage.getItem(key) ?? '{}');
      return progress && typeof progress === 'object' && !Array.isArray(progress) ? progress : {};
    } catch { return {}; }
  }
  private save(seriesId: number, progress: Record<string, WatchProgress>): void {
    try { localStorage.setItem(this.key(seriesId), JSON.stringify(progress)); } catch { this.syncError.set('El navegador no permite guardar el historial local.'); }
    this.revision.update(value => value + 1);
  }
  markProgress(seriesId: number, ep: EpisodeRef, currentSecond: number, completed: boolean): void {
    const progress = this.getProgress(seriesId), key = this.epKey(ep);
    progress[key] = { ...progress[key], currentSecond, completed: completed || !!progress[key]?.completed, updatedAt: Date.now(), episodeId: ep.id };
    this.save(seriesId, progress);
  }
  recordInterval(seriesId: number, ep: EpisodeRef, start: number, end: number, duration: number, current: number): void {
    if (![duration, start, end, current].every(Number.isFinite) || duration <= 0 || start < 0 || end > duration + 1 || current < 0 || current > duration + 1 || end < start || end - start > 45) return;
    const progress = this.getProgress(seriesId), key = this.epKey(ep);
    const ranges = WatchedService.merge([...(progress[key]?.ranges ?? []), [start, end]]);
    const completed = !!progress[key]?.completed || ranges.reduce((total, range) => total + Math.min(duration, range[1]) - Math.min(duration, range[0]), 0) >= duration * .95;
    progress[key] = { currentSecond: current, completed, ranges: ranges.slice(0, 512), updatedAt: Date.now(), episodeId: ep.id };
    this.save(seriesId, progress);
    const profile = this.session()?.profileId;
    if (!profile) return;
    const pending = this.pending(profile);
    if (pending.length >= 1000) { this.syncError.set('La cola de sincronización está llena. Conecta este dispositivo para compartir lo visto.'); return; }
    pending.push({ id: crypto.randomUUID(), seriesId, episode: ep, start, end, duration, current });
    this.storePending(profile, pending);
    this.drain();
  }
  private pending(profile: string): PendingProgress[] {
    try {
      const pending = JSON.parse(localStorage.getItem(`viewer_outbox_${profile}`) ?? '[]');
      return Array.isArray(pending) ? pending : [];
    } catch { return []; }
  }
  private storePending(profile: string, pending: PendingProgress[]): boolean {
    try { localStorage.setItem(`viewer_outbox_${profile}`, JSON.stringify(pending)); return true; }
    catch { this.syncError.set('No se pudo guardar la cola de sincronización.'); return false; }
  }
  private drain(): void {
    const profile = this.session()?.profileId;
    if (!profile || this.draining) return;
    const item = this.pending(profile)[0];
    if (!item) return;
    this.draining = true;
    this.http.post<{ completed: boolean }>(`${this.url}/progress`, { episodeId: item.episode.id, startSecond: item.start, endSecond: item.end, duration: item.duration, currentSecond: item.current }).subscribe({
      next: result => {
        const stillPending = this.pending(profile).some(entry => entry.id === item.id);
        this.storePending(profile, this.pending(profile).filter(entry => entry.id !== item.id));
        if (stillPending && result.completed && this.session()?.profileId === profile) this.markProgress(item.seriesId, item.episode, item.current, true);
        this.draining = false; this.syncError.set(''); this.drain();
      },
      error: error => {
        if ([400, 404].includes(error.status)) this.storePending(profile, this.pending(profile).filter(entry => entry.id !== item.id));
        this.draining = false;
        this.syncError.set('Historial guardado aquí. La sincronización reintentará al recuperar la conexión.');
      },
    });
  }
  static merge(ranges: [number, number][]): [number, number][] {
    const result: [number, number][] = [];
    for (const [start, end] of ranges.filter(range => range[1] > range[0]).sort((a, b) => a[0] - b[0])) {
      const last = result.at(-1);
      if (last && start <= last[1] + .25) last[1] = Math.max(last[1], end); else result.push([start, end]);
    }
    return result;
  }
  isWatched(seriesId: number, ep: EpisodeRef): boolean { return this.getProgress(seriesId)[this.epKey(ep)]?.completed ?? false; }
  getLastProgress(seriesId: number, ep: EpisodeRef): number { return this.getProgress(seriesId)[this.epKey(ep)]?.currentSecond ?? 0; }
  resetSeries(seriesId: number): void {
    if (this.session() && !window.confirm('Se reiniciará esta serie en todos los dispositivos de tu perfil. ¿Continuar?')) return;
    const profile = this.session()?.profileId;
    if (profile) this.storePending(profile, this.pending(profile).filter(item => item.seriesId !== seriesId));
    const reset = () => { try { localStorage.removeItem(this.key(seriesId)); } catch {} this.revision.update(value => value + 1); };
    if (this.session()) this.http.delete(`${this.url}/series/${seriesId}/progress`).subscribe({ next: reset, error: () => this.syncError.set('No se pudo reiniciar el historial compartido.') });
    else reset();
  }
  resetAll(): void {
    if (this.session()) { this.syncError.set('Reinicia cada serie para actualizar también los dispositivos vinculados.'); return; }
    try { Object.keys(localStorage).filter(key => /^watched_\d+$/.test(key)).forEach(key => localStorage.removeItem(key)); } catch {}
    this.revision.update(value => value + 1);
  }
  getNextUnwatched<T extends EpisodeRef>(seriesId: number, episodes: T[]): T | null {
    return episodes.find(episode => !this.isWatched(seriesId, episode)) ?? episodes[0] ?? null;
  }
  getResume<T extends EpisodeRef>(seriesId: number, episodes: T[]): T | null {
    const progress = this.getProgress(seriesId);
    const latest = episodes.filter(episode => progress[this.epKey(episode)]?.updatedAt).sort((a, b) => (progress[this.epKey(b)].updatedAt ?? 0) - (progress[this.epKey(a)].updatedAt ?? 0))[0];
    if (!latest) return this.getNextUnwatched(seriesId, episodes);
    return !progress[this.epKey(latest)].completed ? latest : episodes[episodes.findIndex(episode => episode.id === latest.id) + 1] ?? latest;
  }
  connect(name: string) { return this.http.post<ViewerSession>(`${this.url}/session`, { name }).pipe(tap(session => this.applySession(session))); }
  createCode() { return this.http.post<{ code: string; expiresAtUtc: string }>(`${this.url}/code`, {}); }
  pair(code: string) { return this.http.post(`${this.url}/pair`, { code }).pipe(tap(() => this.refresh())); }
  unlink(id: string) { return this.http.delete(`${this.url}/devices/${id}`).pipe(tap(() => this.refresh())); }
  refresh(): void {
    this.http.get<ViewerSession>(`${this.url}/session`).subscribe({
      next: session => { this.syncError.set(''); this.applySession(session); },
      error: error => {
        if (error.status === 401) { this.session.set(null); try { localStorage.removeItem('viewer-linked'); } catch {} clearInterval(this.timer); this.timer = undefined; }
        this.syncError.set('No se pudo consultar el perfil. Abre «Mi perfil» para volver a conectar.');
      },
    });
  }
  private applySession(session: ViewerSession): void {
    const moved = new Map<number, Record<string, WatchProgress>>();
    const device = session.devices.find(item => item.current);
    let previous: { id: string; profileId: string } | null = null;
    try { previous = JSON.parse(localStorage.getItem('viewer-device') ?? 'null'); } catch { /* Device metadata is not a credential. */ }
    let transferred = true;
    // Only a server-authorized move of this same device may transfer its unsent reports.
    if (device && previous?.id === device.id && previous.profileId !== session.profileId) {
      const pending = this.pending(previous.profileId);
      for (const item of pending) moved.set(item.seriesId, this.readProgress(`watched_${previous.profileId}_${item.seriesId}`));
      const combined = new Map([...this.pending(session.profileId), ...pending].map(item => [item.id, item]));
      transferred = this.storePending(session.profileId, [...combined.values()]);
      if (transferred) this.storePending(previous.profileId, []);
    }
    this.session.set(session);
    const pending = this.pending(session.profileId);
    const local = new Map(pending.map(item => [item.seriesId, this.getProgress(item.seriesId)]));
    for (const [id, previousProgress] of moved) {
      const progress = local.get(id) ?? {};
      for (const [key, item] of Object.entries(previousProgress))
        if ((item.updatedAt ?? 0) > (progress[key]?.updatedAt ?? 0)) progress[key] = item;
      local.set(id, progress);
    }
    const series = new Map<number, Record<string, WatchProgress>>();
    for (const item of session.progress) {
      const progress = series.get(item.seriesId) ?? {};
      progress[this.epKey({ id: item.episodeId, season: item.season, episodeNumber: item.episodeNumber })] = {
        currentSecond: item.currentSecond, completed: item.completed, updatedAt: new Date(item.updatedAtUtc).getTime(), episodeId: item.episodeId,
      };
      series.set(item.seriesId, progress);
    }
    for (const item of pending) {
      const progress = series.get(item.seriesId) ?? {};
      const key = this.epKey(item.episode), cached = local.get(item.seriesId)?.[key];
      if (cached && (cached.updatedAt ?? 0) > (progress[key]?.updatedAt ?? 0)) progress[key] = { ...cached, completed: cached.completed || !!progress[key]?.completed };
      series.set(item.seriesId, progress);
    }
    try {
      // Replace only this profile's cache; never import another device or profile implicitly.
      Object.keys(localStorage).filter(key => key.startsWith(`watched_${session.profileId}_`)).forEach(key => localStorage.removeItem(key));
      for (const [id, progress] of series) this.save(id, progress);
      localStorage.setItem('viewer-linked', 'true');
      if (device && transferred) localStorage.setItem('viewer-device', JSON.stringify({ id: device.id, profileId: session.profileId }));
    } catch { this.syncError.set('El navegador no permite guardar el historial.'); }
    this.revision.update(value => value + 1);
    this.drain();
    if (!this.timer) this.timer = setInterval(() => this.refresh(), 30000);
  }
}
