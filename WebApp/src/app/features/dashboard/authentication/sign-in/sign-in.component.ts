import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs';
import { RouterLink, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../../core/services/auth.service';
import { TvModeService } from '../../../../core/services/tv-mode.service';

@Component({
  selector: 'app-sign-in',
  imports: [RouterLink, ReactiveFormsModule],
  templateUrl: './sign-in.component.html',
  styleUrl: './sign-in.component.scss',
})
export class SignInComponent {
  readonly tvMode = inject(TvModeService);
  private readonly destroyRef = inject(DestroyRef);
  hide = true;
  authForm: FormGroup;
  errorMessage = '';
  submitting = false;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private authService: AuthService,
  ) {
    this.authForm = this.fb.group({
      username: ['', Validators.required],
      password: ['', [Validators.required, Validators.minLength(8)]],
      rememberMe: [false],
    });

    if (authService.isAuthenticated()) this.router.navigate(['/dashboard']);
  }

  onSubmit() {
    if (this.submitting) return;
    this.authForm.markAllAsTouched();
    if (this.authForm.invalid) return;
    this.errorMessage = '';
    this.submitting = true;
    const { rememberMe, ...credentials } = this.authForm.value;
    this.authService
      .login(credentials)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => (this.submitting = false)),
      )
      .subscribe({
        next: () => {
          if (rememberMe) {
            localStorage.setItem('rememberMe', 'true');
            sessionStorage.removeItem('sessionActive');
          } else {
            localStorage.removeItem('rememberMe');
            sessionStorage.setItem('sessionActive', 'true');
          }
          this.authService.isAuthenticated.set(true);
          this.router.navigate(['/dashboard']);
        },
        error: (error: HttpErrorResponse) => {
          this.errorMessage =
            error.status === 401 || error.status === 400
              ? 'Usuario o contraseña incorrectos. Revisa los datos e intenta otra vez.'
              : error.status === 429
                ? 'Hubo demasiados intentos. Espera un momento antes de volver a entrar.'
                : 'No pudimos conectar con el panel. Intenta nuevamente en un momento.';
        },
      });
  }
}
