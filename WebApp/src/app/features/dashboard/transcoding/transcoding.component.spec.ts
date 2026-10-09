import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TranscodingComponent } from './transcoding.component';
import { vi } from 'vitest';
import { MediaStatus } from './transcoding.service';

const status = (overrides: Partial<MediaStatus> = {}): MediaStatus => ({
  workers: [], counts: [], jobs: [], jobsTotal: 0, page: 1, pageSize: 20, ...overrides,
});

describe('TranscodingComponent', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ imports: [TranscodingComponent], providers: [provideHttpClient(), provideHttpClientTesting()] });
  });
  afterEach(() => { TestBed.resetTestingModule(); vi.useRealTimers(); });

  async function load(data = status()) {
    const fixture = TestBed.createComponent(TranscodingComponent);
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(0);
    const request = TestBed.inject(HttpTestingController).expectOne(request => request.url.endsWith('/transcoding'));
    expect(request.request.params.get('view')).toBe('pending');
    expect(request.request.params.get('pageSize')).toBe('20');
    request.flush(data); fixture.detectChanges();
    return fixture;
  }

  it('saves midnight to five AM in the selected timezone rather than the browser timezone', async () => {
    const component = (await load()).componentInstance;
    component.resourceDraft = { dayCores: 2, nightCores: 4, nightEnabled: true, nightStartMinute: 0, nightEndMinute: 300, timeZoneId: 'America/Guatemala', availableCores: 4, appliedCores: 1, appliedAtUtc: null };
    component.startTime = '00:00'; component.endTime = '05:00';
    component.saveResources();
    const request = TestBed.inject(HttpTestingController).expectOne(request => request.url.endsWith('/transcoding/resources'));
    expect(request.request.body.nightStartMinute).toBe(0);
    expect(request.request.body.nightEndMinute).toBe(300);
    expect(request.request.body.dayCores).toBe(2);
    expect(request.request.body.nightCores).toBe(4);
    request.flush(null);
    TestBed.inject(HttpTestingController).expectOne(request => request.url.endsWith('/transcoding')).flush(status());
    expect(component.resourcesMessage()).toContain('guardado');
  });

  it('rejects an empty overnight window without sending it', () => {
    const component = TestBed.createComponent(TranscodingComponent).componentInstance;
    component.resourceDraft = { dayCores: 1, nightCores: 3, nightEnabled: true, nightStartMinute: 0, nightEndMinute: 0, timeZoneId: 'UTC', availableCores: 4, appliedCores: 1, appliedAtUtc: null };
    component.startTime = component.endTime = '00:00';
    component.saveResources();
    expect(component.actionError()).toContain('distintas');
    TestBed.inject(HttpTestingController).expectNone(request => request.url.endsWith('/resources'));
  });

  it('shows paused and disconnected services without pretending they are running', () => {
    const fixture = TestBed.createComponent(TranscodingComponent);
    fixture.componentInstance.status.set(status({ workers: [{ id: 'transcode', enabled: false, heartbeatUtc: null }] }));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Worker sin conexión');
    expect(fixture.nativeElement.textContent).toContain('Activar servicio');
    expect(fixture.componentInstance.online('transcode')).toBe(false);
  });

  it('filters jobs and identifies a pause that lets the current file finish', () => {
    const fixture = TestBed.createComponent(TranscodingComponent);
    fixture.componentInstance.status.set(status({ workers: [{ id: 'transcode', enabled: false, heartbeatUtc: new Date().toISOString() }],
      counts: [{ worker: 'transcode', status: 'Processing', count: 1 }] }));
    expect(fixture.componentInstance.stateLabel('transcode')).toBe('Terminando archivo actual');
    expect(fixture.componentInstance.count('transcode', ['Processing'])).toBe(1);
  });

  it('does not show a successful pause when the API rejects the action', () => {
    const fixture = TestBed.createComponent(TranscodingComponent);
    const component = fixture.componentInstance;
    component.status.set(status({ workers: [{ id: 'transcode', enabled: true, heartbeatUtc: new Date().toISOString() }] }));
    component.toggle('transcode');
    TestBed.inject(HttpTestingController).expectOne(request => request.url.endsWith('/workers/transcode'))
      .flush({}, { status: 403, statusText: 'Forbidden' });
    expect(component.worker('transcode')?.enabled).toBe(true);
    expect(component.actionError()).toContain('No se pudo');
    expect(component.busy()).toBeNull();
  });

  it('keeps completed history out of the default queue and requests each view from the server', async () => {
    const fixture = await load(status({ counts: [{ worker: 'transcode', status: 'Completed', count: 140 }] }));
    expect(fixture.nativeElement.textContent).toContain('No hay archivos pendientes');
    const button = [...fixture.nativeElement.querySelectorAll('.queue-views button')]
      .find((button: any) => button.textContent.includes('Completados')) as HTMLButtonElement;
    button.click(); fixture.detectChanges(); await vi.advanceTimersByTimeAsync(0);
    const request = TestBed.inject(HttpTestingController).expectOne(request => request.url.endsWith('/transcoding'));
    expect(request.request.params.get('view')).toBe('Completed');
    request.flush(status({ jobsTotal: 140 })); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Página 1 de 7');
    expect(button.getAttribute('aria-pressed')).toBe('true');
  });

  it('paginates history and resets the page when the service changes', async () => {
    const fixture = await load(status({ jobsTotal: 203 }));
    const component = fixture.componentInstance;
    component.changePage(2); fixture.detectChanges(); await vi.advanceTimersByTimeAsync(0);
    const http = TestBed.inject(HttpTestingController);
    const page = http.expectOne(request => request.url.endsWith('/transcoding'));
    expect(page.request.params.get('page')).toBe('2');
    page.flush(status({ jobsTotal: 203, page: 2 }));
    component.selectWorker('index'); fixture.detectChanges(); await vi.advanceTimersByTimeAsync(0);
    const index = http.expectOne(request => request.url.endsWith('/transcoding'));
    expect(index.request.params.get('worker')).toBe('index');
    expect(index.request.params.get('page')).toBe('1');
    index.flush(status({ counts: [{ worker: 'index', status: 'Skipped', count: 80 }, { worker: 'transcode', status: 'Skipped', count: 20 }] }));
    expect(component.viewCount(['Skipped'])).toBe(80);
  });

  it('cancels stale filter requests and preserves the selected view during polling', async () => {
    const fixture = await load();
    const component = fixture.componentInstance;
    const http = TestBed.inject(HttpTestingController);
    component.selectView('Skipped'); fixture.detectChanges(); await vi.advanceTimersByTimeAsync(0);
    const previous = http.expectOne(request => request.params.get('view') === 'Skipped');
    component.selectView('Failed'); fixture.detectChanges(); await vi.advanceTimersByTimeAsync(0);
    expect(previous.cancelled).toBe(true);
    http.expectOne(request => request.params.get('view') === 'Failed').flush(status());
    await vi.advanceTimersByTimeAsync(5000);
    http.expectOne(request => request.params.get('view') === 'Failed').flush(status());
    expect(component.view()).toBe('Failed');
  });

  it('does not show stale history or a misleading empty state after a failed filter request', async () => {
    const fixture = await load();
    fixture.componentInstance.selectView('Completed'); fixture.detectChanges(); await vi.advanceTimersByTimeAsync(0);
    TestBed.inject(HttpTestingController).expectOne(request => request.url.endsWith('/transcoding'))
      .flush({}, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No se pudo actualizar la lista');
    expect(fixture.nativeElement.textContent).not.toContain('No hay trabajos completados');
  });
});
