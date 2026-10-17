import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ServerUpdatesService } from './server-updates.service';

describe('ServerUpdatesService', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] }));
  afterEach(() => TestBed.inject(HttpTestingController).verify());
  it('never requests an update without a connected agent', () => {
    TestBed.inject(ServerUpdatesService).request();
    TestBed.inject(HttpTestingController).expectNone(request => request.method === 'POST');
  });
  it('submits only one update request and preserves the acknowledgement', () => {
    const service = TestBed.inject(ServerUpdatesService);
    service.status.set({ currentCommit: 'old', release: null, available: true, agentConnected: true, state: 'idle', message: null });
    service.request(); service.request();
    TestBed.inject(HttpTestingController).expectOne(request => request.method === 'POST').flush(null, { status: 202, statusText: 'Accepted' });
    service.request();
    expect(service.requested()).toBe(true);
    TestBed.inject(HttpTestingController).expectNone(request => request.method === 'POST');
  });
  it('keeps the previous state and exposes a retryable discovery failure', () => {
    const service = TestBed.inject(ServerUpdatesService);
    service.refresh(); service.refresh();
    TestBed.inject(HttpTestingController).expectOne(request => request.method === 'GET').flush({}, { status: 503, statusText: 'Unavailable' });
    expect(service.error()).toContain('No se pudo');
    expect(service.loading()).toBe(false);
  });
});
