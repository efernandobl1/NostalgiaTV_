import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { TvModeService } from '../../../../core/services/tv-mode.service';

@Component({
  selector: 'app-logout',
  imports: [RouterLink],
  templateUrl: './logout.component.html',
  styleUrl: './logout.component.scss',
})
export class LogoutComponent implements OnInit {
  readonly tvMode = inject(TvModeService);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  pending = false;
  failed = false;

  ngOnInit() {
    this.logout();
  }

  logout(): void {
    if (this.pending) return;
    this.pending = true;
    this.failed = false;
    this.authService
      .logout()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.pending = false;
          localStorage.removeItem('rememberMe');
          sessionStorage.removeItem('sessionActive');
          this.authService.isAuthenticated.set(false);
        },
        error: () => {
          this.pending = false;
          this.failed = true;
        },
      });
  }
}
