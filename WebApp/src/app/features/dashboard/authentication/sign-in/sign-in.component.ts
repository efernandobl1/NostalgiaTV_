import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs';
import { ActivatedRoute, RouterLink, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../../core/services/auth.service';
import { TvModeService } from '../../../../core/services/tv-mode.service';
import { ServerConnectionsService } from '../../../../core/services/server-connections.service';

@Component({
  selector: 'app-sign-in',
  imports: [RouterLink, ReactiveFormsModule],
  templateUrl: './sign-in.component.html',
  styleUrl: './sign-in.component.scss',
})
export class SignInComponent {
  readonly tvMode = inject(TvModeService);
  readonly servers = inject(ServerConnectionsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
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

    if (authService.isAuthenticated()) this.openDashboard();
    else if (localStorage.getItem('rememberMe') === 'true') {
      this.submitting = true;
      authService
        .checkSession()
        .pipe(
          takeUntilDestroyed(this.destroyRef),
          finalize(() => (this.submitting = false)),
        )
        .subscribe({
          next: () => this.openDashboard(),
          error: (error: HttpErrorResponse) => {
            if (error.status === 401 || error.status === 403) localStorage.removeItem('rememberMe');
            else
              this.errorMessage =
                'No pudimos recuperar la sesión. Comprueba tu conexión e intenta nuevamente.';
          },
        });
    }
  }

  onSubmit() {
    if (this.submitting) return;
    this.authForm.markAllAsTouched();
    if (this.authForm.invalid) return;
    this.errorMessage = '';
    this.submitting = true;
    const credentials = this.authForm.getRawValue();
    const { rememberMe } = credentials;
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
          this.openDashboard();
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

  private openDashboard(): void {
    const destination = this.route.snapshot.queryParamMap.get('returnUrl') ?? '';
    if (destination.length <= 1024 && /^\/dashboard\/devices(?:\?[^#\\]*)?$/.test(destination))
      void this.router.navigateByUrl(destination);
    else void this.router.navigate(['/dashboard']);
  }
}
