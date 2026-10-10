import { HttpEventType, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { Interlude } from '../broadcast-admin.service';
import { InterludeUploaderComponent } from './interlude-uploader.component';

describe('InterludeUploaderComponent', () => {
  let fixture: ComponentFixture<InterludeUploaderComponent>;
  let http: HttpTestingController;
  const base = `${environment.apiUrl}/api/v1/retro`;
  const clip: Interlude = {
    id: 7,
    title: 'City',
    kind: 0,
    season: 0,
    filePath: '/uploads/city.mp4',
    durationSeconds: 8,
    originalYearFrom: null,
    originalYearTo: null,
    regionCode: null,
    approvedForBroadcast: false,
  };
  const choose = (...names: string[]) =>
    fixture.componentInstance.choose({
      target: { files: names.map((name) => new File(['video'], name)), value: 'selected' },
    } as unknown as Event);
  const settle = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InterludeUploaderComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(InterludeUploaderComponent);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });
  afterEach(() => http.verify());

  it('uploads files sequentially without requiring titles or rights metadata', async () => {
    choose('city-1.mp4', 'city-2.mp4');
    const first = http.expectOne(`${base}/interludes`);
    expect(first.request.reportProgress).toBe(true);
    expect(first.request.body.has('title')).toBe(false);
    expect(first.request.body.has('license')).toBe(false);
    expect(first.request.body.has('redistributionAllowed')).toBe(false);
    first.event({ type: HttpEventType.UploadProgress, loaded: 2, total: 5 });
    expect(fixture.componentInstance.items()[0].progress).toBe(40);
    first.flush(clip);
    await settle();
    http.expectOne(`${base}/interludes`).flush({ ...clip, id: 8 });
    await settle();
    expect(fixture.componentInstance.items().map((item) => item.status)).toEqual([
      'completed',
      'completed',
    ]);
    expect(fixture.componentInstance.busy()).toBe(false);
  });

  it('retries era assignment without uploading the same clip twice', async () => {
    fixture.componentRef.setInput('eraId', 4);
    fixture.componentRef.setInput('role', 2);
    fixture.componentRef.setInput('seriesId', 7);
    choose('city.mp4');
    http.expectOne(`${base}/interludes`).flush(clip);
    await settle();
    http
      .expectOne(`${base}/eras/4/interludes/7/2`)
      .flush({}, { status: 500, statusText: 'Server Error' });
    await settle();
    expect(fixture.componentInstance.items()[0].status).toBe('failed');
    fixture.componentRef.setInput('seriesId', null);
    fixture.componentInstance.retry();
    http.expectNone(`${base}/interludes`);
    const assignment = http.expectOne(`${base}/eras/4/interludes/7/2`);
    expect(assignment.request.body).toEqual({ weight: 1, minimumGapSeconds: 0, seriesId: 7 });
    assignment.flush({});
    await settle();
    expect(fixture.componentInstance.items()[0].status).toBe('completed');
  });

  it('keeps other files moving when one upload fails', async () => {
    choose('bad.mp4', 'good.mp4');
    http.expectOne(`${base}/interludes`).flush({}, { status: 400, statusText: 'Invalid codec' });
    await settle();
    http.expectOne(`${base}/interludes`).flush(clip);
    await settle();
    expect(fixture.componentInstance.items().map((item) => item.status)).toEqual([
      'failed',
      'completed',
    ]);
  });

  it('rejects unsupported files and oversized batches before sending them', () => {
    choose('city.mkv');
    expect(fixture.componentInstance.error()).toContain('MP4');
    choose(...Array.from({ length: 31 }, (_, i) => `${i}.mp4`));
    expect(fixture.componentInstance.error()).toContain('30');
    http.expectNone(`${base}/interludes`);
  });

  it('cancels an active upload when leaving the view', () => {
    choose('city.mp4', 'next.mp4');
    const request = http.expectOne(`${base}/interludes`);
    fixture.destroy();
    expect(request.cancelled).toBe(true);
    http.expectNone(`${base}/interludes`);
  });
});
