import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Router, provideRouter } from '@angular/router';
import { MenuService } from '../services/menu.service';
import { adminGuard } from './admin.guard';
import { UserResponse } from '../../shared/models/user.model';

describe('adminGuard', () => {
  const currentUser = signal<UserResponse | null>(null);
  beforeEach(() => {
    currentUser.set(null);
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: MenuService, useValue: { currentUser } }],
    });
  });

  it('allows the administrator into the new broadcast tools', () => {
    currentUser.set({ id: 1, username: 'Admin', rol: { id: 1, name: 'Administrator', description: '' } });
    expect(TestBed.runInInjectionContext(() => adminGuard({} as never, {} as never))).toBe(true);
  });

  it('redirects other roles to the studio overview', () => {
    currentUser.set({ id: 2, username: 'Editor', rol: { id: 2, name: 'Editor', description: '' } });
    const result = TestBed.runInInjectionContext(() => adminGuard({} as never, {} as never));
    expect(TestBed.inject(Router).serializeUrl(result as ReturnType<Router['createUrlTree']>)).toBe(
      '/dashboard/summary',
    );
  });
});
