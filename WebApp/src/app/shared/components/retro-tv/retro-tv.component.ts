import {
  Component, signal, computed, inject, ViewChild, ElementRef,
  AfterViewInit, OnDestroy, NgZone,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import * as signalR from '@microsoft/signalr';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../environments/environment';
import { TvModeService } from '../../../core/services/tv-mode.service';
import { SeriesResponse } from '../../models/serie.model';

interface Channel { id: number; name: string; logoPath?: string; }
interface Episode {
  id: number; title: string; filePath?: string;
  season: number; episodeNumber: number; episodeTypeName: string; seriesId: number;
}
interface Paged<T> { items: T[]; totalCount: number; totalPages: number; page: number; }
type Mode = 'channels' | 'series';
interface ChannelState {
  channelId: number; episodeId: number; episodeTitle: string;
  filePath: string; seriesName: string; seriesLogoPath?: string;
  currentSecond: number; nextEpisodeId: number;
  nextEpisodeTitle: string | null; secondsUntilNext: number;
  isBumper?: boolean; bumperTitle?: string;
}

/**
 * Experiencia pública de TV retro. Reescrita design-first (Tailwind, sin SCSS).
 * Un clic sintoniza: la lista de canales no pide confirmar. El estado en vivo
 * llega por SignalR. En modo TV (10 pies) el layout crece y se controla con
 * botones en pantalla — incluido "Salir del modo TV" (no hay control remoto).
 */
@Component({
  selector: 'app-retro-tv',
  standalone: true,
  imports: [NgClass, FormsModule],
  templateUrl: './retro-tv.component.html',
})
export class RetroTvComponent implements AfterViewInit, OnDestroy {
  @ViewChild('video') videoRef?: ElementRef<HTMLVideoElement>;
  @ViewChild('stage') stageRef?: ElementRef<HTMLDivElement>;

  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);
  readonly tv = inject(TvModeService);

  private readonly apiUrl = environment.apiUrl;
  private hub?: signalR.HubConnection;
  private clockTimer?: ReturnType<typeof setInterval>;

  readonly channels = signal<Channel[]>([]);
  readonly current = signal<Channel | null>(null);
  readonly state = signal<ChannelState | null>(null);
  readonly playing = signal(false);
  readonly muted = signal(false);
  readonly volume = signal(1);
  readonly fullscreen = signal(false);
  readonly panelOpen = signal(true);      // hoja de control en móvil/tablet
  readonly clock = signal(this.formatClock());

  // ── Modo series (reproducción por episodios) ──
  readonly mode = signal<Mode>('channels');
  readonly browserOpen = signal(false);
  readonly seriesQuery = signal('');
  readonly seriesList = signal<SeriesResponse[]>([]);
  readonly seriesLoading = signal(false);
  readonly selectedSeries = signal<SeriesResponse | null>(null);
  readonly episodes = signal<Episode[]>([]);
  readonly selectedSeason = signal<number | null>(null);
  readonly currentEpisode = signal<Episode | null>(null);

  readonly seasons = computed(() =>
    [...new Set(this.episodes()
      .filter(e => e.episodeTypeName?.toLowerCase() === 'regular')
      .map(e => e.season))].sort((a, b) => a - b));

  readonly seasonEpisodes = computed(() =>
    this.episodes()
      .filter(e => e.episodeTypeName?.toLowerCase() === 'regular' && e.season === this.selectedSeason())
      .sort((a, b) => a.episodeNumber - b.episodeNumber));

  /** Hay algo reproduciéndose (canal en vivo o episodio de serie). */
  readonly hasMedia = computed(() => !!this.state() || !!this.currentEpisode());

  /** Número de canal mostrado (CH 03, …). Base 3 como en el diseño. */
  channelNumber = computed(() => {
    const c = this.current();
    if (!c) return null;
    const idx = this.channels().findIndex(ch => ch.id === c.id);
    return idx < 0 ? null : String(idx + 3).padStart(2, '0');
  });

  ngAfterViewInit(): void {
    this.loadChannels();
    this.clockTimer = setInterval(() => this.clock.set(this.formatClock()), 30_000);
    this.zone.runOutsideAngular(() =>
      document.addEventListener('fullscreenchange', this.onFsChange));
  }

  ngOnDestroy(): void {
    this.hub?.stop();
    clearInterval(this.clockTimer);
    document.removeEventListener('fullscreenchange', this.onFsChange);
  }

  // ── Datos ───────────────────────────────────────────────────────────────
  private loadChannels(): void {
    this.http.get<Channel[]>(`${this.apiUrl}/api/v1/public/channels`)
      .subscribe({ next: data => this.channels.set(data) });
  }

  logo(path?: string): string { return path ? `${this.apiUrl}${path}` : ''; }

  /** Un clic sintoniza: carga el estado en vivo del canal y reproduce. */
  tune(channel: Channel): void {
    this.mode.set('channels');
    this.currentEpisode.set(null);
    this.selectedSeries.set(null);
    this.current.set(channel);
    this.hub?.stop();
    this.http.get<ChannelState>(`${this.apiUrl}/api/v1/public/channels/${channel.id}/state`)
      .subscribe({
        next: state => {
          this.state.set(state);
          setTimeout(() => { this.loadVideo(state); this.connectHub(channel.id); }, 0);
        },
      });
    if (window.innerWidth < 1024) this.panelOpen.set(false); // en móvil, ver la tele
  }

  private videoSrc(filePath: string): string {
    return `${this.apiUrl}${filePath.replace('wwwroot', '').replace(/\\/g, '/')}`;
  }

  private loadVideo(state: ChannelState): void {
    const v = this.videoRef?.nativeElement;
    if (!v) return;
    v.src = this.videoSrc(state.filePath);
    v.load();
    v.currentTime = state.currentSecond || 0;
    v.muted = this.muted();
    v.play().then(() => this.playing.set(true)).catch((err: Error) => {
      if (err.name === 'AbortError') return;
      // El autoplay con sonido puede bloquearse: reintenta en mute.
      v.muted = true; this.muted.set(true);
      v.play().then(() => this.playing.set(true)).catch(() => this.playing.set(false));
    });
  }

  private connectHub(channelId: number): void {
    this.hub = new signalR.HubConnectionBuilder()
      .withUrl(`${this.apiUrl}/hubs/channel`)
      .withAutomaticReconnect()
      .build();
    this.hub.on('ChannelState', (state: ChannelState) => {
      const prev = this.state();
      this.state.set(state);
      const v = this.videoRef?.nativeElement;
      if (!v) return;
      if (prev?.episodeId !== state.episodeId) this.loadVideo(state);
      else if (v.duration && Math.abs(v.currentTime - state.currentSecond) > 20)
        v.currentTime = state.currentSecond;
    });
    this.hub.start().then(() => this.hub!.invoke('JoinChannel', channelId)).catch(() => {});
  }

  // ── Controles de reproducción ───────────────────────────────────────────
  togglePlay(): void {
    const v = this.videoRef?.nativeElement;
    if (!v) return;
    if (v.paused) { v.play(); this.playing.set(true); }
    else { v.pause(); this.playing.set(false); }
  }

  toggleMute(): void {
    const v = this.videoRef?.nativeElement;
    if (!v) return;
    v.muted = !v.muted; this.muted.set(v.muted);
  }

  changeVolume(delta: number): void {
    const v = this.videoRef?.nativeElement;
    if (!v) return;
    v.volume = Math.min(1, Math.max(0, v.volume + delta));
    v.muted = v.volume === 0;
    this.volume.set(v.volume); this.muted.set(v.muted);
  }

  toggleFullscreen(): void {
    const el = this.stageRef?.nativeElement;
    if (!el) return;
    if (!document.fullscreenElement) el.requestFullscreen?.();
    else document.exitFullscreen?.();
  }

  private onFsChange = (): void =>
    this.zone.run(() => this.fullscreen.set(!!document.fullscreenElement));

  // ── Modo TV (10 pies) ───────────────────────────────────────────────────
  enterTvMode(): void { this.tv.setEnabled(true); this.panelOpen.set(true); this.retune(); }
  exitTvMode(): void { this.tv.setEnabled(false); this.retune(); }

  /** El layout cambia entre modos, así que recargamos el video en el nuevo DOM. */
  private retune(): void {
    if (this.mode() === 'series') { const ep = this.currentEpisode(); if (ep) setTimeout(() => this.playEpisode(ep), 0); }
    else { const c = this.current(); if (c) setTimeout(() => this.tune(c), 0); }
  }

  // ── Series ────────────────────────────────────────────────────────────────
  openBrowser(): void { this.browserOpen.set(true); if (!this.seriesList().length) this.searchSeries(); }
  closeBrowser(): void { this.browserOpen.set(false); }

  onSeriesQuery(value: string): void { this.seriesQuery.set(value); this.searchSeries(); }

  searchSeries(): void {
    this.seriesLoading.set(true);
    const params: Record<string, string | number> = { pageSize: 24 };
    if (this.seriesQuery()) params['name'] = this.seriesQuery();
    this.http.get<Paged<SeriesResponse>>(`${this.apiUrl}/api/v1/public/series`, { params }).subscribe({
      next: r => { this.seriesList.set(r.items); this.seriesLoading.set(false); },
      error: () => this.seriesLoading.set(false),
    });
  }

  enterSeries(serie: SeriesResponse): void {
    this.hub?.stop();
    this.current.set(null);
    this.state.set(null);
    this.browserOpen.set(false);
    this.selectedSeries.set(serie);
    this.mode.set('series');
    this.http.get<Episode[]>(`${this.apiUrl}/api/v1/public/series/${serie.id}/episodes`).subscribe({
      next: eps => {
        this.episodes.set(eps);
        this.selectedSeason.set(this.seasons()[0] ?? null);
        const first = this.seasonEpisodes()[0] ?? eps.find(e => e.filePath);
        if (first) this.playEpisode(first);
      },
    });
  }

  selectSeason(season: number): void { this.selectedSeason.set(season); }

  playEpisode(ep: Episode): void {
    if (!ep.filePath) return;
    this.currentEpisode.set(ep);
    setTimeout(() => {
      const v = this.videoRef?.nativeElement;
      if (!v) return;
      v.src = this.videoSrc(ep.filePath!);
      v.load();
      v.muted = this.muted();
      v.play().then(() => this.playing.set(true)).catch((err: Error) => {
        if (err.name === 'AbortError') return;
        v.muted = true; this.muted.set(true);
        v.play().then(() => this.playing.set(true)).catch(() => this.playing.set(false));
      });
      if (window.innerWidth < 1024) this.panelOpen.set(false);
    }, 0);
  }

  backToChannels(): void {
    this.mode.set('channels');
    this.selectedSeries.set(null);
    this.episodes.set([]);
    this.currentEpisode.set(null);
    const v = this.videoRef?.nativeElement;
    if (v) { v.pause(); v.removeAttribute('src'); v.load(); }
    this.playing.set(false);
  }

  // ── Navegación de accesos ("IR A") ──────────────────────────────────────
  goToLogin(): void { this.router.navigate(['dashboard/login']); }
  togglePanel(): void { this.panelOpen.update(v => !v); }

  private formatClock(): string {
    return new Intl.DateTimeFormat('es-GT', { hour: '2-digit', minute: '2-digit', hour12: false })
      .format(new Date());
  }
}
