import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { SeasonalThemeService } from '../../../core/services/seasonal-theme.service';
import { SeasonalAtmosphereComponent } from './seasonal-atmosphere.component';

describe('SeasonalAtmosphereComponent', () => {
  const theme = { enabled: signal(true), effects: signal(true) };
  beforeEach(() => {
    theme.enabled.set(true);
    theme.effects.set(true);
    TestBed.configureTestingModule({
      imports: [SeasonalAtmosphereComponent],
      providers: [{ provide: SeasonalThemeService, useValue: theme }],
    });
  });
  it('renders only three small decorative spiders, hidden from assistive technology', () => {
    const fixture = TestBed.createComponent(SeasonalAtmosphereComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.seasonal-spider').length).toBe(3);
    expect(fixture.nativeElement.querySelectorAll('.seasonal-bat--passing').length).toBe(1);
    expect(fixture.nativeElement.querySelectorAll('.seasonal-ghost').length).toBe(1);
    expect(fixture.nativeElement.querySelectorAll('.seasonal-pumpkin').length).toBe(1);
    expect(
      fixture.nativeElement.querySelector('.seasonal-atmosphere').getAttribute('aria-hidden'),
    ).toBe('true');
    expect(fixture.nativeElement.querySelectorAll('button, a, [tabindex]').length).toBe(0);
  });
  it('removes decorations when either the theme or effects are disabled', () => {
    const fixture = TestBed.createComponent(SeasonalAtmosphereComponent);
    theme.effects.set(false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.seasonal-atmosphere')).toBeNull();
    theme.effects.set(true);
    theme.enabled.set(false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.seasonal-atmosphere')).toBeNull();
  });
  it('pauses motion when the document is hidden and resumes on return', () => {
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    const fixture = TestBed.createComponent(SeasonalAtmosphereComponent);
    fixture.detectChanges();
    hidden.mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.seasonal-atmosphere--paused')).not.toBeNull();
    hidden.mockReturnValue(false);
    document.dispatchEvent(new Event('visibilitychange'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.seasonal-atmosphere--paused')).toBeNull();
    hidden.mockRestore();
  });
});
