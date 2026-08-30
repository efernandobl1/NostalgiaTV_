import {
  Component, signal, computed, inject, ViewChild, ElementRef,
  AfterViewInit, OnDestroy, NgZone, HostListener,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import * as signalR from '@microsoft/signalr';
import { environment } from '../../../../environments/environment';
import { TvModeService } from '../../../core/services/tv-mode.service';
import { TvSettingsService } from '../../../core/services/tv-settings.service';
import { WatchedService } from '../../../core/services/watched.service';
import { SeriesResponse } from '../../models/serie.model';

interface Channel { id: number; name: string; logoPath?: string; }
interface ChannelState {
  channelId: number; episodeId: number; episodeTitle: string;
  filePath: string; seriesName: string; seriesLogoPath?: string;
  currentSecond: number; nextEpisodeId: number;
  nextEpisodeTitle: string | null; secondsUntilNext: number;
  isBumper?: boolean; bumperTitle?: string;
}
interface Episode {
  id: number; title: string; filePath?: string;
  season: number; episodeNumber: number; episodeTypeName: string; seriesId: number;
}
interface Paged<T> { items: T[]; totalCount: number; totalPages: number; page: number; }
type Mode = 'channels' | 'series';

const slug = (s: string): string => s.toLowerCase().replace(/\s+/g, '');

/**
 * Experiencia pública de TV retro (Tailwind, sin SCSS de componente).
 * Un solo <video> persistente: al pasar a cine/fullscreen sólo cambia de
 * posición (tubo ↔ full-bleed), nunca se recrea, así no recarga. Deep-links
 * ?channel= y ?series= para compartir. Vistos/resume + filtros CRT en localStorage.
 */
@Component({
  selector: 'app-retro-tv',
  standalone: true,
  imports: [NgClass, FormsModule],
  templateUrl: './retro-tv.component.html',
})
export class RetroTvComponent implements AfterViewInit, OnDestroy {
  @ViewChild('video') videoRef?: ElementRef<HTMLVideoElement>;
  @ViewChild('fsRoot') fsRootRef?: ElementRef<HTMLDivElement>;

  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly zone = inject(NgZone);
  readonly tv = inject(TvModeService);
  private readonly tvSettings = inject(TvSettingsService);
  private readonly watched = inject(WatchedService);

  private readonly apiUrl = environment.apiUrl;
  private hub?: signalR.HubConnection;
  private clockTimer?: ReturnType<typeof setInterval>;
  private progressTimer?: ReturnType<typeof setInterval>;
  private overlayTimer?: ReturnType<typeof setTimeout>;
  private endedHandler?: () => void;

  readonly channels = signal<Channel[]>([]);
  readonly current = signal<Channel | null>(null);
  readonly state = signal<ChannelState | null>(null);
  readonly playing = signal(false);
  readonly muted = signal(false);
  readonly volume = signal(1);
  readonly fullscreen = signal(false);
  readonly panelOpen = signal(true);
  readonly clock = signal(this.formatClock());
  readonly showOverlay = signal(true);
  readonly showFilters = signal(false);
  readonly showEpisodes = signal(false);   // lista de episodios en cine

  /** Modo cine (video full-bleed + overlay): modo TV o pantalla completa. */
  readonly cinema = computed(() => this.tv.enabled() || this.fullscreen());

  readonly settings = this.tvSettings.settings;
  readonly activeFilters = computed(() =>
    this.fullscreen() ? this.settings().filtersFullscreen : this.settings().filters);
  readonly scanlineOpacity = computed(() =>
    this.settings().alwaysShowFilters ? this.activeFilters().scanlineIntensity / 100 : 0);

  // ── Modo series ──
  readonly mode = signal<Mode>('channels');
  readonly browserOpen = signal(false);
  readonly seriesQuery = signal('');
  readonly seriesList = signal<SeriesResponse[]>([]);
  readonly seriesLoading = signal(false);
  readonly selectedSeries = signal<SeriesResponse | null>(null);
  readonly episodes = signal<Episode[]>([]);
  readonly selectedSeason = signal<number | null>(null);
  readonly currentEpisode = signal<Episode | null>(null);
  readonly watchedMap = signal<Record<number, boolean>>({});

  readonly seasons = computed(() =>
    [...new Set(this.episodes()
      .filter(e => e.episodeTypeName?.toLowerCase() === 'regular')
      .map(e => e.season))].sort((a, b) => a - b));

  readonly seasonEpisodes = computed(() =>
    this.episodes()
      .filter(e => e.episodeTypeName?.toLowerCase() === 'regular' && e.season === this.selectedSeason())
      .sort((a, b) => a.episodeNumber - b.episodeNumber));

  readonly hasMedia = computed(() => !!this.state() || !!this.currentEpisode());

  readonly channelNumber = computed(() => {
    const c = this.current();
    if (!c) return null;
    const idx = this.channels().findIndex(ch => ch.id === c.id);
    return idx < 0 ? null : String(idx + 3).padStart(2, '0');
  });

  readonly focusedIndex = signal(0);

  // Actividad del puntero fuera de la zona de Angular (no dispara CD por píxel).
  private readonly activity = (): void => {
    if (!this.cinema()) return;
    if (!this.showOverlay()) this.zone.run(() => this.showOverlay.set(true));
    this.scheduleHide();
  };

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    if (!this.cinema()) return;
    this.pokeOverlay();
    if (this.browserOpen() || this.showFilters() || this.showEpisodes()) return;
    switch (e.key) {
      case 'ArrowRight': e.preventDefault(); this.moveFocus(1); break;
      case 'ArrowLeft':  e.preventDefault(); this.moveFocus(-1); break;
      case 'Enter': e.preventDefault(); this.tuneFocused(); break;
      case 'ArrowUp': e.preventDefault(); this.mode() === 'series' ? this.toggleEpisodes() : this.openBrowser(); break;
      case 'ArrowDown': e.preventDefault(); this.toggleFilters(); break;
      case 'Escape': case 'Backspace': e.preventDefault(); this.showOverlay.set(false); break;
    }
  }

  private moveFocus(delta: number): void {
    const n = this.channels().length;
    if (!n) return;
    this.focusedIndex.set((this.focusedIndex() + delta + n) % n);
  }
  private tuneFocused(): void {
    const ch = this.channels()[this.focusedIndex()];
    if (ch) this.tune(ch);
  }

  private pokeOverlay(): void { this.showOverlay.set(true); this.scheduleHide(); }
  private scheduleHide(): void {
    clearTimeout(this.overlayTimer);
    this.overlayTimer = setTimeout(() => this.zone.run(() => this.showOverlay.set(false)), 4000);
  }

  ngAfterViewInit(): void {
    this.loadChannels();
    this.clockTimer = setInterval(() => this.clock.set(this.formatClock()), 30_000);
    this.zone.runOutsideAngular(() => {
      document.addEventListener('fullscreenchange', this.onFsChange);
      document.addEventListener('mousemove', this.activity, { passive: true });
      document.addEventListener('click', this.activity);
      document.addEventListener('touchstart', this.activity, { passive: true });
    });
    if (this.cinema()) this.pokeOverlay();
  }

  ngOnDestroy(): void {
    this.hub?.stop();
    clearInterval(this.clockTimer);
    clearInterval(this.progressTimer);
    clearTimeout(this.overlayTimer);
    document.removeEventListener('fullscreenchange', this.onFsChange);
    document.removeEventListener('mousemove', this.activity);
    document.removeEventListener('click', this.activity);
    document.removeEventListener('touchstart', this.activity);
  }

  // ── Datos ───────────────────────────────────────────────────────────────
  private loadChannels(): void {
    this.http.get<Channel[]>(`${this.apiUrl}/api/v1/public/channels`)
      .subscribe({ next: data => { this.channels.set(data); this.applyDeepLink(); } });
  }

  /** Deep-link inicial: ?channel=<slug> o ?series=<slug>. */
  private applyDeepLink(): void {
    const qp = this.route.snapshot.queryParamMap;
    const chParam = qp.get('channel');
    const seParam = qp.get('series');
    if (chParam) {
      const ch = this.channels().find(c => slug(c.name) === slug(chParam));
      if (ch) { this.tune(ch); return; }
    }
    if (seParam) {
      this.http.get<Paged<SeriesResponse>>(`${this.apiUrl}/api/v1/public/series`, {
        params: { name: seParam.replace(/-/g, ' '), pageSize: 5 },
      }).subscribe({
        next: r => {
          const s = r.items.find(x => slug(x.name) === slug(seParam)) ?? r.items[0];
          if (s) this.enterSeries(s);
        },
      });
    }
  }

  private setUrl(params: { channel?: string | null; series?: string | null }): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: params, queryParamsHandling: 'merge', replaceUrl: true });
  }

  logo(path?: string): string { return path ? `${this.apiUrl}${path}` : ''; }

  tune(channel: Channel): void {
    this.stopProgress();
    this.mode.set('channels');
    this.currentEpisode.set(null);
    this.selectedSeries.set(null);
    this.current.set(channel);
    this.focusedIndex.set(Math.max(0, this.channels().findIndex(c => c.id === channel.id)));
    this.hub?.stop();
    this.setUrl({ channel: slug(channel.name), series: null });
    this.http.get<ChannelState>(`${this.apiUrl}/api/v1/public/channels/${channel.id}/state`)
      .subscribe({
        next: state => {
          this.state.set(state);
          setTimeout(() => { this.loadVideo(state); this.connectHub(channel.id); }, 0);
        },
      });
    if (window.innerWidth < 1024) this.panelOpen.set(false);
  }

  private videoSrc(filePath: string): string {
    return `${this.apiUrl}${filePath.replace('wwwroot', '').replace(/\\/g, '/')}`;
  }

  private playVideo(src: string, startAt: number): void {
    const v = this.videoRef?.nativeElement;
    if (!v) return;
    v.src = src;
    v.load();
    v.currentTime = startAt || 0;
    v.muted = this.muted();
    v.play().then(() => this.playing.set(true)).catch((err: Error) => {
      if (err.name === 'AbortError') return;
      v.muted = true; this.muted.set(true);
      v.play().then(() => this.playing.set(true)).catch(() => this.playing.set(false));
    });
  }

  private loadVideo(state: ChannelState): void {
    this.playVideo(this.videoSrc(state.filePath), state.currentSecond);
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
  onVideoClick(): void { if (this.mode() === 'series') this.togglePlay(); }

  seekRelative(seconds: number): void {
    const v = this.videoRef?.nativeElement;
    if (!v || !v.duration) return;
    v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + seconds));
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

  setVolume(value: number): void {
    const v = this.videoRef?.nativeElement;
    if (!v) return;
    v.volume = value; v.muted = value === 0;
    this.volume.set(value); this.muted.set(value === 0);
  }

  toggleFullscreen(): void {
    const el = this.fsRootRef?.nativeElement;
    if (!el) return;
    if (!document.fullscreenElement) el.requestFullscreen?.();
    else document.exitFullscreen?.();
  }
  /** El video es persistente, así que fullscreen NO recarga: sólo cambia el layout. */
  goFullscreenCinema(): void { this.toggleFullscreen(); }

  private onFsChange = (): void => this.zone.run(() => this.fullscreen.set(!!document.fullscreenElement));

  // ── Filtros CRT ─────────────────────────────────────────────────────────
  toggleFilters(): void { this.showFilters.update(v => !v); }
  toggleCrt(): void { this.tvSettings.update({ alwaysShowFilters: !this.settings().alwaysShowFilters }); }
  setFilter(key: 'scanlineIntensity' | 'scanlineDensity' | 'crtCurvature' | 'vignette' | 'scanlineAnimation', value: number | boolean): void {
    this.tvSettings.updateFilter({ [key]: value } as any, this.fullscreen());
  }

  // ── Modo TV / cine ──────────────────────────────────────────────────────
  enterTvMode(): void { this.tv.setEnabled(true); this.pokeOverlay(); }
  exitTvMode(): void { this.tv.setEnabled(false); }

  // ── Series ──────────────────────────────────────────────────────────────
  openBrowser(): void { this.browserOpen.set(true); if (!this.seriesList().length) this.searchSeries(); }
  closeBrowser(): void { this.browserOpen.set(false); }
  toggleEpisodes(): void { this.showEpisodes.update(v => !v); }
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
    this.stopProgress();
    this.hub?.stop();
    this.current.set(null);
    this.state.set(null);
    this.browserOpen.set(false);
    this.selectedSeries.set(serie);
    this.mode.set('series');
    this.setUrl({ series: slug(serie.name), channel: null });
    this.http.get<Episode[]>(`${this.apiUrl}/api/v1/public/series/${serie.id}/episodes`).subscribe({
      next: eps => {
        this.episodes.set(eps);
        const progress = this.watched.getProgress(serie.id);
        const map: Record<number, boolean> = {};
        eps.forEach(e => (map[e.id] = progress[e.id]?.completed ?? false));
        this.watchedMap.set(map);

        const inProgress = eps.find(e => progress[e.id] && !progress[e.id].completed && progress[e.id].currentSecond > 0);
        const target = inProgress ?? (this.watched.getNextUnwatched(serie.id, eps) as Episode | null);
        if (target?.episodeTypeName?.toLowerCase() === 'regular') this.selectedSeason.set(target.season);
        else this.selectedSeason.set(this.seasons()[0] ?? null);
        const toPlay = target?.filePath ? target : this.seasonEpisodes()[0] ?? eps.find(e => e.filePath);
        if (toPlay) this.playEpisode(toPlay as Episode);
      },
    });
  }

  selectSeason(season: number): void { this.selectedSeason.set(season); }

  playEpisode(ep: Episode): void {
    if (!ep.filePath) return;
    this.stopProgress();
    this.showEpisodes.set(false);
    this.currentEpisode.set(ep);
    if (ep.episodeTypeName?.toLowerCase() === 'regular' && ep.season !== this.selectedSeason())
      this.selectedSeason.set(ep.season);
    setTimeout(() => {
      const seriesId = this.selectedSeries()?.id;
      const resumeAt = seriesId ? this.watched.getLastProgress(seriesId, ep.id) : 0;
      this.playVideo(this.videoSrc(ep.filePath!), resumeAt);
      this.startProgress(ep);
      if (window.innerWidth < 1024) this.panelOpen.set(false);
    }, 0);
  }

  private startProgress(ep: Episode): void {
    const seriesId = this.selectedSeries()?.id;
    if (!seriesId) return;
    const v = this.videoRef?.nativeElement;
    let done = false;
    this.endedHandler = () => {
      if (done) return; done = true;
      this.zone.run(() => this.settings().randomPlayback ? this.playRandom() : this.playNext(ep));
    };
    v?.addEventListener('ended', this.endedHandler, { once: true });

    let marked = false;
    this.zone.runOutsideAngular(() => {
      this.progressTimer = setInterval(() => {
        const vid = this.videoRef?.nativeElement;
        if (!vid || !vid.duration) return;
        const pct = vid.currentTime / vid.duration;
        this.watched.markProgress(seriesId, ep.id, vid.currentTime, pct >= 0.95);
        if (pct >= 0.95 && !marked) {
          marked = true;
          this.zone.run(() => this.watchedMap.update(m => ({ ...m, [ep.id]: true })));
        }
      }, 5000);
    });
  }

  private stopProgress(): void {
    clearInterval(this.progressTimer);
    const v = this.videoRef?.nativeElement;
    if (v && this.endedHandler) v.removeEventListener('ended', this.endedHandler);
    this.endedHandler = undefined;
  }

  private playNext(current: Episode): void {
    const list = this.seasonEpisodes();
    const next = list[list.findIndex(e => e.id === current.id) + 1];
    if (next) this.playEpisode(next);
  }

  playNextEpisode(): void { const ep = this.currentEpisode(); if (ep) this.playNext(ep); }
  playPrevEpisode(): void {
    const ep = this.currentEpisode();
    if (!ep) return;
    const list = this.seasonEpisodes();
    const prev = list[list.findIndex(e => e.id === ep.id) - 1];
    if (prev) this.playEpisode(prev);
  }

  playRandom(): void {
    const all = this.episodes().filter(e => !!e.filePath);
    const unseen = all.filter(e => !this.watchedMap()[e.id]);
    const pool = unseen.length ? unseen : all;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (pick) this.playEpisode(pick);
  }

  backToChannels(): void {
    this.stopProgress();
    this.mode.set('channels');
    this.selectedSeries.set(null);
    this.episodes.set([]);
    this.currentEpisode.set(null);
    this.setUrl({ series: null, channel: null });
    const v = this.videoRef?.nativeElement;
    if (v) { v.pause(); v.removeAttribute('src'); v.load(); }
    this.playing.set(false);
  }

  // ── Navegación ──────────────────────────────────────────────────────────
  goToLogin(): void { this.router.navigate(['dashboard/login']); }
  togglePanel(): void { this.panelOpen.update(v => !v); }

  private formatClock(): string {
    return new Intl.DateTimeFormat('es-GT', { hour: '2-digit', minute: '2-digit', hour12: false })
      .format(new Date());
  }
}
