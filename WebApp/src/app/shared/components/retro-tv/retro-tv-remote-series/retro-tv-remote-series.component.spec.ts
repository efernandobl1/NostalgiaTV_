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
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
