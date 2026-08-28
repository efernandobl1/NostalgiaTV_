import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RetroTvComponent } from './retro-tv.component';

describe('RetroTvComponent', () => {
  let component: RetroTvComponent;
  let fixture: ComponentFixture<RetroTvComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RetroTvComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(RetroTvComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
