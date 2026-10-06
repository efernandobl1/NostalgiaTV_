import { TestBed } from '@angular/core/testing';
import { computed } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ViewerSession, WatchedService } from './watched.service';

describe('WatchedService', () => {
  const episode = { id: 11, season: 1, episodeNumber: 1 };
  let service: WatchedService, http: HttpTestingController;
  const session = (profileId: string): ViewerSession => ({ profileId, devices: [], progress: [] });
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(WatchedService); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { http.verify(); localStorage.clear(); });
  it('counts unique watched intervals, not a seek to the end', () => {
    service.recordInterval(1, episode, 0, 5, 100, 5);
    service.recordInterval(1, episode, 99, 100, 100, 100);
    expect(service.isWatched(1, episode)).toBe(false);
    service.recordInterval(1, episode, 0, 30, 100, 30);
    service.recordInterval(1, episode, 0, 30, 100, 30);
    expect(service.isWatched(1, episode)).toBe(false);
    service.recordInterval(1, episode, 30, 60, 100, 60);
    service.recordInterval(1, episode, 60, 95, 100, 95);
    expect(service.isWatched(1, episode)).toBe(true);
  });
  it('does not clear a watched episode when it is replayed', () => {
    service.markProgress(1, episode, 100, true);
    service.markProgress(1, episode, 5, false);
    expect(service.isWatched(1, episode)).toBe(true);
  });

  it('updates cached catalog selectors when local playback changes', () => {
    const progress = computed(() => service.getLastProgress(1, episode));
    expect(progress()).toBe(0);
    service.recordInterval(1, episode, 0, 5, 100, 5);
    expect(progress()).toBe(5);
  });

  it('ignores non-finite playback data and invalid stored history', () => {
    localStorage.setItem('watched_1', 'null');
    expect(service.getProgress(1)).toEqual({});
    service.recordInterval(1, episode, 0, Number.NaN, 100, 1);
    expect(service.getProgress(1)).toEqual({});
    service.recordInterval(1, episode, 0, 5, 100, 5);
    expect(service.getLastProgress(1, episode)).toBe(5);
  });
  it('keeps device-local history separate from another shared profile', () => {
    service.markProgress(1, episode, 100, true);
    service.connect('TV').subscribe();
    http.expectOne(request => request.url.endsWith('/viewer/session')).flush(session('profile-a'));
    expect(service.isWatched(1, episode)).toBe(false);
    expect(JSON.parse(localStorage.getItem('watched_1')!).s1e1.completed).toBe(true);
    service.refresh();
    http.expectOne(request => request.url.endsWith('/viewer/session')).flush({ ...session('profile-a'), progress: [{ episodeId: 11, seriesId: 1, season: 1, episodeNumber: 1, completed: true, currentSecond: 100, updatedAtUtc: new Date().toISOString() }] });
    expect(service.isWatched(1, episode)).toBe(true);
    service.refresh();
    http.expectOne(request => request.url.endsWith('/viewer/session')).flush(session('profile-b'));
    expect(service.isWatched(1, episode)).toBe(false);
  });
  it('retains failed reports and retries after the session refresh', () => {
    service.connect('PC').subscribe();
    http.expectOne(request => request.url.endsWith('/viewer/session')).flush(session('profile-a'));
    service.recordInterval(1, episode, 0, 5, 100, 5);
    http.expectOne(request => request.url.endsWith('/viewer/progress')).flush({}, { status: 503, statusText: 'Unavailable' });
    expect(service.syncError()).toContain('reintentará');
    expect(JSON.parse(localStorage.getItem('viewer_outbox_profile-a')!)).toHaveLength(1);
    service.refresh();
    http.expectOne(request => request.url.endsWith('/viewer/session')).flush(session('profile-a'));
    http.expectOne(request => request.url.endsWith('/viewer/progress')).flush({ completed: false });
    expect(JSON.parse(localStorage.getItem('viewer_outbox_profile-a')!)).toHaveLength(0);
    expect(service.getLastProgress(1, episode)).toBe(5);
  });

  it('transfers unsent playback only when the server moves the same device to its paired profile', () => {
    const device = { id: 'same-tv', name: 'TV', current: true, lastSeenUtc: new Date().toISOString() };
    service.connect('TV').subscribe();
    http.expectOne(request => request.url.endsWith('/viewer/session')).flush({ ...session('source'), devices: [device] });
    service.recordInterval(1, episode, 0, 5, 100, 5);
    http.expectOne(request => request.url.endsWith('/viewer/progress')).flush({}, { status: 503, statusText: 'Offline' });
    service.refresh();
    http.expectOne(request => request.url.endsWith('/viewer/session')).flush({ ...session('paired'), devices: [device] });
    expect(service.getLastProgress(1, episode)).toBe(5);
    http.expectOne(request => request.url.endsWith('/viewer/progress')).flush({ completed: false });
    expect(JSON.parse(localStorage.getItem('viewer_outbox_source')!)).toEqual([]);
    expect(JSON.parse(localStorage.getItem('viewer_outbox_paired')!)).toEqual([]);
  });

  it('does not transfer unsent playback to a different device or profile', () => {
    const device = { id: 'old-tv', name: 'TV', current: true, lastSeenUtc: new Date().toISOString() };
    service.connect('TV').subscribe();
    http.expectOne(request => request.url.endsWith('/viewer/session')).flush({ ...session('source'), devices: [device] });
    service.recordInterval(1, episode, 0, 5, 100, 5);
    http.expectOne(request => request.url.endsWith('/viewer/progress')).flush({}, { status: 503, statusText: 'Offline' });
    service.refresh();
    http.expectOne(request => request.url.endsWith('/viewer/session')).flush({ ...session('other'), devices: [{ ...device, id: 'another-device' }] });
    expect(service.getLastProgress(1, episode)).toBe(0);
    expect(JSON.parse(localStorage.getItem('viewer_outbox_source')!)).toHaveLength(1);
    http.expectNone(request => request.url.endsWith('/viewer/progress'));
  });
});
