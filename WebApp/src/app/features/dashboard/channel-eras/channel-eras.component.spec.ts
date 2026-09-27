import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ChannelErasComponent } from './channel-eras.component';
import { ChannelEraResponse } from '../../../shared/models/channel-era.model';
import { SeriesResponse } from '../../../shared/models/serie.model';
import { environment } from '../../../../environments/environment';

describe('ChannelErasComponent', () => {
  it('saves the selected seasons for the era', async () => {
    await TestBed.configureTestingModule({
      imports: [ChannelErasComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), provideNoopAnimations()],
    }).compileComponents();

    const fixture = TestBed.createComponent(ChannelErasComponent);
    const component = fixture.componentInstance;
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne(`${environment.apiUrl}/api/v1/channels`).flush([]);
    http.expectOne(`${environment.apiUrl}/api/v1/series`).flush([]);

    const era: ChannelEraResponse = {
      id: 3, channelId: 1, channelName: 'Jetix', name: 'Era Jetix',
      startDate: '2004-01-01', seriesIds: [7], seasonSelections: {}, bumpers: [],
    };
    const series: SeriesResponse = { id: 7, name: 'Los padrinos mágicos', startDate: '2001-01-01', seasons: 2, categoryIds: [] };
    component.selectedChannelId.set(1);
    component.series.set([series]);
    component.selectEra(era);
    component.toggleSeason(series, 2, false);
    component.saveSeriesSelection(era);

    const request = http.expectOne(`${environment.apiUrl}/api/v1/channels/0/eras/3/series`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ seriesIds: [7], seasonSelections: { 7: [0, 1] } });
    request.flush(era);
    http.expectOne(`${environment.apiUrl}/api/v1/channels/1/eras`).flush([era]);
  });
});
