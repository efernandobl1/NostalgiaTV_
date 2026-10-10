import { Component, DestroyRef, Input, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { finalize } from 'rxjs';
import { toDataURL } from 'qrcode';
import { DeviceAccessService, DeviceConfirmation } from './device-access.service';
import { WatchedService } from '../../../core/services/watched.service';

@Component({
  selector: 'app-devices', imports: [FormsModule, DatePipe],
  templateUrl: './devices.component.html', styleUrl: './devices.component.scss',
})
export class DevicesComponent {
  @Input() tvOnly = false;
  private readonly access = inject(DeviceAccessService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly watched = inject(WatchedService);
  readonly busy = signal(false);
  readonly confirmation = signal<DeviceConfirmation | null>(null);
  readonly qr = signal<string | null>(null);
  readonly expires = signal<string | null>(null);
  readonly error = signal('');
  readonly message = signal('');
  readonly server = window.location.origin;
  private expiryTimer?: ReturnType<typeof setTimeout>;
  code = this.route.snapshot.queryParamMap.get('code') ?? '';

  constructor() {
    this.destroyRef.onDestroy(() => this.hideQr());
    if (this.code) this.inspect();
  }

  inspect(): void {
    if (this.busy() || !this.code.trim()) return;
    this.busy.set(true); this.error.set(''); this.message.set(''); this.confirmation.set(null);
    this.access.inspect(this.code.trim()).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.busy.set(false))).subscribe({
      next: device => this.confirmation.set(device),
      error: error => this.error.set(error.status === 429 ? 'Espera un minuto antes de volver a comprobar.' : 'El código no existe, ya se usó o expiró. Genera otro en tu TV.'),
    });
  }

  approve(): void {
    if (this.busy() || !this.confirmation()) return;
    this.busy.set(true); this.error.set('');
    this.access.approve(this.code.trim()).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.busy.set(false))).subscribe({
      next: () => { this.confirmation.set(null); this.code = ''; this.message.set('Pantalla autorizada. La app se conectará automáticamente.'); this.connectBrowser(); },
      error: () => { this.confirmation.set(null); this.error.set('No se pudo autorizar. Comprueba el código de tu pantalla nuevamente.'); },
    });
  }

  generateQr(): void {
    if (this.busy()) return;
    this.busy.set(true); this.error.set(''); this.message.set(''); this.hideQr();
    this.access.createQr().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ticket => {
        void toDataURL(JSON.stringify({ type: 'nostalgiatv-device', version: 1, server: this.server, deviceCode: ticket.deviceCode }),
          { width: 320, margin: 4, errorCorrectionLevel: 'M' }).then(image => {
            if (this.destroyRef.destroyed) return;
            this.qr.set(image); this.expires.set(ticket.expiresAtUtc); this.busy.set(false);
            this.expiryTimer = setTimeout(() => { this.hideQr(); this.message.set('El QR expiró. Genera otro para conectar tu celular.'); },
              Math.max(0, Date.parse(ticket.expiresAtUtc) - Date.now()));
            this.connectBrowser();
          }).catch(() => { this.busy.set(false); this.error.set('No se pudo crear el QR. Vuelve a intentarlo.'); });
      },
      error: error => { this.busy.set(false); this.error.set(error.status === 429 ? 'Espera un minuto antes de generar otro QR.' : 'No se pudo crear el QR. Comprueba tu conexión.'); },
    });
  }
  private connectBrowser(): void {
    this.watched.connect('Navegador').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      error: () => this.error.set('El dispositivo fue autorizado, pero no se pudo sincronizar este navegador. Vuelve a abrir tu perfil.'),
    });
  }
  hideQr(): void { clearTimeout(this.expiryTimer); this.qr.set(null); this.expires.set(null); }
}
