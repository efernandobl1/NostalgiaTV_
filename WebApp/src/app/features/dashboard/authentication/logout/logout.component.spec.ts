import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';
import { LogoutComponent } from './logout.component';

describe('LogoutComponent', () => {
  let fixture: ComponentFixture<LogoutComponent>;
  let component: LogoutComponent;
  let response: Subject<void>;
  let auth: {
    isAuthenticated: ReturnType<typeof signal<boolean>>;
    logout: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    localStorage.setItem('rememberMe', 'true');
    sessionStorage.setItem('sessionActive', 'true');
    response = new Subject<void>();
    auth = { isAuthenticated: signal(true), logout: vi.fn(() => response.asObservable()) };
    await TestBed.configureTestingModule({
      imports: [LogoutComponent],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    }).compileComponents();
    fixture = TestBed.createComponent(LogoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.removeItem('rememberMe');
    sessionStorage.removeItem('sessionActive');
  });

  it('waits for confirmation before announcing that the session is closed', () => {
    expect(fixture.nativeElement.querySelector('h1').textContent).toContain('Cerrando');
    component.logout();
    expect(auth.logout).toHaveBeenCalledOnce();
    expect(auth.isAuthenticated()).toBe(true);
  });

  it('clears session preferences only after a successful logout', () => {
    response.next();
    response.complete();
    fixture.detectChanges();
    expect(auth.isAuthenticated()).toBe(false);
    expect(localStorage.getItem('rememberMe')).toBeNull();
    expect(sessionStorage.getItem('sessionActive')).toBeNull();
    expect(fixture.nativeElement.querySelector('h1').textContent).toContain('Sesión cerrada');
  });

  it('reports failed revocation honestly and allows a retry', () => {
    response.error(new Error('Unavailable'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(
      'No se confirmó',
    );
    expect(auth.isAuthenticated()).toBe(true);
    expect(localStorage.getItem('rememberMe')).toBe('true');
    response = new Subject<void>();
    fixture.nativeElement.querySelector('button').click();
    expect(auth.logout).toHaveBeenCalledTimes(2);
    response.next();
    response.complete();
    fixture.detectChanges();
    expect(component.failed).toBe(false);
    expect(fixture.nativeElement.querySelector('h1').textContent).toContain('Sesión cerrada');
  });
});
