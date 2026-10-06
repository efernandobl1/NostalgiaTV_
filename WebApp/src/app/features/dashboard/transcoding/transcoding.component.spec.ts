import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TranscodingComponent } from './transcoding.component';

describe('TranscodingComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [TranscodingComponent], providers: [provideHttpClient(), provideHttpClientTesting()] }));

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
