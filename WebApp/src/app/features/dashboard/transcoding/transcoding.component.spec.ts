import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TranscodingComponent } from './transcoding.component';

describe('TranscodingComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [TranscodingComponent], providers: [provideHttpClient(), provideHttpClientTesting()] }));

  it('saves midnight to five AM in the selected timezone rather than the browser timezone', () => {
    const component = TestBed.createComponent(TranscodingComponent).componentInstance;
    component.resourceDraft = { dayCores: 2, nightCores: 4, nightEnabled: true, nightStartMinute: 0, nightEndMinute: 300, timeZoneId: 'America/Guatemala', availableCores: 4, appliedCores: 1, appliedAtUtc: null };
    component.startTime = '00:00'; component.endTime = '05:00';
    component.saveResources();
    const request = TestBed.inject(HttpTestingController).expectOne(request => request.url.endsWith('/transcoding/resources'));
    expect(request.request.body.nightStartMinute).toBe(0);
    expect(request.request.body.nightEndMinute).toBe(300);
    expect(request.request.body.dayCores).toBe(2);
    expect(request.request.body.nightCores).toBe(4);
    request.flush(null);
    TestBed.inject(HttpTestingController).expectOne(request => request.url.endsWith('/transcoding')).flush({ workers: [], counts: [], jobs: [] });
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
    fixture.componentInstance.status.set({ workers: [{ id: 'transcode', enabled: false, heartbeatUtc: null }], counts: [], jobs: [] });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Worker sin conexión');
    expect(fixture.nativeElement.textContent).toContain('Activar servicio');
    expect(fixture.componentInstance.online('transcode')).toBe(false);
  });

  it('filters jobs and identifies a pause that lets the current file finish', () => {
    const fixture = TestBed.createComponent(TranscodingComponent);
    fixture.componentInstance.status.set({ workers: [{ id: 'transcode', enabled: false, heartbeatUtc: new Date().toISOString() }],
      counts: [{ worker: 'transcode', status: 'Processing', count: 1 }], jobs: [] });
    expect(fixture.componentInstance.stateLabel('transcode')).toBe('Terminando archivo actual');
    expect(fixture.componentInstance.count('transcode', ['Processing'])).toBe(1);
  });

  it('does not show a successful pause when the API rejects the action', () => {
    const fixture = TestBed.createComponent(TranscodingComponent);
    const component = fixture.componentInstance;
    component.status.set({ workers: [{ id: 'transcode', enabled: true, heartbeatUtc: new Date().toISOString() }], counts: [], jobs: [] });
    component.toggle('transcode');
    TestBed.inject(HttpTestingController).expectOne(request => request.url.endsWith('/workers/transcode'))
      .flush({}, { status: 403, statusText: 'Forbidden' });
    expect(component.worker('transcode')?.enabled).toBe(true);
    expect(component.actionError()).toContain('No se pudo');
    expect(component.busy()).toBeNull();
  });
});
