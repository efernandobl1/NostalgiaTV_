import {
  afterRenderEffect,
  Component,
  effect,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WatchedService } from '../../../core/services/watched.service';
import { SeasonalThemeService } from '../../../core/services/seasonal-theme.service';

@Component({
  selector: 'app-viewer-profile',
  imports: [FormsModule, DatePipe],
  templateUrl: './viewer-profile.component.html',
  styleUrl: './viewer-profile.component.scss',
})
export class ViewerProfileComponent {
  readonly watched = inject(WatchedService);
  readonly theme = inject(SeasonalThemeService);
  readonly busy = signal(false);
  readonly message = signal('');
  readonly error = signal('');
  readonly code = signal<{ code: string; expiresAtUtc: string } | null>(null);
  readonly pairingMode = signal<'choose' | 'show' | 'enter' | null>(null);
  private readonly pairingTitle = viewChild<ElementRef<HTMLElement>>('pairingTitle');
  private readonly addDeviceButton = viewChild<ElementRef<HTMLButtonElement>>('addDeviceButton');
  private pairingProfileId: string | null = null;
  name = 'Mi dispositivo';
  enteredCode = '';

  constructor() {
    afterRenderEffect(() => (this.pairingTitle() ?? this.addDeviceButton())?.nativeElement.focus());
    effect(() => {
      const profileId = this.watched.session()?.profileId;
      if (
        this.pairingMode() === 'show' &&
        this.pairingProfileId &&
        profileId &&
        profileId !== this.pairingProfileId
      ) {
        this.cancelPairing();
        this.message.set('Este dispositivo ya comparte lo visto con tu perfil.');
      }
    });
  }

  startPairing(): void {
    if (this.busy()) return;
    this.error.set('');
    this.message.set('');
    this.pairingMode.set('choose');
  }

  enterPairingCode(): void {
    this.error.set('');
    this.pairingMode.set('enter');
  }

  cancelPairing(): void {
    this.pairingMode.set(null);
    this.code.set(null);
    this.pairingProfileId = null;
    this.enteredCode = '';
    this.error.set('');
  }

  connect(): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.watched.connect(this.name.trim() || 'Mi dispositivo').subscribe({
      next: () => this.busy.set(false),
      error: () => {
        this.busy.set(false);
        this.error.set('No se pudo activar la sincronización. Reintenta.');
      },
    });
  }
  generate(): void {
    if (this.busy()) return;
    this.pairingMode.set('show');
    this.pairingProfileId = this.watched.session()?.profileId ?? null;
    this.code.set(null);
    this.busy.set(true);
    this.error.set('');
    this.watched.createCode().subscribe({
      next: (code) => {
        this.busy.set(false);
        this.code.set(code);
      },
      error: () => {
        this.busy.set(false);
        this.error.set('No se pudo generar el código. Espera un minuto y reintenta.');
      },
    });
  }
  pair(): void {
    if (this.busy() || !this.enteredCode.trim()) return;
    this.busy.set(true);
    this.error.set('');
    this.message.set('');
    this.watched.pair(this.enteredCode.trim()).subscribe({
      next: () => {
        this.busy.set(false);
        this.cancelPairing();
        this.message.set('Dispositivo vinculado. Lo visto se compartirá entre tus pantallas.');
      },
      error: (error) => {
        this.busy.set(false);
        this.error.set(
          error.status === 409
            ? 'El perfil ya tiene diez dispositivos. Desvincula uno para añadir otro.'
            : 'No se pudo vincular. Revisa la conexión y el código; si caducó, genera otro en la nueva pantalla.',
        );
      },
    });
  }
  unlink(id: string): void {
    if (
      this.busy() ||
      !confirm('Este dispositivo dejará de compartir el historial. ¿Desvincularlo?')
    )
      return;
    this.busy.set(true);
    this.error.set('');
    this.watched.unlink(id).subscribe({
      next: () => this.busy.set(false),
      error: () => {
        this.busy.set(false);
        this.error.set('No se pudo desvincular el dispositivo.');
      },
    });
  }
}
