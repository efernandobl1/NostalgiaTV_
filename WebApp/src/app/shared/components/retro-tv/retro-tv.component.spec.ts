import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RetroTvComponent } from './retro-tv.component';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

describe('RetroTvComponent', () => {
  let component: RetroTvComponent;
  let fixture: ComponentFixture<RetroTvComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RetroTvComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(RetroTvComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
