import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { MenuService } from '../../core/services/menu.service';
import { SeasonalThemeService } from '../../core/services/seasonal-theme.service';
import { UserResponse } from '../../shared/models/user.model';
import { DashboardLayoutComponent } from './dashboard-layout.component';

describe('DashboardLayoutComponent Halloween archive access', () => {
  const user = signal<UserResponse | null>(null);
  const seasonal = { enabled: signal(true), effects: signal(true) };
  beforeEach(() => {
    user.set({ id: 1, username: 'Admin', rol: { id: 1, name: 'Administrator', description: '' } });
    seasonal.enabled.set(true);
    TestBed.configureTestingModule({
      imports: [DashboardLayoutComponent],
      providers: [
        provideRouter([]),
        { provide: MenuService, useValue: { currentUser: user, menus: signal([]) } },
        { provide: SeasonalThemeService, useValue: seasonal },
      ],
    });
  });

  it('links administrators directly to Halloween uploads when the theme is active', () => {
    const fixture = TestBed.createComponent(DashboardLayoutComponent);
    fixture.detectChanges();
    const link = fixture.nativeElement.querySelector(
      'a[href="/dashboard/interludes?season=halloween"]',
    );
    expect(link?.textContent).toContain('Contenido de Halloween');
  });
  it.each([false, true])(
    'does not expose the seasonal admin shortcut for an unauthorized user (theme=%s)',
    (enabled) => {
      seasonal.enabled.set(enabled);
      user.set({ id: 2, username: 'Editor', rol: { id: 2, name: 'Editor', description: '' } });
      const fixture = TestBed.createComponent(DashboardLayoutComponent);
      fixture.detectChanges();
      expect(
        fixture.nativeElement.querySelector('a[href="/dashboard/interludes?season=halloween"]'),
      ).toBeNull();
    },
  );
  it('hides the shortcut when the Halloween theme is turned off', () => {
    seasonal.enabled.set(false);
    const fixture = TestBed.createComponent(DashboardLayoutComponent);
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('a[href="/dashboard/interludes?season=halloween"]'),
    ).toBeNull();
  });
});
