import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RetroTvRemoteChannelsComponent } from './retro-tv-remote-channels.component';

describe('RetroTvRemoteChannelsComponent', () => {
  let component: RetroTvRemoteChannelsComponent;
  let fixture: ComponentFixture<RetroTvRemoteChannelsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RetroTvRemoteChannelsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(RetroTvRemoteChannelsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
