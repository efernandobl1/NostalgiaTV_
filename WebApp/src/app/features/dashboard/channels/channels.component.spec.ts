import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { ChannelsComponent } from './channels.component';
import { ChannelResponse } from '../../../shared/models/channel.model';
import { environment } from '../../../../environments/environment';

describe('ChannelsComponent', () => {
  let component: ChannelsComponent;
  let fixture: ComponentFixture<ChannelsComponent>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChannelsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), provideNoopAnimations()]
    }).compileComponents();

    fixture = TestBed.createComponent(ChannelsComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne(`${environment.apiUrl}/api/v1/channels`).flush([]);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('keeps schedule regeneration available from the channel detail', () => {
    const channel: ChannelResponse = { id: 7, name: 'Jetix', logoPath: '', startDate: '2004-01-01', eras: [], seriesIds: [] };
    component.selectedChannel.set(channel);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Regenerar programación');
    component.refreshSchedule(channel);

    const request = http.expectOne(`${environment.apiUrl}/api/v1/channels/7/schedule/refresh`);
    expect(request.request.method).toBe('POST');
    request.flush({}, { status: 202, statusText: 'Accepted' });
  });
});
