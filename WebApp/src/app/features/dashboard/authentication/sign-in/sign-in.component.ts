import { Component, HostBinding, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { RouterLink, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CustomizerSettingsService } from '../../../../shared/components/customizer-settings/customizer-settings.service';
import { AuthService } from '../../../../core/services/auth.service';
import { TvModeService } from '../../../../core/services/tv-mode.service';

@Component({
  selector: 'app-sign-in',
  imports: [
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatCheckboxModule,
    ReactiveFormsModule,
  ],
  templateUrl: './sign-in.component.html',
  styleUrl: './sign-in.component.scss',
})
export class SignInComponent {
  readonly tvMode = inject(TvModeService);
  @HostBinding('class.tv-mode') get isTvMode(): boolean { return this.tvMode.enabled(); }
  hide = true;
  authForm: FormGroup;
  errorMessage = '';

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private authService: AuthService,
    public themeService: CustomizerSettingsService,
  ) {
    this.authForm = this.fb.group({
      username: ['', Validators.required],
      password: ['', [Validators.required, Validators.minLength(8)]],
      rememberMe: [false],
    });

    if (authService.isAuthenticated()) this.router.navigate(['/dashboard']);
  }

  onSubmit() {
    if (this.authForm.invalid) return;
    const { rememberMe, ...credentials } = this.authForm.value;
    if (rememberMe) {
        localStorage.setItem('rememberMe', 'true');
    } else {
        localStorage.removeItem('rememberMe');
        sessionStorage.setItem('sessionActive', 'true');
    }
    this.authService.login(credentials).subscribe({
      next: () => {
        this.authService.isAuthenticated.set(true);
        this.router.navigate(['/dashboard']);
      },
      error: () => {
        this.errorMessage = 'Usuario o contraseña incorrectos.';
      },
    });
  }
}
