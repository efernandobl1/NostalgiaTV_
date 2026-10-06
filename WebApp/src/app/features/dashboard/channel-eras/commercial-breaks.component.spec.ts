import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { CommercialBreaksComponent } from './commercial-breaks.component';

describe('CommercialBreaksComponent', () => {
  let fixture: ComponentFixture<CommercialBreaksComponent>;
  let http: HttpTestingController;
  const base = `${environment.apiUrl}/api/v1/retro`;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommercialBreaksComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(CommercialBreaksComponent);
    fixture.componentRef.setInput('eraId', 4);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne(`${base}/interludes`).flush([]);
    http.expectOne(`${base}/eras/4/interludes`).flush([]);
  });

  afterEach(() => http.verify());

  it('treats missing rules as disabled advertising, not a loading failure', () => {
    http
      .expectOne(`${base}/eras/4/break-rules`)
      .flush({}, { status: 404, statusText: 'Not Found' });
    expect(fixture.componentInstance.enabled()).toBe(false);
    expect(fixture.componentInstance.loading()).toBe(false);
    expect(fixture.componentInstance.error()).toBe('');
  });

  it('shows an error when the rules request fails unexpectedly', () => {
    http
      .expectOne(`${base}/eras/4/break-rules`)
      .flush({}, { status: 500, statusText: 'Server Error' });
    expect(fixture.componentInstance.error()).not.toBe('');
  });

  it('does not save an invalid advertisement range', () => {
    http
      .expectOne(`${base}/eras/4/break-rules`)
      .flush({ minimumAds: 1, maximumAds: 3, maximumBreakSeconds: 180 });
    fixture.componentInstance.rules = { minimumAds: 4, maximumAds: 2, maximumBreakSeconds: 180 };
    fixture.componentInstance.saveRules();
    http.expectNone((request) => request.method !== 'GET');
    expect(fixture.componentInstance.error()).not.toBe('');
  });

  it('saves the closing bumper in the current era', () => {
    http
      .expectOne(`${base}/eras/4/break-rules`)
      .flush({ minimumAds: 1, maximumAds: 3, maximumBreakSeconds: 180 });
    const component = fixture.componentInstance;
    component.draft[2] = { clipId: 8, weight: 2, minimumGapSeconds: 30 };
    component.assign(2);
    const request = http.expectOne(`${base}/eras/4/interludes/8/2`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ weight: 2, minimumGapSeconds: 30 });
    request.flush({ channelEraId: 4, interludeId: 8, role: 2, weight: 2, minimumGapSeconds: 30 });
    expect(component.assignments().length).toBe(1);
    expect(component.busy()).toBe(false);
  });
});
