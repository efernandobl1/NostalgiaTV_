import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { SettingsComponent } from './settings.component';
import { PlatformSettings, PlatformSettingsService } from '../../../core/services/platform-settings.service';

describe('SettingsComponent', () => {
  const settings: PlatformSettings = {
    seasonalThemesEnabled: true, seasonalEffectsEnabled: true, seasonalEpisodesEnabled: true,
    seasonalInterludesEnabled: true, timeZoneId: 'America/Guatemala', noRepeatWindowHours: 24,
    maxSpecialsPerDay: 5, maxSpecialsPerSeriesPerDay: 2, maxMoviesPerDay: 2, maxMoviesPerSeriesPerDay: 2,
  };
  beforeEach(() => TestBed.configureTestingModule({
    imports: [SettingsComponent], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
  }));
  afterEach(() => TestBed.inject(HttpTestingController).verify());
  function create() {
    const fixture = TestBed.createComponent(SettingsComponent);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne(request => request.url.endsWith('/settings')).flush(settings);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, http };
  }
  it('loads persisted values and prevents saving until something changes', () => {
    const { fixture, component } = create();
    expect(component.form.getRawValue()).toEqual(settings);
    expect(fixture.nativeElement.querySelector('button[type=submit]').disabled).toBe(true);
    expect(fixture.nativeElement.querySelectorAll('input[type=checkbox]').length).toBe(4);
  });
  it('saves once, updates the public policy and restores a clean form', () => {
    const { component, http } = create();
    component.form.controls.seasonalThemesEnabled.setValue(false);
    component.form.markAsDirty();
    component.save(); component.save();
    const request = http.expectOne(request => request.method === 'PUT');
    expect(request.request.body.seasonalThemesEnabled).toBe(false);
    request.flush({ ...settings, seasonalThemesEnabled: false });
    expect(component.saved()).toBe(true);
    expect(component.form.dirty).toBe(false);
    expect(TestBed.inject(PlatformSettingsService).publicSettings().seasonalThemesEnabled).toBe(false);
  });
  it('rejects invalid daily limits and fractional numbers without sending a request', () => {
    const { component, http } = create();
    component.form.controls.maxSpecialsPerSeriesPerDay.setValue(6);
    expect(component.form.hasError('dailyLimits')).toBe(true);
    component.save();
    http.expectNone(request => request.method === 'PUT');
    component.form.controls.maxSpecialsPerSeriesPerDay.setValue(2);
    component.form.controls.noRepeatWindowHours.setValue(1.5);
    expect(component.form.invalid).toBe(true);
  });
  it('preserves unsaved values after a save failure', () => {
    const { component, http } = create();
    component.form.controls.noRepeatWindowHours.setValue(48);
    component.form.markAsDirty();
    component.save();
    http.expectOne(request => request.method === 'PUT').flush({}, { status: 500, statusText: 'Error' });
    expect(component.saving()).toBe(false);
    expect(component.form.enabled).toBe(true);
    expect(component.form.controls.noRepeatWindowHours.value).toBe(48);
    expect(component.form.dirty).toBe(true);
  });
  it('does not display or save defaults when loading fails', () => {
    const fixture = TestBed.createComponent(SettingsComponent);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne(request => request.url.endsWith('/settings')).flush({}, { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
    fixture.componentInstance.save();
    http.expectNone(request => request.method === 'PUT');
  });
});
