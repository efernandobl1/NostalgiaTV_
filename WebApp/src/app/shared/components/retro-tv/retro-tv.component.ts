import {
  Component,
  signal,
  computed,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  inject,
  effect,
  NgZone,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { environment } from '../../../../environments/environment';
import * as signalR from '@microsoft/signalr';
import { TvSettingsService } from '../../../core/services/tv-settings.service';
import { WatchedService } from '../../../core/services/watched.service';
import { SeriesResponse } from '../../models/serie.model';
import { ScheduleEntry } from '../../models/channel-era.model';
import { RetroTvControlsComponent } from "./retro-tv-controls/retro-tv-controls.component";
import { RetroTvFiltersPanelComponent } from "./retro-tv-filters-panel/retro-tv-filters-panel.component";
import { RetroTvRemoteChannelsComponent } from "./retro-tv-remote-channels/retro-tv-remote-channels.component";
import { RetroTvRemoteSeriesComponent } from "./retro-tv-remote-series/retro-tv-remote-series.component";
import { RetroTvDialogsComponent } from "./retro-tv-dialogs/retro-tv-dialogs.component";

interface Channel { id: number; name: string; logoPath?: string; }
interface ChannelEra { id: number; name: string; description?: string; seriesIds: number[]; }
interface ChannelState {
  channelId: number; episodeId: number; episodeTitle: string;
  filePath: string; seriesName: string; seriesLogoPath?: string;
  currentSecond: number; nextEpisodeId: number;
  nextEpisodeTitle: string | null; secondsUntilNext: number;
  isBumper?: boolean; bumperTitle?: string;
}
interface EpisodeType { id: number; name: string; }
interface EpisodeResponse {
  id: number; title: string; filePath?: string;
  season: number; episodeNumber: number;
  episodeTypeId: number; episodeTypeName: string; seriesId: number;
}
interface PagedResult<T> {
  items: T[]; totalCount: number; page: number; pageSize: number; totalPages: number;
}

type AppMode = 'channels' | 'series';

@Component({
  selector: 'app-retro-tv',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    RetroTvControlsComponent,
    RetroTvFiltersPanelComponent,
    RetroTvRemoteChannelsComponent,
    RetroTvRemoteSeriesComponent,
    RetroTvDialogsComponent
],
  templateUrl: './retro-tv.component.html',
  styleUrl: './retro-tv.component.scss',
})
export class RetroTvComponent implements AfterViewInit, OnDestroy {
  @ViewChild('tvContainer') tvContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('screenOverlay') screenOverlay!: ElementRef<HTMLDivElement>;
  @ViewChild('videoPlayer') videoPlayer!: ElementRef<HTMLVideoElement>;
  @ViewChild('videoFilters') videoFilters!: ElementRef<HTMLDivElement>;

  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  private tvSettings = inject(TvSettingsService);
  private watchedService = inject(WatchedService);
  private ngZone = inject(NgZone);

  apiUrl = environment.apiUrl;

  mode = signal<AppMode>('channels');
  channels = signal<Channel[]>([]);
  currentChannel = signal<Channel | null>(null);
  channelEras = signal<ChannelEra[]>([]);
  selectedEraId = signal<number | null>(null);
  currentState = signal<ChannelState | null>(null);
  showStatic = signal<boolean>(true);
  isMuted = signal<boolean>(false);
  isFullscreen = signal<boolean>(false);

  isPaused = signal<boolean>(false);
  progressPercent = signal<number>(0);
  currentTimeFormatted = signal<string>('0:00');
  durationFormatted = signal<string>('0:00');
  audioTracks = signal<any[]>([]);
  currentAudioTrack = signal<number>(0);
  volumeLevel = signal<number>(1);

  showOverlay = signal<boolean>(false);

  showSeriesDialog = signal<boolean>(false);
  showSettingsDialog = signal<boolean>(false);
  showFiltersPanel = signal<boolean>(false);
  showScheduleDialog = signal<boolean>(false);

  allSeries = signal<SeriesResponse[]>([]);
  episodeTypes = signal<EpisodeType[]>([]);
  seriesSearchName = signal<string>('');
  seriesFilterChannelId = signal<number | null>(null);
  seriesPage = signal<number>(1);
  seriesTotalPages = signal<number>(1);
  seriesTotalCount = signal<number>(0);
  seriesLoading = signal<boolean>(false);

  selectedSeries = signal<SeriesResponse | null>(null);
  seriesEpisodes = signal<EpisodeResponse[]>([]);
  selectedSeason = signal<number | null>(null);
  selectedEpisodeType = signal<string>('normal');
  currentEpisode = signal<EpisodeResponse | null>(null);

  scheduleEntries = signal<ScheduleEntry[]>([]);
  scheduleLoading = signal<boolean>(false);
  watchedMap = signal<Record<number, boolean>>({});

  private readonly supportsAV1 = this.detectAV1Support();
  readonly isIOSDevice: boolean = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  private readonly bestVideoType: string = this.detectBestVideoType();
  iosNeedsPlay = signal<boolean>(false);

  seasonGroups = computed(() => {
    const eps = this.seriesEpisodes();
    return [...new Set(
      eps.filter(e => e.episodeTypeName.toLowerCase() === 'regular').map(e => e.season)
    )].sort((a, b) => a - b);
  });

  episodesForView = computed(() => {
    const eps = this.seriesEpisodes();
    const type = this.selectedEpisodeType();
    const season = this.selectedSeason();
    const s = this.settings();
    if (type === 'normal')
      return eps.filter(e => e.episodeTypeName.toLowerCase() === 'regular' && e.season === season);
    if (type === 'special' && s.includeSpecials)
      return eps.filter(e => e.episodeTypeName.toLowerCase() === 'special');
    if (type === 'movie' && s.includeMovies)
      return eps.filter(e => e.episodeTypeName.toLowerCase() === 'movie');
    return [];
  });

  hasSpecials = computed(() =>
    this.settings().includeSpecials &&
    this.seriesEpisodes().some(e => e.episodeTypeName.toLowerCase() === 'special')
  );

  hasMovies = computed(() =>
    this.settings().includeMovies &&
    this.seriesEpisodes().some(e => e.episodeTypeName.toLowerCase() === 'movie')
  );

  activeFilters = computed(() =>
    this.isFullscreen() ? this.settings().filtersFullscreen : this.settings().filters
  );

  settings = this.tvSettings.settings;

  private resizeObserver?: ResizeObserver;
  private hubConnection?: signalR.HubConnection;
  private overlayTimeout?: ReturnType<typeof setTimeout>;
  private progressInterval?: ReturnType<typeof setInterval>;
  private uiUpdateInterval?: ReturnType<typeof setInterval>;
  private readonly BUFFER_SECONDS = 20;
  private pendingNextEpisodePath: string | null = null;

  constructor() {
    effect(() => {
      const f = this.activeFilters();
      const _enabled = this.settings().alwaysShowFilters; // track so effect re-runs when toggled
      this.applyVideoFilters(f.scanlineIntensity, f.scanlineDensity, f.crtCurvature, f.vignette);
    });
  }

  ngAfterViewInit(): void {
    // Apply filters immediately — the effect() in constructor ran before the view existed
    const f = this.activeFilters();
    this.applyVideoFilters(f.scanlineIntensity, f.scanlineDensity, f.crtCurvature, f.vignette);

    this.loadChannels();
    this.loadEpisodeTypes();
    this.setupResizeObserver();
    setTimeout(() => this.adjustOverlay(), 100);

    this.ngZone.runOutsideAngular(() => {
      document.addEventListener('fullscreenchange', this.fullscreenHandler);
    });

    this.route.queryParams.subscribe(params => {
      if (params['serie']) {
        this.http.get<PagedResult<SeriesResponse>>(`${this.apiUrl}/api/v1/public/series`, {
          params: { name: params['serie'].replace(/-/g, ' '), pageSize: 1 },
        }).subscribe({ next: result => { if (result.items.length) this.enterSeriesMode(result.items[0]); } });
      }
    });

    if (window.screen?.orientation && window.innerWidth <= 768) {
      (window.screen.orientation as any).lock('portrait').catch(() => {
        // API no soportada en todos los browsers, ignorar silenciosamente
      });
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.hubConnection?.stop();
    clearTimeout(this.overlayTimeout);
    clearInterval(this.progressInterval);
    clearInterval(this.uiUpdateInterval);
    document.removeEventListener('fullscreenchange', this.fullscreenHandler);
  }

  // ── AV1 ───────────────────────────────────────────────────────────────────

  private detectAV1Support(): boolean {
    const video = document.createElement('video');
    return video.canPlayType('video/webm; codecs="av01.0.05M.08"') !== '' ||
           video.canPlayType('video/mp4; codecs="av01.0.05M.08"') !== '';
  }

  private detectBestVideoType(): string {
    if (!this.isIOSDevice) return 'video/mp4';
    const video = document.createElement('video');
    const types = [
      'video/mp4; codecs="hvc1.1.6.L186.B0,mp4a.40.2"',
      'video/mp4; codecs="hvc1.1.6.L153.B0,mp4a.40.2"',
      'video/mp4; codecs="hvc1.1.6.L120.B0,mp4a.40.2"',
      'video/mp4; codecs="hvc1.1.4.L186.B0,mp4a.40.2"',
      'video/mp4; codecs="hvc1.1.4.L153.B0,mp4a.40.2"',
      'video/mp4; codecs="hvc1.1.4.L120.B0,mp4a.40.2"',
      'video/mp4; codecs="hvc1.1.2.L186.B0,mp4a.40.2"',
      'video/mp4; codecs="hvc1.1.2.L120.B0,mp4a.40.2"',
      'video/mp4; codecs="hvc1.2.4.L153.B0,mp4a.40.2"',
      'video/mp4; codecs="hvc1.2.4.L120.B0,mp4a.40.2"',
      'video/mp4; codecs="hvc1.3.1.L186.B0,mp4a.40.2"',
      'video/mp4; codecs="hvc1.3.1.L120.B0,mp4a.40.2"',
      'video/mp4; codecs="hvc1"',
      'video/mp4; codecs="hev1"',
      'video/mp4',
    ];
    const best = types.find(t => video.canPlayType(t) === 'probably' || video.canPlayType(t) === 'maybe');
    console.log('[NostalgiaTV] iOS best video type:', best ?? 'none');
    return best ?? 'video/mp4';
  }

  private buildVideoSrc(filePath: string): string {
    const cleanPath = filePath.replace('wwwroot', '').replace(/\\/g, '/');
    return `${this.apiUrl}${cleanPath}`;
  }

  private setVideoSrc(src: string): void {
    const video = this.videoPlayer?.nativeElement;
    if (!video) return;
    video.src = src;
  }

  // ── Audio tracks ──────────────────────────────────────────────────────────

  private initAudioTracks(video: HTMLVideoElement): void {
    const tracks = (video as any).audioTracks;
    if (!tracks || tracks.length === 0) { this.audioTracks.set([]); return; }
    const list: any[] = [];
    for (let i = 0; i < tracks.length; i++) list.push(tracks[i]);
    this.audioTracks.set(list);
    this.setPreferredAudioTrack(video);
  }

  private setPreferredAudioTrack(video: HTMLVideoElement): void {
    const tracks = (video as any).audioTracks;
    if (!tracks || tracks.length === 0) return;
    const keywords = ['spa', 'es', 'esp', 'spanish', 'español', 'castellano'];
    let spanishIndex = -1;
    for (let i = 0; i < tracks.length; i++) {
      const lang = (tracks[i].language || tracks[i].lang || '').toLowerCase();
      const label = (tracks[i].label || '').toLowerCase();
      if (keywords.some(kw => lang.includes(kw) || label.includes(kw))) { spanishIndex = i; break; }
    }
    const target = spanishIndex >= 0 ? spanishIndex : 0;
    this.activateAudioTrack(video, target);
    this.currentAudioTrack.set(target);
  }

  private activateAudioTrack(video: HTMLVideoElement, index: number): void {
    const tracks = (video as any).audioTracks;
    if (!tracks) return;
    for (let i = 0; i < tracks.length; i++) tracks[i].enabled = i === index;
  }

  setAudioTrack(index: number): void {
    const video = this.videoPlayer?.nativeElement;
    if (!video) return;
    this.activateAudioTrack(video, index);
    this.currentAudioTrack.set(index);
  }

  // ── Playback controls ─────────────────────────────────────────────────────

  iosStartPlay(): void {
    const video = this.videoPlayer?.nativeElement;
    if (!video) return;
    this.iosNeedsPlay.set(false);
    video.play().catch(err => console.error('iOS play failed:', err));
  }

  togglePlayPause(): void {
    const video = this.videoPlayer?.nativeElement;
    if (!video) return;
    if (video.paused) { video.play(); this.isPaused.set(false); }
    else { video.pause(); this.isPaused.set(true); }
  }

  seekTo(event: MouseEvent): void {
    const video = this.videoPlayer?.nativeElement;
    if (!video || !video.duration) return;
    const bar = event.currentTarget as HTMLElement;
    const rect = bar.getBoundingClientRect();
    video.currentTime = ((event.clientX - rect.left) / rect.width) * video.duration;
  }

  onProgressKeydown(e: KeyboardEvent): void {
    if (e.key === 'ArrowRight') { e.preventDefault(); this.seekRelative(5); }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); this.seekRelative(-5); }
  }

  private seekRelative(seconds: number): void {
    const video = this.videoPlayer?.nativeElement;
    if (!video || !video.duration) return;
    video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds));
  }

  private startUiUpdate(): void {
    clearInterval(this.uiUpdateInterval);
    this.ngZone.runOutsideAngular(() => {
      this.uiUpdateInterval = setInterval(() => {
        const video = this.videoPlayer?.nativeElement;
        if (!video || !video.duration) return;
        const pct = (video.currentTime / video.duration) * 100;
        const ct = this.formatTime(video.currentTime);
        const dt = this.formatTime(video.duration);
        const paused = video.paused;
        const pctChanged = Math.abs(pct - this.progressPercent()) > 0.1;
        const pauseChanged = paused !== this.isPaused();
        if (pctChanged || pauseChanged || ct !== this.currentTimeFormatted()) {
          this.ngZone.run(() => {
            if (pctChanged) this.progressPercent.set(pct);
            if (ct !== this.currentTimeFormatted()) this.currentTimeFormatted.set(ct);
            if (dt !== this.durationFormatted()) this.durationFormatted.set(dt);
            if (pauseChanged) this.isPaused.set(paused);
          });
        }
      }, 500);
    });
  }

  private formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  // ── Volume ────────────────────────────────────────────────────────────────

  toggleMute(): void {
    const video = this.videoPlayer?.nativeElement;
    if (!video) return;
    video.muted = !video.muted;
    this.isMuted.set(video.muted);
  }

  setVolume(value: number): void {
    const video = this.videoPlayer?.nativeElement;
    if (!video) return;
    video.volume = value;
    video.muted = value === 0;
    this.volumeLevel.set(value);
    this.isMuted.set(value === 0);
  }

  volumeUp(): void {
    const v = this.videoPlayer?.nativeElement;
    if (v) { v.volume = Math.min(1, v.volume + 0.1); this.volumeLevel.set(v.volume); }
  }

  volumeDown(): void {
    const v = this.videoPlayer?.nativeElement;
    if (v) { v.volume = Math.max(0, v.volume - 0.1); this.volumeLevel.set(v.volume); }
  }

  // ── Filters ───────────────────────────────────────────────────────────────

  private applyVideoFilters(intensity: number, density: number, curvature: boolean, vignette: boolean): void {
    const el = this.videoFilters?.nativeElement;
    if (!el) return;
    const enabled = this.settings().alwaysShowFilters;
    el.style.setProperty('--scanline-opacity', enabled ? (intensity / 100).toString() : '0');
    el.style.setProperty('--scanline-size', `${density * 2}px`);
    el.style.setProperty('--curvature', (enabled && curvature) ? '1' : '0');
    el.style.setProperty('--vignette', (enabled && vignette) ? '1' : '0');
  }

  updateFilter(key: string, value: boolean | number): void {
    this.tvSettings.updateFilter({ [key]: value } as any, this.isFullscreen());
  }

  toggleFiltersPanel(): void { this.showFiltersPanel.update(v => !v); }
  closeFiltersPanel(): void  { this.showFiltersPanel.set(false); }

  // ── Channels ──────────────────────────────────────────────────────────────

  private loadChannels(): void {
    this.http.get<Channel[]>(`${this.apiUrl}/api/v1/public/channels`).subscribe({
      next: data => this.channels.set(data),
    });
  }

  private loadEpisodeTypes(): void {
    this.http.get<EpisodeType[]>(`${this.apiUrl}/api/v1/public/episode-types`).subscribe({
      next: data => this.episodeTypes.set(data),
    });
  }

  selectChannel(channel: Channel): void {
    this.stopProgressTracking();
    this.currentChannel.set(channel);
    this.selectedEraId.set(null);
    this.channelEras.set([]);
    this.showStatic.set(false);
    this.hubConnection?.stop();
    this.http.get<ChannelEra[]>(`${this.apiUrl}/api/v1/public/channels/${channel.id}/eras`).subscribe({
      next: (eras) => {
        this.channelEras.set(eras);
        if (eras.length === 1) {
          this.selectEra(eras[0]);
        }
      },
    });
  }

  selectEra(era: ChannelEra): void {
    this.selectedEraId.set(era.id);
    const channel = this.currentChannel();
    if (!channel) return;
    this.hubConnection?.stop();
    this.http.get<ChannelState>(`${this.apiUrl}/api/v1/public/channels/${channel.id}/state`).subscribe({
      next: state => {
        this.currentState.set(state);
        setTimeout(() => { this.loadChannelEpisode(state); this.connectToHub(channel.id); }, 100);
      },
    });
  }

  private loadChannelEpisode(state: ChannelState): void {
    this.pendingNextEpisodePath = null;
    const video = this.videoPlayer?.nativeElement;
    if (!video) return;

    this.setVideoSrc(this.buildVideoSrc(state.filePath));
    video.load();
    video.currentTime = state.currentSecond;
    const wasMuted = this.isMuted();
    video.muted = wasMuted;
    video.play().catch((err: Error) => {
      if (err.name === 'AbortError') return; // interrupted by next load(), not an autoplay block
      if (!wasMuted) {
        video.muted = true;
        this.isMuted.set(true);
        video.play().catch(() => {
          if (this.isIOSDevice) this.iosNeedsPlay.set(true);
        });
      } else if (this.isIOSDevice) {
        this.iosNeedsPlay.set(true);
      }
    });
    this.showOverlay.set(true);
    clearTimeout(this.overlayTimeout);
    this.overlayTimeout = setTimeout(() => this.showOverlay.set(false), 5000);
  }

  private connectToHub(channelId: number): void {
    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${this.apiUrl}/hubs/channel`)
      .withAutomaticReconnect()
      .build();

    this.hubConnection.on('ChannelState', (state: ChannelState) => {
      const current = this.currentState();
      const video = this.videoPlayer?.nativeElement;
      if (!video) return;
      if (current?.episodeId !== state.episodeId) {
        const remaining = video.duration - video.currentTime;
        if (remaining > 0 && remaining <= this.BUFFER_SECONDS) {
          this.pendingNextEpisodePath = `${this.apiUrl}${state.filePath}`;
          video.addEventListener('ended', () => this.playPendingNext(state), { once: true });
        } else {
          this.currentState.set(state);
          this.loadChannelEpisode(state);
        }
      } else {
        this.currentState.set(state);
        this.syncVideoPosition(video, state.currentSecond);
      }
    });

    this.hubConnection.start().then(() => this.hubConnection!.invoke('JoinChannel', channelId));
  }

  private syncVideoPosition(video: HTMLVideoElement, serverSecond: number): void {
    if (!video.duration) return;
    if (Math.abs(video.currentTime - serverSecond) > this.BUFFER_SECONDS)
      video.currentTime = serverSecond;
  }

  private playPendingNext(state: ChannelState): void {
    this.pendingNextEpisodePath = null;
    this.currentState.set(state);
    this.loadChannelEpisode(state);
  }

  // ── Series ────────────────────────────────────────────────────────────────

  enterSeriesMode(serie: SeriesResponse): void {
    this.stopProgressTracking();
    this.hubConnection?.stop();
    this.selectedSeries.set(serie);
    this.mode.set('series');
    this.closeSeriesDialog();
    this.currentState.set(null);
    this.currentEpisode.set(null);
    this.selectedSeason.set(null);
    this.selectedEpisodeType.set('normal');

    const slug = serie.name.toLowerCase().replace(/\s+/g, '-');
    this.router.navigate([], { queryParams: { serie: slug }, replaceUrl: true });

    this.http.get<EpisodeResponse[]>(`${this.apiUrl}/api/v1/public/series/${serie.id}/episodes`).subscribe({
      next: episodes => {
        this.seriesEpisodes.set(episodes);
        this.selectedSeason.set(this.seasonGroups()[0] ?? null);

        const progress = this.watchedService.getProgress(serie.id);
        const map: Record<number, boolean> = {};
        episodes.forEach(e => { map[e.id] = progress[e.id]?.completed ?? false; });
        this.watchedMap.set(map);

        const inProgress = episodes.find(e =>
          progress[e.id] && !progress[e.id].completed && progress[e.id].currentSecond > 0
        );
        const target = inProgress ?? this.watchedService.getNextUnwatched(serie.id, episodes);

        if (target) {
          const ep = episodes.find(e => e.id === (inProgress?.id ?? (target as any).id));
          if (ep) {
            if (ep.episodeTypeName.toLowerCase() === 'regular') {
              this.selectedSeason.set(ep.season);
              this.selectedEpisodeType.set('normal');
            } else if (ep.episodeTypeName.toLowerCase() === 'special') {
              this.selectEpisodeType('special');
            } else {
              this.selectEpisodeType('movie');
            }
            this.playEpisode(ep);
          }
        }
      },
    });
  }

  backToChannels(): void {
    this.stopProgressTracking();
    this.mode.set('channels');
    this.selectedSeries.set(null);
    this.seriesEpisodes.set([]);
    this.currentEpisode.set(null);
    this.watchedMap.set({});
    this.showStatic.set(true);
    this.hubConnection?.stop();
    this.router.navigate([], { queryParams: {}, replaceUrl: true });
    const video = this.videoPlayer?.nativeElement;
    if (video) { this.setVideoSrc(''); video.load(); }
    clearInterval(this.uiUpdateInterval);
  }

  selectSeason(season: number): void {
    this.selectedSeason.set(season);
    this.selectedEpisodeType.set('normal');
  }

  selectEpisodeType(type: string): void {
    this.selectedEpisodeType.set(type);
    this.selectedSeason.set(null);
  }

  playEpisode(episode: EpisodeResponse): void {
    if (!episode.filePath) return;
    this.stopProgressTracking();
    this.showStatic.set(false);

    setTimeout(() => {
      this.currentEpisode.set(episode);
      setTimeout(() => {
        const video = this.videoPlayer?.nativeElement;
        if (!video) return;
        const seriesId = this.selectedSeries()!.id;
        const savedSecond = this.watchedService.getLastProgress(seriesId, episode.id);

        this.setVideoSrc(this.buildVideoSrc(episode.filePath!));
        video.load();

        video.addEventListener('loadedmetadata', () => {
          this.initAudioTracks(video);
          video.currentTime = savedSecond > 0 ? savedSecond : 0;
        }, { once: true });

        const wasMuted = this.isMuted();
        video.muted = wasMuted;
        video.play().catch((err: Error) => {
          if (err.name === 'AbortError') return; // interrupted by next load(), not an autoplay block
          if (!wasMuted) {
            video.muted = true;
            this.isMuted.set(true);
            video.play().catch(() => {
              if (this.isIOSDevice) this.iosNeedsPlay.set(true);
            });
          } else if (this.isIOSDevice) {
            this.iosNeedsPlay.set(true);
          }
        });

        this.showOverlay.set(true);
        clearTimeout(this.overlayTimeout);
        this.overlayTimeout = setTimeout(() => this.showOverlay.set(false), 5000);

        this.startProgressTracking(episode);
        this.startUiUpdate();
      }, 100);
    }, 0);
  }

  private startProgressTracking(episode: EpisodeResponse): void {
    const seriesId = this.selectedSeries()?.id;
    if (!seriesId) return;
    let markedAsWatched = false;
    let advanced = false;
    const video = this.videoPlayer?.nativeElement;

    const onEnded = () => {
      if (advanced) return;
      advanced = true;
      clearInterval(this.progressInterval);
      this.ngZone.run(() => {
        if (this.settings().randomPlayback) this.playRandomEpisode();
        else this.playNextEpisode(episode);
      });
    };

    if (video) {
      if (this._endedHandler) video.removeEventListener('ended', this._endedHandler);
      this._endedHandler = onEnded;
      video.addEventListener('ended', this._endedHandler, { once: true });
    }

    this.ngZone.runOutsideAngular(() => {
      this.progressInterval = setInterval(() => {
        const v = this.videoPlayer?.nativeElement;
        if (!v || !v.duration) return;
        const pct = v.currentTime / v.duration;
        this.watchedService.markProgress(seriesId, episode.id, v.currentTime, pct >= 0.95);
        if (pct >= 0.95 && !markedAsWatched) {
          markedAsWatched = true;
          this.ngZone.run(() => this.markEpisodeCompleted(episode));
        }
      }, 5000);
    });
  }

  private _endedHandler: (() => void) | null = null;

  private stopProgressTracking(): void {
    clearInterval(this.progressInterval);
    const video = this.videoPlayer?.nativeElement;
    if (video && this._endedHandler) {
      video.removeEventListener('ended', this._endedHandler!);
    }
    this._endedHandler = null;
  }

  private markEpisodeCompleted(episode: EpisodeResponse): void {
    const seriesId = this.selectedSeries()?.id;
    if (!seriesId) return;
    this.watchedService.markProgress(seriesId, episode.id, 0, true);
    this.watchedMap.update(map => ({ ...map, [episode.id]: true }));
  }

  private playNextEpisode(current: EpisodeResponse): void {
    const list = this.episodesForView();
    const next = list[list.findIndex(e => e.id === current.id) + 1];
    if (next) this.playEpisode(next);
  }

  playRandomEpisode(): void {
    // Aleatorio de TODOS los episodios de la serie (todas las temporadas)
    const all = this.seriesEpisodes().filter(e => !!e.filePath);
    const pool = all.filter(e => !this.watchedMap()[e.id]);
    const source = pool.length > 0 ? pool : all;
    const random = source[Math.floor(Math.random() * source.length)];
    if (random) this.playEpisode(random);
  }

  onRandomToggleChange(checked: boolean): void {
    this.tvSettings.update({ randomPlayback: checked });
    if (checked) this.playRandomEpisode();
  }

  resetSeriesProgress(): void {
    const serie = this.selectedSeries();
    if (!serie) return;
    this.watchedService.resetSeries(serie.id);
    const map: Record<number, boolean> = {};
    this.seriesEpisodes().forEach(e => { map[e.id] = false; });
    this.watchedMap.set(map);
  }

  resetAllProgress(): void {
    this.watchedService.resetAll();
    this.watchedMap.set({});
  }

  // ── Dialogs ───────────────────────────────────────────────────────────────

  openSeriesDialog(): void {
    this.showSeriesDialog.set(true);
    this.loadSeries();
    setTimeout(() => {
      document.querySelector<HTMLElement>('.dialog-panel button[tabindex="10"]')?.focus();
    }, 50);
  }

  closeSeriesDialog(): void {
    this.showSeriesDialog.set(false);
    this.seriesSearchName.set('');
    this.seriesFilterChannelId.set(null);
    this.seriesPage.set(1);
    this.allSeries.set([]);
  }

  loadSeries(): void {
    this.seriesLoading.set(true);
    const params: any = { page: this.seriesPage(), pageSize: 10 };
    if (this.seriesSearchName()) params['name'] = this.seriesSearchName();
    if (this.seriesFilterChannelId()) params['channelId'] = this.seriesFilterChannelId();
    this.http.get<PagedResult<SeriesResponse>>(`${this.apiUrl}/api/v1/public/series`, { params }).subscribe({
      next: result => {
        this.allSeries.set(result.items);
        this.seriesTotalPages.set(result.totalPages);
        this.seriesTotalCount.set(result.totalCount);
        this.seriesLoading.set(false);
      },
      error: () => this.seriesLoading.set(false),
    });
  }

  onSeriesSearchChange(value: string): void {
    this.seriesSearchName.set(value);
    this.seriesPage.set(1);
    this.loadSeries();
  }

  onChannelFilterChange(value: string): void {
    this.seriesFilterChannelId.set(value ? +value : null);
    this.seriesPage.set(1);
    this.loadSeries();
  }

  seriesNextPage(): void {
    if (this.seriesPage() < this.seriesTotalPages()) { this.seriesPage.update(p => p + 1); this.loadSeries(); }
  }

  seriesPrevPage(): void {
    if (this.seriesPage() > 1) { this.seriesPage.update(p => p - 1); this.loadSeries(); }
  }

  openSettingsDialog(): void {
    this.showSettingsDialog.set(true);
    setTimeout(() => {
      document.querySelector<HTMLElement>('.dialog-panel--settings button')?.focus();
    }, 50);
  }

  closeSettingsDialog(): void { this.showSettingsDialog.set(false); }

  updateSetting(key: string, value: boolean | number): void {
    this.tvSettings.update({ [key]: value } as any);
  }

  openScheduleDialog(): void {
    const channel = this.currentChannel();
    if (!channel) return;
    this.showScheduleDialog.set(true);
    this.scheduleLoading.set(true);
    this.http.get<ScheduleEntry[]>(`${this.apiUrl}/api/v1/public/channels/${channel.id}/schedule`).subscribe({
      next: data => { this.scheduleEntries.set(data); this.scheduleLoading.set(false); },
      error: () => this.scheduleLoading.set(false),
    });
    setTimeout(() => {
      document.querySelector<HTMLElement>('.dialog-panel--schedule button')?.focus();
    }, 50);
  }

  closeScheduleDialog(): void {
    this.showScheduleDialog.set(false);
    this.scheduleEntries.set([]);
  }

  onScheduleChannelChange(channelId: number): void {
    const channel = this.channels().find(c => c.id === channelId);
    if (!channel) return;
    this.currentChannel.set(channel);
    this.scheduleLoading.set(true);
    this.http.get<ScheduleEntry[]>(`${this.apiUrl}/api/v1/public/channels/${channelId}/schedule`).subscribe({
      next: data => { this.scheduleEntries.set(data); this.scheduleLoading.set(false); },
      error: () => this.scheduleLoading.set(false),
    });
  }

  // ── Screen overlay mouse handlers ─────────────────────────────────────────

  onScreenClick(): void {
    if (!(this.currentState() || this.currentEpisode())) return;
    clearTimeout(this.overlayTimeout);
    if (this.showOverlay()) {
      this.showOverlay.set(false);
    } else {
      this.showOverlay.set(true);
      this.overlayTimeout = setTimeout(() => this.showOverlay.set(false), 5000);
    }
  }

  // ── UI ────────────────────────────────────────────────────────────────────

  toggleFullscreen(): void {
    const overlay = this.screenOverlay?.nativeElement;
    if (!overlay) return;
    if (!document.fullscreenElement) overlay.requestFullscreen();
    else document.exitFullscreen();
  }

  goToLogin(): void { this.router.navigate(['dashboard/login']); }

  private setupResizeObserver(): void {
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() =>
        requestAnimationFrame(() => this.adjustOverlay())
      );
      this.resizeObserver.observe(this.tvContainer.nativeElement);
      window.addEventListener('resize', () => requestAnimationFrame(() => this.adjustOverlay()));
    }
  }

  private adjustOverlay(): void {
    const container = this.tvContainer.nativeElement;
    const overlay = this.screenOverlay.nativeElement;

    if (document.fullscreenElement === overlay) {
      const fsW = window.innerWidth;
      const fsH = window.innerHeight;
      const tvAspect = 650 / 759;
      const fsScale = Math.min(fsW, fsH * tvAspect) / 650;
      overlay.style.setProperty('--screen-scale', fsScale.toString());
      return;
    }

    const cw = container.offsetWidth, ch = container.offsetHeight;
    const ow = 650, oh = 759;
    const imageAspect = ow / oh;
    const containerAspect = cw / ch;
    let rw: number, rh: number;
    if (containerAspect > imageAspect) { rh = ch; rw = rh * imageAspect; }
    else { rw = cw; rh = rw / imageAspect; }
    const scale = rw / ow;
    const left = (cw - rw) / 2;
    const top  = (ch - rh) / 2;
    overlay.style.width  = `${255 * scale}px`;
    overlay.style.height = `${199 * scale}px`;
    overlay.style.left   = `${left + 198 * scale}px`;
    overlay.style.top    = `${top  +  27 * scale}px`;
    overlay.style.setProperty('--screen-scale', scale.toString());
  }

  private fullscreenHandler = (): void => {
    this.ngZone.run(() => {
      const fs = !!document.fullscreenElement;
      this.isFullscreen.set(fs);
      setTimeout(() => this.adjustOverlay(), 50);
      // Hide overlay on fullscreen transition so user starts with a clean state
      clearTimeout(this.overlayTimeout);
      this.showOverlay.set(false);
    });
  };

}
