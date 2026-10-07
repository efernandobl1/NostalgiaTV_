import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { SeasonalThemeService } from './seasonal-theme.service';

describe('SeasonalThemeService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 15));
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
    vi.setSystemTime(new Date(2026, 9, 1));
    localStorage.setItem('seasonal-theme', 'classic');
    expect(TestBed.inject(SeasonalThemeService).enabled()).toBe(true);
  });

  it('remembers opting out for this October and automatically enables next October', () => {
    vi.setSystemTime(new Date(2026, 9, 1));
    let theme = TestBed.inject(SeasonalThemeService);
    theme.toggle();
    expect(theme.enabled()).toBe(false);
    TestBed.resetTestingModule();
    vi.setSystemTime(new Date(2026, 9, 25));
    theme = TestBed.inject(SeasonalThemeService);
    expect(theme.enabled()).toBe(false);
    vi.setSystemTime(new Date(2027, 9, 1));
    document.dispatchEvent(new Event('visibilitychange'));
    expect(theme.enabled()).toBe(true);
  });

  it('changes automatically at month boundaries while the page is open', () => {
    vi.setSystemTime(new Date(2026, 8, 30, 23, 59));
    const theme = TestBed.inject(SeasonalThemeService);
    vi.advanceTimersByTime(60_000);
    expect(theme.enabled()).toBe(true);
    vi.setSystemTime(new Date(2026, 10, 1));
    document.dispatchEvent(new Event('visibilitychange'));
    expect(theme.enabled()).toBe(false);
  });

  it('ignores malformed saved overrides', () => {
    vi.setSystemTime(new Date(2026, 9, 1));
    localStorage.setItem('seasonal-theme-override', '{"year":2026,"month":9,"enabled":"false"}');
    expect(TestBed.inject(SeasonalThemeService).enabled()).toBe(true);
  });
});
