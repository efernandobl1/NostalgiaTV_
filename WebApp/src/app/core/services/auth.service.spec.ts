import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { MenuService } from './menu.service';

describe('AuthService session restoration', () => {
  let http: HttpTestingController;
  let auth: AuthService;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MenuService, useValue: { loadCurrentUser: () => of([]) } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
  });
  afterEach(() => http.verify());
  it('shares a pending refresh so simultaneous navigation cannot reuse the same rotated token', () => {
    const first = vi.fn();
    const second = vi.fn();
    auth.checkSession().subscribe(first);
    auth.checkSession().subscribe(second);
    const request = http.expectOne(`${environment.apiUrl}/api/v1/auth/refresh`);
    expect(request.request.withCredentials).toBe(true);
    request.flush({});
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
    expect(auth.isAuthenticated()).toBe(true);
    auth.checkSession().subscribe();
    http.expectOne(`${environment.apiUrl}/api/v1/auth/refresh`).flush({});
  });
});
