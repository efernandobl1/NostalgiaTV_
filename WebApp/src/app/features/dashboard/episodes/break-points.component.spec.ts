import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { BreakPointsComponent } from './break-points.component';

describe('BreakPointsComponent', () => {
  let fixture: ComponentFixture<BreakPointsComponent>;
  let http: HttpTestingController;
  const url = `${environment.apiUrl}/api/v1/retro/episodes/7/break-points`;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BreakPointsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(BreakPointsComponent);
    fixture.componentRef.setInput('episodeId', 7);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne(url).flush([{ id: 1, episodeId: 7, offsetSeconds: 600 }]);
  });

  afterEach(() => http.verify());

  it('converts minutes and seconds and keeps the cuts ordered', () => {
    const component = fixture.componentInstance;
    component.position = '08:30';
    component.label = 'First break';
    component.add();
    const request = http.expectOne(url);
    expect(request.request.body).toEqual({ offsetSeconds: 510, label: 'First break' });
    request.flush({ id: 2, episodeId: 7, offsetSeconds: 510, label: 'First break' });
    expect(component.points().map((point) => point.offsetSeconds)).toEqual([510, 600]);
  });

  it('rejects malformed times and cuts outside the episode', () => {
    const component = fixture.componentInstance;
    component.duration.set(1320);
    for (const position of ['00:00', '08:90', '22:00', '1500:00']) {
      component.position = position;
      component.add();
      expect(component.error()).not.toBe('');
    }
    http.expectNone((request) => request.method === 'POST');
  });

  it('removes a cut only after the server confirms it', () => {
    const component = fixture.componentInstance;
    component.remove(component.points()[0]);
    expect(component.points().length).toBe(1);
    http.expectOne(`${url}/1`).flush(null);
    expect(component.points()).toEqual([]);
    expect(component.busy()).toBe(false);
  });
});
