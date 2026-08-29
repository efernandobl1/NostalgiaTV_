import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RetroTvFiltersPanelComponent } from './retro-tv-filters-panel.component';

describe('RetroTvFiltersPanelComponent', () => {
  let component: RetroTvFiltersPanelComponent;
  let fixture: ComponentFixture<RetroTvFiltersPanelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RetroTvFiltersPanelComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(RetroTvFiltersPanelComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('activeFilters', {
      scanlineIntensity: 15,
      scanlineDensity: 1,
      crtCurvature: true,
      vignette: true,
      scanlineAnimation: true,
    });
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
