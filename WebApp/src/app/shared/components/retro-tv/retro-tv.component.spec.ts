import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { RetroTvComponent } from './retro-tv.component';
import { WatchedService } from '../../../core/services/watched.service';

describe('RetroTvComponent', () => {
  let component: RetroTvComponent;
  let fixture: ComponentFixture<RetroTvComponent>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RetroTvComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(RetroTvComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    component.tv.setEnabled(false);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('records continuous live-channel playback but ignores a seek and bumper playback', () => {
    const watched = TestBed.inject(WatchedService);
    const report = vi.spyOn(watched, 'recordInterval');
    const clock = vi.spyOn(performance, 'now');
    const tracker = component as unknown as { recordPlayback(video: HTMLVideoElement): void; flushPlayback(): void; videoSrc(path: string): string };
    const video = { src: new URL(tracker.videoSrc('/episode.mp4'), document.baseURI).href, duration: 100, currentTime: 0,
      paused: false, ended: false, seeking: false, playbackRate: 1 } as HTMLVideoElement;
    component.state.set({ channelId: 1, segmentId: 7, episodeId: 11, seriesId: 2, season: 1, episodeNumber: 3,
      filePath: '/episode.mp4', episodeTitle: 'Test', seriesName: 'Test', nextEpisodeId: 12, nextEpisodeTitle: 'Next', currentSecond: 0, secondsUntilNext: 100 });
    clock.mockReturnValue(0); tracker.recordPlayback(video);
    for (let second = 1; second <= 5; second++) { clock.mockReturnValue(second * 1000); video.currentTime = second; tracker.recordPlayback(video); }
    expect(report).toHaveBeenCalledWith(2, { id: 11, season: 1, episodeNumber: 3 }, 0, 5, 100, 5);
    report.mockClear(); clock.mockReturnValue(6000); video.currentTime = 99; tracker.recordPlayback(video); tracker.flushPlayback();
    expect(report).not.toHaveBeenCalled();
    component.state.update(state => ({ ...state!, episodeId: 0, isBumper: true }));
    clock.mockReturnValue(7000); video.currentTime = 100; tracker.recordPlayback(video); tracker.flushPlayback();
    expect(report).not.toHaveBeenCalled();
    clock.mockRestore(); report.mockRestore();
  });

  it('keeps the schedule action only in the header while showing current and next programmes', () => {
    component.state.set({
      channelId: 1,
      segmentId: 1,
      episodeId: 1,
      episodeTitle: 'Current episode',
      filePath: '/episode.mp4',
      seriesName: 'Retro series',
      currentSecond: 0,
      nextEpisodeId: 2,
      nextEpisodeTitle: 'Next episode',
      secondsUntilNext: 600,
    });
    fixture.detectChanges();

    const programme = fixture.nativeElement.querySelector('.now-and-next');
    expect(programme.textContent).toContain('Current episode');
    expect(programme.textContent).toContain('Next episode');
    expect(programme.querySelector('button')).toBeNull();

    const scheduleButtons = Array.from<HTMLButtonElement>(
      fixture.nativeElement.querySelectorAll('button'),
    ).filter((button) => button.textContent?.includes('Programación'));
    expect(scheduleButtons).toHaveLength(1);
    expect(scheduleButtons[0].closest('.public-header')).toBeTruthy();

    scheduleButtons[0].click();
    fixture.detectChanges();
    expect(component.showGuide()).toBe(true);
  });

  it('shows a retry action when channels cannot load', () => {
    http
      .expectOne((request) => request.url.endsWith('/public/channels'))
      .flush({}, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();

    expect(component.channelsLoading()).toBe(false);
    expect(component.channelsError()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Reintentar');

    component.loadChannels();
    http
      .expectOne((request) => request.url.endsWith('/public/channels'))
      .flush([{ id: 1, name: 'Retro channel' }]);
    expect(component.channelsError()).toBe(false);
    expect(component.channels()).toHaveLength(1);
  });

  it('keeps the same video mounted when entering and leaving TV mode', () => {
    const video = fixture.nativeElement.querySelector('video');
    component.enterTvMode();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('video')).toBe(video);
    expect(fixture.nativeElement.querySelectorAll('video')).toHaveLength(1);
    expect(fixture.nativeElement.querySelector('.cinema-overlay')).toBeTruthy();

    component.leaveCinema();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('video')).toBe(video);
    expect(fixture.nativeElement.querySelector('.cinema-overlay')).toBeNull();
  });

  it('identifies channels with their logos and keeps browsing actions in the header', () => {
    const channel = { id: 1, name: 'Jetix', logoPath: '/uploads/channels/jetix.png' };
    http.expectOne((request) => request.url.endsWith('/public/channels')).flush([channel]);
    fixture.detectChanges();

    const station = fixture.nativeElement.querySelector('.channel-station');
    expect(station.getAttribute('aria-label')).toBe('Ver canal Jetix');
    expect(station.querySelector('img').getAttribute('src')).toBe(component.logo(channel.logoPath));
    expect(fixture.nativeElement.querySelector('#channel-panel-title').textContent.trim()).toBe(
      'Canales',
    );
    expect(fixture.nativeElement.querySelector('.station-number')).toBeNull();
    expect(fixture.nativeElement.querySelector('.library-invitation')).toBeNull();
    expect(fixture.nativeElement.querySelector('.public-header nav').textContent).toContain(
      'Series',
    );

    component.enterTvMode();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.cinema-channel img').getAttribute('src')).toBe(
      component.logo(channel.logoPath),
    );

    component.guideRows.set([{ channel, entries: [] }]);
    component.showGuide.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.guide-channel img').getAttribute('src')).toBe(
      component.logo(channel.logoPath),
    );
  });

  it('shows one image action and no sound or fullscreen controls in TV mode', () => {
    component.enterTvMode();
    fixture.detectChanges();

    const overlay = fixture.nativeElement.querySelector('.cinema-overlay');
    expect(overlay.querySelectorAll('button').length).toBe(5);
    expect(overlay.textContent).toContain('Sincronizar');
    expect(overlay.querySelectorAll('.sound-controls')).toHaveLength(0);
    expect(overlay.querySelector('[aria-label="Volumen"]')).toBeNull();
    expect(overlay.textContent).toContain('Volver a la sala');
    expect(overlay.textContent).not.toContain('fullscreen_exit');
    expect(overlay.textContent.match(/Imagen/g)).toHaveLength(1);

    component.fullscreen.set(true);
    fixture.detectChanges();
    expect(overlay.querySelector('.sound-controls')).toBeNull();
  });

  it('keeps sound and exit fullscreen at the top with a single image action', () => {
    const video = fixture.nativeElement.querySelector('video');
    component.fullscreen.set(true);
    fixture.detectChanges();

    const overlay = fixture.nativeElement.querySelector('.cinema-overlay');
    expect(overlay.querySelector('.cinema-toolbar [aria-label="Volumen"]')).toBeTruthy();
    expect(overlay.querySelector('.cinema-bottom .sound-controls')).toBeNull();
    expect(overlay.querySelector('.cinema-toolbar').textContent).toContain(
      'Salir de pantalla completa',
    );
    expect(overlay.textContent).not.toContain('Volver a la sala');
    expect(overlay.textContent.match(/Imagen/g)).toHaveLength(1);
    expect(fixture.nativeElement.querySelector('video')).toBe(video);
    expect(fixture.nativeElement.querySelector('.player-controls').hasAttribute('inert')).toBe(
      true,
    );
  });

  it('keeps channels usable when a logo is missing or fails to load', () => {
    http
      .expectOne((request) => request.url.endsWith('/public/channels'))
      .flush([
        { id: 1, name: 'Jetix', logoPath: '/uploads/missing.png' },
        { id: 2, name: 'Retro channel' },
      ]);
    fixture.detectChanges();

    const stations = fixture.nativeElement.querySelectorAll('.channel-station');
    stations[0].querySelector('img').dispatchEvent(new Event('error'));
    fixture.detectChanges();

    for (const station of stations) {
      expect(station.querySelector('img')).toBeNull();
      expect(station.querySelector('.station-logo').textContent.trim()).toBe('live_tv');
      expect(station.disabled).toBe(false);
      expect(station.querySelector('.station-name').textContent.trim()).toBeTruthy();
    }
  });

  it('keeps volume and fullscreen controls available when the tuner is collapsed', () => {
    component.panelOpen.set(false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#tuner-list')).toBeNull();
    expect(fixture.nativeElement.querySelector('[aria-label="Silenciar"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[aria-label="Pantalla completa"]')).toBeTruthy();
  });

  it('closes a dialog with Escape outside TV mode', () => {
    component.showFilters.set(true);
    const event = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    component.onKey(event);
    expect(component.showFilters()).toBe(false);
    expect(event.defaultPrevented).toBe(true);
  });

  it('prevents focus reaching the room behind a dialog', () => {
    component.showFilters.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.room-page').hasAttribute('inert')).toBe(true);
    component.showFilters.set(false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.room-page').hasAttribute('inert')).toBe(false);
  });

  it('clamps keyboard seeking to the video duration', () => {
    const video = fixture.nativeElement.querySelector('video');
    Object.defineProperty(video, 'duration', { value: 120, configurable: true });
    component.seekTo(150);
    expect(video.currentTime).toBe(120);
    component.seekTo(-10);
    expect(video.currentTime).toBe(0);
  });

  it('reports an unavailable channel without showing an old programme', () => {
    const channel = { id: 2, name: 'Retro channel' };
    component.tune(channel);
    http
      .expectOne((request) => request.url.endsWith('/channels/2/state'))
      .flush({}, { status: 404, statusText: 'Not Found' });
    expect(component.tuning()).toBe(false);
    expect(component.state()).toBeNull();
    expect(component.tuneError()).toContain('no tiene señal');
    expect(component.current()).toEqual(channel);
  });
});
