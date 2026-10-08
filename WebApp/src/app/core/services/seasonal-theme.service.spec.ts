import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PlatformSettingsService } from './platform-settings.service';
import { vi } from 'vitest';
import { SeasonalThemeService } from './seasonal-theme.service';

describe('SeasonalThemeService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-15T12:00:00Z'));
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    localStorage.clear();
    document.body.classList.remove('halloween-theme', 'seasonal-effects');
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
    localStorage.clear();
    document.body.classList.remove('halloween-theme', 'seasonal-effects');
  });
  it('restores the classic theme and allows effects to be disabled separately', () => {
    const theme = TestBed.inject(SeasonalThemeService);
    theme.toggle();
    expect(document.body.classList.contains('halloween-theme')).toBe(true);
    theme.toggleEffects();
    expect(theme.enabled()).toBe(true);
    expect(document.body.classList.contains('seasonal-effects')).toBe(false);
    theme.toggle();
    expect(document.body.classList.contains('halloween-theme')).toBe(false);
    expect(localStorage.getItem('seasonal-theme')).toBe('classic');
  });

  it('defaults to Halloween in October even with an old undated classic preference', () => {
    vi.setSystemTime(new Date('2026-10-01T12:00:00Z'));
    localStorage.setItem('seasonal-theme', 'classic');
    expect(TestBed.inject(SeasonalThemeService).enabled()).toBe(true);
  });

  it('keeps Halloween active throughout October despite a local override or toggle', () => {
    vi.setSystemTime(new Date('2026-10-01T12:00:00Z'));
    localStorage.setItem('seasonal-theme-override', JSON.stringify({ year: 2026, month: 9, enabled: false }));
    const theme = TestBed.inject(SeasonalThemeService);
    theme.toggle();
    expect(theme.enabled()).toBe(true);
    expect(theme.canToggle()).toBe(false);
    vi.setSystemTime(new Date('2026-10-25T12:00:00Z'));
    document.dispatchEvent(new Event('visibilitychange'));
    expect(theme.enabled()).toBe(true);
    vi.setSystemTime(new Date('2027-10-01T12:00:00Z'));
    document.dispatchEvent(new Event('visibilitychange'));
    expect(theme.enabled()).toBe(true);
  });

  it('changes automatically at month boundaries while the page is open', () => {
    vi.setSystemTime(new Date('2026-10-01T05:59:00Z'));
    const theme = TestBed.inject(SeasonalThemeService);
    vi.advanceTimersByTime(60_000);
    expect(theme.enabled()).toBe(true);
    vi.setSystemTime(new Date('2026-11-01T12:00:00Z'));
    document.dispatchEvent(new Event('visibilitychange'));
    expect(theme.enabled()).toBe(false);
  });

  it('ignores malformed saved overrides', () => {
    vi.setSystemTime(new Date('2026-10-01T12:00:00Z'));
    localStorage.setItem('seasonal-theme-override', '{"year":2026,"month":9,"enabled":"false"}');
    expect(TestBed.inject(SeasonalThemeService).enabled()).toBe(true);
  });
  it('uses the database policy and restores it after a temporary outage', () => {
    vi.setSystemTime(new Date('2026-10-01T12:00:00Z'));
    const theme = TestBed.inject(SeasonalThemeService);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne(request => request.url.endsWith('/public/settings')).flush({
      seasonalThemesEnabled: false, seasonalEffectsEnabled: false, timeZoneId: 'America/Guatemala',
    });
    TestBed.tick();
    expect(theme.enabled()).toBe(false);
    expect(theme.canToggle()).toBe(false);
    expect(theme.effects()).toBe(false);
    theme.toggle();
    expect(theme.enabled()).toBe(false);
    document.dispatchEvent(new Event('visibilitychange'));
    http.expectOne(request => request.url.endsWith('/public/settings')).flush({}, { status: 503, statusText: 'Unavailable' });
    expect(theme.enabled()).toBe(false);
  });
  it('honors the configured timezone and keeps the local effects preference when global effects are disabled', () => {
    vi.setSystemTime(new Date('2026-10-01T00:30:00Z'));
    const theme = TestBed.inject(SeasonalThemeService);
    const site = TestBed.inject(PlatformSettingsService);
    expect(theme.enabled()).toBe(false);
    site.publicSettings.set({ seasonalThemesEnabled: true, seasonalEffectsEnabled: false, timeZoneId: 'UTC' });
    TestBed.tick();
    expect(theme.enabled()).toBe(true);
    expect(theme.effects()).toBe(false);
    site.publicSettings.update(settings => ({ ...settings, seasonalEffectsEnabled: true }));
    TestBed.tick();
    expect(theme.effects()).toBe(true);
  });
});
