import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { Interlude } from '../broadcast-admin.service';
import { InterludesComponent } from './interludes.component';

describe('InterludesComponent', () => {
  let fixture: ComponentFixture<InterludesComponent>;
  let http: HttpTestingController;
  const base = `${environment.apiUrl}/api/v1/retro/interludes`;
  const clips: Interlude[] = [
    {
      id: 1,
      title: 'Entrada Halloween',
      kind: 0,
      season: 1,
      filePath: '/uploads/a.mp4',
      durationSeconds: 10,
      originalYearFrom: 2000,
      originalYearTo: null,
      regionCode: null,
      approvedForBroadcast: true,
    },
    {
      id: 2,
      title: 'Anuncio Navidad',
      kind: 1,
      season: 2,
      filePath: '/uploads/b.mp4',
      durationSeconds: 20,
      originalYearFrom: null,
      originalYearTo: null,
      regionCode: null,
      approvedForBroadcast: false,
    },
    {
      id: 3,
      title: 'Bumper habitual',
      kind: 0,
      season: 0,
      filePath: '/uploads/c.mp4',
      durationSeconds: 5,
      originalYearFrom: null,
      originalYearTo: null,
      regionCode: null,
      approvedForBroadcast: true,
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InterludesComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(InterludesComponent);
    http.expectOne(base).flush(clips);
    fixture.detectChanges();
  });
  afterEach(() => http.verify());
  it('opens direct multiple upload without the metadata form', () => {
    fixture.componentInstance.open(undefined, 0);
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('app-interlude-uploader input[multiple]'),
    ).not.toBeNull();
    expect(fixture.nativeElement.querySelector('input[name="title"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('input[name="license"]')).toBeNull();
  });

  it('opens the Halloween archive directly from its seasonal URL', async () => {
    await TestBed.inject(Router).navigateByUrl('/?season=halloween');
    fixture.detectChanges();
    const component = fixture.componentInstance;
    expect(component.halloweenLibrary()).toBe(true);
    expect(component.visible().map((clip) => clip.id)).toEqual([1]);
    expect(fixture.nativeElement.querySelector('h1').textContent).toBe('Archivo de Halloween');
    expect(
      [...fixture.nativeElement.querySelectorAll('button')].map((button: any) =>
        button.textContent.trim(),
      ),
    ).toContain('movieSubir bumper');
  });

  it.each([0, 1] as const)('uploads kind %s directly with Halloween preselected', (kind) => {
    const component = fixture.componentInstance;
    component.seasonFilter.set(1);
    component.open(undefined, kind);
    component.chooseFile({
      target: { files: [new File(['test'], 'Halloween.mp4', { type: 'video/mp4' })] },
    } as unknown as Event);
    expect(component.title).toBe('Halloween');
    expect(component.season).toBe(1);
    component.save();
    const request = http.expectOne(base);
    expect((request.request.body as FormData).get('kind')).toBe(String(kind));
    expect((request.request.body as FormData).get('season')).toBe('1');
    expect((request.request.body as FormData).has('approvedForBroadcast')).toBe(false);
    request.flush({ ...clips[0], kind });
    http.expectOne(base).flush(clips);
  });

  it('does not overwrite a manually entered title when choosing a video', () => {
    const component = fixture.componentInstance;
    component.open();
    component.title = 'My chosen title';
    component.chooseFile({
      target: { files: [new File(['test'], 'Halloween.mp4')] },
    } as unknown as Event);
    expect(component.title).toBe('My chosen title');
  });

  it('keeps an existing clip season when editing it from the Halloween archive', () => {
    const component = fixture.componentInstance;
    component.seasonFilter.set(1);
    component.open(clips[2]);
    expect(component.season).toBe(0);
  });

  it('combines season, kind, approval and search filters', () => {
    const component = fixture.componentInstance;
    component.seasonFilter.set(2);
    component.filter.set(1);
    component.pendingOnly.set(true);
    component.search.set('navidad');
    expect(component.visible().map((clip) => clip.id)).toEqual([2]);
    component.filter.set(0);
    expect(component.visible()).toEqual([]);
  });

  it('edits the season without changing approval or kind', () => {
    const component = fixture.componentInstance;
    component.open(clips[0]);
    component.season = 2;
    component.save();
    const request = http.expectOne(`${base}/1`);
    expect(request.request.body).toEqual({
      ...clips[0],
      season: 2,
      sourceUrl: null,
      license: null,
      redistributionAllowed: false,
    });
    request.flush({ ...clips[0], season: 2 });
    http.expectOne(base).flush(clips);
    expect(component.selected()?.season).toBe(2);
  });

  it('includes a seasonal advertisement in a new upload', () => {
    const component = fixture.componentInstance;
    component.open();
    component.title = 'Navidad';
    component.kind = 1;
    component.season = 2;
    component.chooseFile({
      target: { files: [new File(['test'], 'ad.mp4', { type: 'video/mp4' })] },
    } as unknown as Event);
    component.save();
    const request = http.expectOne(base);
    const body = request.request.body as FormData;
    expect(body.get('season')).toBe('2');
    expect(body.get('kind')).toBe('1');
    request.flush(clips[1]);
    http.expectOne(base).flush(clips);
  });

  it('labels the seasonal field and displays season labels on the shelf', () => {
    expect(fixture.nativeElement.textContent).toContain('Halloween · octubre');
    fixture.componentInstance.open(clips[0]);
    fixture.detectChanges();
    const select = fixture.nativeElement.querySelector('[name="season"]');
    expect(select.closest('label').textContent).toContain('Temporada de emisión');
    expect(select.getAttribute('aria-describedby')).toBe('season-help');
  });
  it('requires a license only for redistributable clips', () => {
    const component = fixture.componentInstance;
    component.open(clips[0]);
    component.redistributionAllowed = true;
    component.save();
    http.expectNone(`${base}/1`);
    expect(component.error()).toContain('licencia');
    component.license = 'CC0';
    component.save();
    const request = http.expectOne(`${base}/1`);
    expect(request.request.body.redistributionAllowed).toBe(true);
    expect(request.request.body.license).toBe('CC0');
    request.flush({ ...clips[0], license: 'CC0', redistributionAllowed: true });
    http.expectOne(base).flush(clips);
  });
  it('uploads and assigns a seasonal bumper directly to the chosen era', async () => {
    await TestBed.inject(Router).navigateByUrl('/?eraId=7&role=2&new=1&season=christmas');
    const component = fixture.componentInstance;
    expect(component.editor()).toBe(true);
    expect(component.season).toBe(2);
    component.chooseFile({
      target: { files: [new File(['test'], 'Christmas.mp4')] },
    } as unknown as Event);
    component.save();
    http.expectOne(base).flush({ ...clips[0], id: 9, season: 2 });
    const assignment = http.expectOne(`${environment.apiUrl}/api/v1/retro/eras/7/interludes/9/2`);
    assignment.flush({ channelEraId: 7, interludeId: 9, role: 2, weight: 1, minimumGapSeconds: 0 });
    http.expectOne(base).flush(clips);
    expect(component.assignmentPending()).toBe(false);
  });
  it('retries a failed assignment without uploading a duplicate clip', async () => {
    await TestBed.inject(Router).navigateByUrl('/?eraId=7&role=1&new=1');
    const component = fixture.componentInstance;
    component.chooseFile({ target: { files: [new File(['test'], 'ad.mp4')] } } as unknown as Event);
    component.save();
    http.expectOne(base).flush(clips[1]);
    const url = `${environment.apiUrl}/api/v1/retro/eras/7/interludes/2/1`;
    http.expectOne(url).flush({}, { status: 500, statusText: 'Error' });
    expect(component.selected()?.id).toBe(2);
    expect(component.assignmentPending()).toBe(true);
    component.save();
    http.expectOne(`${base}/2`).flush(clips[1]);
    http.expectOne(url).flush({});
    http.expectOne(base).flush(clips);
    expect(component.assignmentPending()).toBe(false);
  });
});
