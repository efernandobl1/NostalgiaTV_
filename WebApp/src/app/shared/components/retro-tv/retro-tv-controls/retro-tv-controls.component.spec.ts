import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RetroTvControlsComponent } from './retro-tv-controls.component';

describe('RetroTvControlsComponent', () => {
  let component: RetroTvControlsComponent;
  let fixture: ComponentFixture<RetroTvControlsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RetroTvControlsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(RetroTvControlsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
