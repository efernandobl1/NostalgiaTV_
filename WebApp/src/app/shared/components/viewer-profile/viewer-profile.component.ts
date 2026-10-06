import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WatchedService } from '../../../core/services/watched.service';
import { SeasonalThemeService } from '../../../core/services/seasonal-theme.service';

@Component({
  selector: 'app-viewer-profile', imports: [FormsModule, DatePipe],
  templateUrl: './viewer-profile.component.html', styleUrl: './viewer-profile.component.scss',
})
export class ViewerProfileComponent {
  readonly watched = inject(WatchedService);
  readonly theme = inject(SeasonalThemeService);
  readonly busy = signal(false);
  readonly message = signal('');
  readonly error = signal('');
  readonly code = signal<{ code: string; expiresAtUtc: string } | null>(null);
  name = 'Mi dispositivo';
  enteredCode = '';
  connect(): void {
    if (this.busy()) return;
    this.busy.set(true); this.error.set('');
    this.watched.connect(this.name).subscribe({ next: () => this.busy.set(false), error: () => { this.busy.set(false); this.error.set('No se pudo crear el perfil. Reintenta.'); } });
  }
  generate(): void {
    if (this.busy()) return;
    this.busy.set(true); this.error.set('');
    this.watched.createCode().subscribe({ next: code => { this.busy.set(false); this.code.set(code); }, error: () => { this.busy.set(false); this.error.set('No se pudo generar el código. Espera un minuto y reintenta.'); } });
  }
  pair(): void {
    if (this.busy() || !this.enteredCode.trim()) return;
    this.busy.set(true); this.error.set(''); this.message.set('');
    this.watched.pair(this.enteredCode).subscribe({ next: () => { this.busy.set(false); this.enteredCode = ''; this.message.set('Dispositivo vinculado. El historial se actualizará también en la otra pantalla.'); }, error: () => { this.busy.set(false); this.error.set('Código inválido, usado o expirado. Genera otro en la pantalla que deseas vincular.'); } });
  }
  unlink(id: string): void {
    if (this.busy() || !confirm('Este dispositivo dejará de compartir el historial. ¿Desvincularlo?')) return;
    this.busy.set(true); this.error.set('');
    this.watched.unlink(id).subscribe({ next: () => this.busy.set(false), error: () => { this.busy.set(false); this.error.set('No se pudo desvincular el dispositivo.'); } });
  }
}
