import {
  Component, signal, computed, inject, ViewChild, ElementRef,
  AfterViewInit, OnDestroy, NgZone, HostListener,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import * as signalR from '@microsoft/signalr';
import { environment } from '../../../../environments/environment';
import { TvModeService } from '../../../core/services/tv-mode.service';
import { TvSettingsService } from '../../../core/services/tv-settings.service';
import { WatchedService } from '../../../core/services/watched.service';
import { ControlBindingsService, TvAction, TV_ACTIONS } from '../../../core/services/control-bindings.service';
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
interface GuideEntry {
  episodeTitle?: string; seriesName?: string; seriesLogoPath?: string;
  startTime: string; endTime: string; season?: number; episodeNumber?: number;
  isBumper?: boolean; bumperTitle?: string;
}
interface GuideRow { channel: Channel; entries: GuideEntry[]; }
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
  readonly controls = inject(ControlBindingsService);
  readonly tvActions = TV_ACTIONS;

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
  readonly showGuide = signal(false);      // guía de programación
  readonly showControls = signal(false);   // remapeo de teclas
  readonly guideRows = signal<GuideRow[]>([]);
  readonly guideLoading = signal(false);
  readonly guideDay = signal<0 | 1>(0);    // 0 = hoy, 1 = mañana
  readonly capturingAction = signal<TvAction | null>(null);

  // Barra de progreso del reproductor (series).
  readonly videoTime = signal(0);
  readonly videoDuration = signal(0);
  readonly progressPct = computed(() => {
    const d = this.videoDuration();
    return d > 0 ? Math.min(100, (this.videoTime() / d) * 100) : 0;
  });

  /** Franjas de 30 min del día seleccionado (para la grilla de la guía). */
  readonly guideSlots = computed<number[]>(() => {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    base.setDate(base.getDate() + this.guideDay());
    const start = base.getTime();
    return Array.from({ length: 48 }, (_, i) => start + i * 30 * 60_000);
  });

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
  readonly catalogTab = signal<'todas' | 'continuar'>('todas');
  readonly catalogCategories = signal<{ id: number; name: string }[]>([]);
  readonly selectedCategory = signal<number | null>(null);
  readonly selectedChannel = signal<number | null>(null);
  readonly seriesPage = signal(1);
  readonly seriesTotalPages = signal(1);
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

  // ── Detalle de serie (pantalla TV) ────────────────────────────────────────
  readonly showSpecials = signal(false);
  readonly hasSpecials = computed(() =>
    this.episodes().some(e => e.episodeTypeName && e.episodeTypeName.toLowerCase() !== 'regular'));
  readonly specialEpisodes = computed(() =>
    this.episodes().filter(e => e.episodeTypeName && e.episodeTypeName.toLowerCase() !== 'regular'));
  readonly displayedEpisodes = computed(() =>
    this.showSpecials() ? this.specialEpisodes() : this.seasonEpisodes());
  readonly regularCount = computed(() =>
    this.episodes().filter(e => e.episodeTypeName?.toLowerCase() === 'regular').length);
  readonly serieYears = computed(() => {
    const s = this.selectedSeries();
    if (!s) return '';
    const y = (d?: string) => (d ? new Date(d).getFullYear() : null);
    const a = y(s.startDate), b = y(s.endDate);
    return a && b && b !== a ? `${a} – ${b}` : (a ? `${a}` : '');
  });
  readonly resumeTag = computed(() => {
    const ep = this.currentEpisode();
    return ep && ep.episodeTypeName?.toLowerCase() === 'regular' ? `T${ep.season}E${ep.episodeNumber}` : '';
  });

  readonly hasMedia = computed(() => !!this.state() || !!this.currentEpisode());

  readonly channelNumber = computed(() => {
    const c = this.current();
    if (!c) return null;
    const idx = this.channels().findIndex(ch => ch.id === c.id);
    return idx < 0 ? null : String(idx + 3).padStart(2, '0');
  });

  readonly focusedIndex = signal(0);

  /** Logo/nombre de lo que se está viendo, para el overlay (canal o serie). */
  readonly overlayLogo = computed(() =>
    this.mode() === 'series'
      ? this.selectedSeries()?.logoPath ?? ''
      : this.current()?.logoPath ?? this.state()?.seriesLogoPath ?? '');
  readonly overlayName = computed(() =>
    this.mode() === 'series' ? this.selectedSeries()?.name ?? '' : this.current()?.name ?? '');

  // Actividad del puntero fuera de la zona de Angular (no dispara CD por píxel).
  private readonly activity = (): void => {
    if (!this.cinema()) return;
    if (!this.showOverlay()) this.zone.run(() => this.showOverlay.set(true));
    this.scheduleHide();
  };

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    // Captura de tecla al remapear: cualquier tecla queda asignada a la acción.
    if (this.capturingAction()) {
      e.preventDefault(); e.stopPropagation();
      const action = this.capturingAction()!;
      if (e.key !== 'Escape') this.controls.set(action, e.key);
      this.capturingAction.set(null);
      return;
    }
    if (!this.cinema()) return;
    this.pokeOverlay();
    const anyOverlay = this.browserOpen() || this.showFilters() || this.showEpisodes() ||
        this.showGuide() || this.showControls();
    if (anyOverlay) {
      if (e.key === 'Escape' || e.key === 'Backspace') {
        e.preventDefault();
        this.browserOpen.set(false); this.showFilters.set(false); this.showEpisodes.set(false);
        this.showGuide.set(false); this.showControls.set(false);
      }
      return;
    }

    const action = this.controls.actionFor(e.key) ?? (e.key === 'Backspace' ? 'hide' : undefined);
    if (!action) return;
    e.preventDefault();
    switch (action) {
      case 'channelNext': this.moveFocus(1); break;
      case 'channelPrev': this.moveFocus(-1); break;
      case 'ok': this.tuneFocused(); break;
      case 'guide': this.mode() === 'series' ? this.toggleEpisodes() : this.openGuide(); break;
      case 'image': this.toggleFilters(); break;
      case 'hide': this.showOverlay.set(false); break;
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
      const v = this.videoRef?.nativeElement;
      if (v) {
        const dur = () => this.zone.run(() => this.videoDuration.set(isFinite(v.duration) ? v.duration : 0));
        v.addEventListener('timeupdate', () => this.zone.run(() => this.videoTime.set(v.currentTime)));
        v.addEventListener('loadedmetadata', dur);
        v.addEventListener('durationchange', dur);
      }
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

  // ── Guía de programación ─────────────────────────────────────────────────
  openGuide(): void {
    if (this.mode() === 'series') return;   // series no tiene programación
    this.guideDay.set(0);
    this.showGuide.set(true);
    const chs = this.channels();
    if (!chs.length) return;
    this.guideLoading.set(true);
    forkJoin(chs.map(ch =>
      this.http.get<GuideEntry[]>(`${this.apiUrl}/api/v1/public/channels/${ch.id}/schedule`).pipe(
        map(entries => ({ channel: ch, entries: entries ?? [] }) as GuideRow),
        catchError(() => of({ channel: ch, entries: [] } as GuideRow)),
      ),
    )).subscribe({
      next: rows => {
        this.guideRows.set(rows);
        this.guideLoading.set(false);
        // Centrar cada fila en el programa "AHORA".
        setTimeout(() => document.querySelectorAll('[data-guide-now]')
          .forEach(el => el.scrollIntoView({ inline: 'center', block: 'nearest' })), 50);
      },
      error: () => this.guideLoading.set(false),
    });
  }
  closeGuide(): void { this.showGuide.set(false); }
  tuneFromGuide(ch: Channel): void { this.showGuide.set(false); this.tune(ch); }

  guideIsNow(e: GuideEntry): boolean {
    const now = Date.now();
    return new Date(e.startTime).getTime() <= now && now < new Date(e.endTime).getTime();
  }
  guideIsPast(e: GuideEntry): boolean { return new Date(e.endTime).getTime() < Date.now(); }
  guideTime(e: GuideEntry): string {
    return new Intl.DateTimeFormat('es-GT', { hour: '2-digit', minute: '2-digit', hour12: false })
      .format(new Date(e.startTime));
  }
  guideTitle(e: GuideEntry): string {
    if (e.isBumper) return e.bumperTitle || 'Bumper';
    return e.seriesName || e.episodeTitle || 'Programa';
  }
  /** Etiqueta "TxEy" del programa (para el subtítulo "Ahora"). */
  guideEpTag(e: GuideEntry): string {
    if (e.isBumper || !e.season || !e.episodeNumber) return '';
    return `T${e.season}E${e.episodeNumber}`;
  }

  // ── Grilla de la guía (columnas de 30 min) ────────────────────────────────
  slotLabel(ms: number): string {
    return new Intl.DateTimeFormat('es-GT', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(ms));
  }
  entryAt(entries: GuideEntry[], slotMs: number): GuideEntry | undefined {
    return entries.find(e => new Date(e.startTime).getTime() <= slotMs && slotMs < new Date(e.endTime).getTime());
  }
  slotIsNow(slotMs: number): boolean {
    if (this.guideDay() !== 0) return false;
    const now = Date.now();
    return slotMs <= now && now < slotMs + 30 * 60_000;
  }
  setGuideDay(day: 0 | 1): void {
    this.guideDay.set(day);
    setTimeout(() => document.querySelector('[data-guide-now]')?.scrollIntoView({ inline: 'center', block: 'nearest' }), 30);
  }

  // ── Barra de progreso ─────────────────────────────────────────────────────
  fmtTime(sec: number): string {
    if (!isFinite(sec) || sec < 0) sec = 0;
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
    const mm = String(m).padStart(2, '0'), ss = String(s).padStart(2, '0');
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  }
  seekBar(e: MouseEvent): void {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const v = this.videoRef?.nativeElement;
    if (!v || !v.duration) return;
    v.currentTime = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * v.duration;
  }

  // ── Remapeo de teclas (tipo emulador) ────────────────────────────────────
  openControls(): void { this.showControls.set(true); }
  closeControls(): void { this.showControls.set(false); this.capturingAction.set(null); }
  startCapture(action: TvAction): void { this.capturingAction.set(action); }
  resetControls(): void { this.controls.reset(); this.capturingAction.set(null); }

  // ── Series ──────────────────────────────────────────────────────────────
  openBrowser(): void {
    this.browserOpen.set(true);
    if (!this.seriesList().length) this.searchSeries();
    if (!this.catalogCategories().length) {
      this.http.get<{ id: number; name: string }[]>(`${this.apiUrl}/api/v1/public/categories`)
        .subscribe({ next: c => this.catalogCategories.set(c ?? []), error: () => {} });
    }
  }
  closeBrowser(): void { this.browserOpen.set(false); }
  toggleEpisodes(): void { this.showEpisodes.update(v => !v); }
  onSeriesQuery(value: string): void { this.seriesQuery.set(value); this.seriesPage.set(1); this.searchSeries(); }

  searchSeries(): void {
    this.seriesLoading.set(true);
    const params: Record<string, string | number> = { pageSize: 18, page: this.seriesPage() };
    if (this.seriesQuery()) params['name'] = this.seriesQuery();
    if (this.selectedCategory() != null) params['categoryId'] = this.selectedCategory()!;
    if (this.selectedChannel() != null) params['channelId'] = this.selectedChannel()!;
    this.http.get<Paged<SeriesResponse>>(`${this.apiUrl}/api/v1/public/series`, { params }).subscribe({
      next: r => {
        this.seriesList.set(r.items);
        this.seriesTotalPages.set(r.totalPages || 1);
        this.seriesLoading.set(false);
      },
      error: () => this.seriesLoading.set(false),
    });
  }
  goCatalogPage(delta: number): void {
    const next = this.seriesPage() + delta;
    if (next < 1 || next > this.seriesTotalPages()) return;
    this.seriesPage.set(next);
    this.searchSeries();
  }
  setCatalogTab(tab: 'todas' | 'continuar'): void { this.catalogTab.set(tab); }
  setCategory(id: number | null): void {
    this.selectedCategory.set(id);
    this.catalogTab.set('todas');
    this.seriesPage.set(1);
    this.searchSeries();
  }
  setChannelFilter(id: number | null): void {
    this.selectedChannel.set(id);
    this.seriesPage.set(1);
    this.searchSeries();
  }

  /** Series (de la página actual) con progreso sin terminar. */
  hasResume(seriesId: number): boolean {
    return Object.values(this.watched.getProgress(seriesId))
      .some(x => x.currentSecond > 0 && !x.completed);
  }
  readonly catalogSeries = computed(() =>
    this.catalogTab() === 'continuar' ? this.seriesList().filter(s => this.hasResume(s.id)) : this.seriesList());

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

        const target = this.watched.getResume(serie.id, eps);
        if (target?.episodeTypeName?.toLowerCase() === 'regular') this.selectedSeason.set(target.season);
        else this.selectedSeason.set(this.seasons()[0] ?? null);
        const toPlay = target?.filePath ? target : this.seasonEpisodes()[0] ?? eps.find(e => e.filePath);
        if (toPlay) this.playEpisode(toPlay as Episode);
        // En modo TV/cine, al entrar mostramos la pantalla de detalle de la serie.
        if (this.cinema()) this.showEpisodes.set(true);
      },
    });
  }

  selectSeason(season: number): void { this.showSpecials.set(false); this.selectedSeason.set(season); }
  selectSpecials(): void { this.showSpecials.set(true); }

  /** "Continuar": reproduce el episodio de resume (o el siguiente sin ver). */
  continueSeries(): void {
    const ep = this.currentEpisode() ?? (this.watched.getNextUnwatched(
      this.selectedSeries()?.id ?? 0, this.episodes()) as Episode | null);
    if (ep?.filePath) this.playEpisode(ep);
  }

  /** "Reiniciar vistos": borra el progreso guardado de la serie. */
  resetWatched(): void {
    const id = this.selectedSeries()?.id;
    if (!id) return;
    this.watched.resetSeries(id);
    this.watchedMap.set({});
  }

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
