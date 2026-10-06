import { TestBed } from '@angular/core/testing';
import { SeasonalThemeService } from './seasonal-theme.service';

describe('SeasonalThemeService', () => {
  beforeEach(() => { localStorage.clear(); document.body.classList.remove('halloween-theme', 'seasonal-effects'); });
  afterEach(() => { localStorage.clear(); document.body.classList.remove('halloween-theme', 'seasonal-effects'); });
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
});
