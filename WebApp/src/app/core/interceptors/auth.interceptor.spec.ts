import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MenuService } from '../services/menu.service';
import { AuthInterceptor } from './auth.interceptor';

describe('Authenticated request security', () => {
  let http: HttpTestingController;
  let client: HttpClient;
  const api = `${environment.apiUrl}/api/v1`;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(withInterceptors([AuthInterceptor])), provideHttpClientTesting(),
      { provide: MenuService, useValue: { loadCurrentUser: () => of([]) } },
    ] });
    http = TestBed.inject(HttpTestingController);
    client = TestBed.inject(HttpClient);
  });
  afterEach(() => http.verify());

  it('refreshes once for concurrent expired requests and retries them once', () => {
    const first = vi.fn();
    const second = vi.fn();
    client.get(`${api}/users/me`).subscribe(first);
    client.get(`${api}/menus`).subscribe(second);
    http.expectOne(`${api}/users/me`).flush({}, { status: 401, statusText: 'Unauthorized' });
    http.expectOne(`${api}/menus`).flush({}, { status: 401, statusText: 'Unauthorized' });
    http.expectOne(`${api}/auth/refresh`).flush({});
    http.expectOne(`${api}/users/me`).flush({ id: 1 });
    http.expectOne(`${api}/menus`).flush([]);
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
  });

  it('does not send credentials to third-party URLs', () => {
    client.get('https://external.example/api/v1/data').subscribe();
    const request = http.expectOne('https://external.example/api/v1/data');
    expect(request.request.withCredentials).toBe(false);
    request.flush({});
  });

  it('does not loop when login or refresh fails', () => {
    const error = vi.fn();
    client.post(`${api}/auth/token`, {}).subscribe({ error });
    http.expectOne(`${api}/auth/token`).flush({}, { status: 401, statusText: 'Unauthorized' });
    http.expectNone(`${api}/auth/refresh`);
    expect(error).toHaveBeenCalledOnce();
  });
});
