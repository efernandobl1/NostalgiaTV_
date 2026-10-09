import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { normalizeServerAddress, ServerConnectionsService } from '../../core/services/server-connections.service';

@Component({
  selector: 'app-server-connect', imports: [FormsModule, RouterLink],
  templateUrl: './server-connect.component.html', styleUrl: './server-connect.component.scss',
})
export class ServerConnectComponent {
  readonly servers = inject(ServerConnectionsService);
  readonly destination = signal('');
  readonly error = signal('');
  address = '';
  inspect(): void {
    this.destination.set('');
    this.error.set('');
    try { this.destination.set(normalizeServerAddress(this.address)); }
    catch (error) { this.error.set((error as Error).message); }
  }
}
