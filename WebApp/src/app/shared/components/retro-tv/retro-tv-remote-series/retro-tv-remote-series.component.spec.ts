import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RetroTvRemoteSeriesComponent } from './retro-tv-remote-series.component';

describe('RetroTvRemoteSeriesComponent', () => {
  let component: RetroTvRemoteSeriesComponent;
  let fixture: ComponentFixture<RetroTvRemoteSeriesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RetroTvRemoteSeriesComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(RetroTvRemoteSeriesComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('settings', {
      alwaysShowFilters: true,
      showBumpers: false,
      showAds: false,
      tvGlowEffect: true,
      includeMovies: true,
      includeSpecials: true,
      randomPlayback: false,
      filters: {
        scanlineIntensity: 15,
        scanlineDensity: 1,
        crtCurvature: true,
        vignette: true,
        scanlineAnimation: true,
      },
      filtersFullscreen: {
        scanlineIntensity: 25,
        scanlineDensity: 2,
        crtCurvature: true,
        vignette: true,
        scanlineAnimation: false,
      },
    });
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
