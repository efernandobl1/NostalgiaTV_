import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AccountComponent } from './account.component';
import { AuthService } from '../../core/services/auth.service';
import { WatchedService } from '../../core/services/watched.service';
import { environment } from '../../../environments/environment';

describe('AccountComponent', () => {
  const auth = { isAuthenticated: () => false, checkSession: vi.fn(), login: vi.fn() };
  const watched = { connect: vi.fn() };
  const destination = '/tv?code=ABC-DEF-GHJ-KLM';
  beforeEach(async () => {
    vi.clearAllMocks();
    auth.checkSession.mockReturnValue(throwError(() => ({ status: 401 })));
    auth.login.mockReturnValue(of([]));
    watched.connect.mockReturnValue(of({}));
    await TestBed.configureTestingModule({ imports: [AccountComponent], providers: [
      provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
      { provide: AuthService, useValue: auth }, { provide: WatchedService, useValue: watched },
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({ returnUrl: destination }) } } },
    ] }).compileComponents();
  });

  function create(registrationEnabled = true) {
    const fixture = TestBed.createComponent(AccountComponent);
    TestBed.inject(HttpTestingController).expectOne(`${environment.apiUrl}/api/v1/server`).flush({ registrationEnabled, googleEnabled: true });
    fixture.detectChanges();
    return fixture;
  }

  it('registers without choosing a role and returns to the TV code after login', () => {
    const navigation = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const fixture = create();
    const account = fixture.componentInstance;
    account.registering.set(true);
    account.form.patchValue({ username: 'viewer', password: 'Private-test-passphrase' });
    account.submit();
    const request = TestBed.inject(HttpTestingController).expectOne(`${environment.apiUrl}/api/v1/auth/register`);
    expect(request.request.body).toEqual({ username: 'viewer', password: 'Private-test-passphrase' });
    request.flush(null, { status: 201, statusText: 'Created' });
    expect(auth.login).toHaveBeenCalledWith({ username: 'viewer', password: 'Private-test-passphrase', rememberMe: true });
    expect(watched.connect).toHaveBeenCalledWith('Navegador');
    expect(navigation).toHaveBeenCalledWith(destination);
    fixture.destroy();
  });

  it('rejects short registration passwords before requesting the API', () => {
    const fixture = create();
    fixture.componentInstance.registering.set(true);
    fixture.componentInstance.form.patchValue({ username: 'viewer', password: 'short' });
    fixture.componentInstance.submit();
    TestBed.inject(HttpTestingController).expectNone(`${environment.apiUrl}/api/v1/auth/register`);
    expect(auth.login).not.toHaveBeenCalled();
    expect(fixture.componentInstance.error()).toContain('12 a 128');
    fixture.destroy();
  });

  it('hides registration when the administrator disables it and preserves the Google return code', () => {
    const fixture = create(false);
    expect(fixture.nativeElement.textContent).not.toContain('Crear una cuenta');
    const link = fixture.nativeElement.querySelector('a[href*="/auth/google"]') as HTMLAnchorElement;
    expect(new URL(link.href).searchParams.get('returnUrl')).toBe(destination);
    fixture.destroy();
  });
});
