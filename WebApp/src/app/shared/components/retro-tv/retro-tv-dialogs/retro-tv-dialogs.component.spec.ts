import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RetroTvDialogsComponent } from './retro-tv-dialogs.component';

describe('RetroTvDialogsComponent', () => {
  let component: RetroTvDialogsComponent;
  let fixture: ComponentFixture<RetroTvDialogsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RetroTvDialogsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(RetroTvDialogsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
