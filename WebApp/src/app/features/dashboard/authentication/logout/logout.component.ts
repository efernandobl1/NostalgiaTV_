import { Component, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink, Router } from '@angular/router';
import { CustomizerSettingsService } from '../../../../shared/components/customizer-settings/customizer-settings.service';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-logout',
  imports: [RouterLink, MatButtonModule],
  templateUrl: './logout.component.html',
  styleUrl: './logout.component.scss',
})
export class LogoutComponent implements OnInit {
  constructor(
    public themeService: CustomizerSettingsService,
    private authService: AuthService,
    private router: Router,
  ) {}

  ngOnInit() {
    this.authService.logout().subscribe({
      next: () => {
        localStorage.removeItem('rememberMe');
        sessionStorage.removeItem('sessionActive');
        this.authService.isAuthenticated.set(false);
      },
      error: () => {
        localStorage.removeItem('rememberMe');
        sessionStorage.removeItem('sessionActive');
        this.authService.isAuthenticated.set(false);
      },
    });
  }
}
