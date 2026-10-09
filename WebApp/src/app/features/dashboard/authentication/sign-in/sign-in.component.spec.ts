import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';
import { SignInComponent } from './sign-in.component';

describe('SignInComponent', () => {
  let fixture: ComponentFixture<SignInComponent>;
  let component: SignInComponent;
  let response: Subject<void>;
  let auth: {
    isAuthenticated: ReturnType<typeof signal<boolean>>;
    login: ReturnType<typeof vi.fn>;
    checkSession: ReturnType<typeof vi.fn>;
  };
  let router: Router;

  beforeEach(async () => {
    localStorage.removeItem('rememberMe');
    sessionStorage.removeItem('sessionActive');
    response = new Subject<void>();
    auth = {
      isAuthenticated: signal(false),
      login: vi.fn(() => response.asObservable()),
      checkSession: vi.fn(() => response.asObservable()),
    };
    await TestBed.configureTestingModule({
      imports: [SignInComponent],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    }).compileComponents();
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(SignInComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.removeItem('rememberMe');
    sessionStorage.removeItem('sessionActive');
  });

  function fillForm(rememberMe = false) {
    component.authForm.setValue({ username: 'operator', password: 'test-passphrase', rememberMe });
  }

  it('labels invalid fields and does not submit missing credentials', () => {
    component.onSubmit();
    fixture.detectChanges();
    expect(auth.login).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('#username').getAttribute('aria-invalid')).toBe(
      'true',
    );
    expect(fixture.nativeElement.querySelector('#password-error').textContent).toContain(
      'Introduce',
    );
  });

  it('keeps one login request active and exposes the busy state', () => {
    fillForm();
    component.onSubmit();
    component.onSubmit();
    fixture.detectChanges();
    expect(auth.login).toHaveBeenCalledOnce();
    expect(auth.login).toHaveBeenCalledWith({
      username: 'operator',
      password: 'test-passphrase',
      rememberMe: false,
    });
    expect(fixture.nativeElement.querySelector('form').getAttribute('aria-busy')).toBe('true');
    expect(fixture.nativeElement.querySelector('[type="submit"]').disabled).toBe(true);
    expect(sessionStorage.getItem('sessionActive')).toBeNull();
  });

  it('remembers a successful login without storing credentials', () => {
    fillForm(true);
    component.onSubmit();
    response.next();
    response.complete();
    expect(localStorage.getItem('rememberMe')).toBe('true');
    expect(sessionStorage.getItem('sessionActive')).toBeNull();
    expect(auth.isAuthenticated()).toBe(true);
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
    expect(component.submitting).toBe(false);
  });

  it('sends the persistence preference to the API', () => {
    fillForm(true);
    component.onSubmit();
    expect(auth.login).toHaveBeenCalledWith({
      username: 'operator',
      password: 'test-passphrase',
      rememberMe: true,
    });
  });

  it('restores a remembered session after a new browser session opens the login page', () => {
    localStorage.setItem('rememberMe', 'true');
    fixture.destroy();
    fixture = TestBed.createComponent(SignInComponent);
    expect(auth.checkSession).toHaveBeenCalledOnce();
    expect(fixture.componentInstance.submitting).toBe(true);
    response.next();
    response.complete();
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
    expect(localStorage.getItem('rememberMe')).toBe('true');
    expect(fixture.componentInstance.submitting).toBe(false);
  });

  it.each([401, 503])(
    'handles a %s restoration failure without submitting credentials',
    (status) => {
      localStorage.setItem('rememberMe', 'true');
      fixture.destroy();
      fixture = TestBed.createComponent(SignInComponent);
      response.error(new HttpErrorResponse({ status }));
      expect(auth.login).not.toHaveBeenCalled();
      expect(localStorage.getItem('rememberMe')).toBe(status === 401 ? null : 'true');
      expect(fixture.componentInstance.submitting).toBe(false);
    },
  );

  it('only marks the current browser session after a successful login', () => {
    fillForm();
    component.onSubmit();
    response.next();
    response.complete();
    expect(sessionStorage.getItem('sessionActive')).toBe('true');
    expect(localStorage.getItem('rememberMe')).toBeNull();
  });

  it.each([
    [401, 'Usuario o contraseña incorrectos'],
    [429, 'demasiados intentos'],
    [503, 'No pudimos conectar'],
  ])('reports a %s response without remembering a failed login', (status, message) => {
    fillForm(true);
    component.onSubmit();
    response.error(new HttpErrorResponse({ status }));
    fixture.detectChanges();
    expect(component.submitting).toBe(false);
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(message);
    expect(localStorage.getItem('rememberMe')).toBeNull();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('reveals and hides the password with an accurately labelled action', () => {
    const button = fixture.nativeElement.querySelector('.access-reveal');
    expect(button.getAttribute('aria-label')).toBe('Mostrar contraseña');
    button.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#password').type).toBe('text');
    expect(button.getAttribute('aria-label')).toBe('Ocultar contraseña');
    button.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#password').type).toBe('password');
  });
});
