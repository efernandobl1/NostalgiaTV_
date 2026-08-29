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
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
