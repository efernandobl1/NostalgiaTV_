import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { RetroTvComponent } from './retro-tv.component';

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
