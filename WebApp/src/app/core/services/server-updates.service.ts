import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ServerUpdateStatus {
  currentCommit: string;
  release: { version: string; commit: string; url: string } | null;
  available: boolean;
  agentConnected: boolean;
  state: string;
  message: string | null;
}

@Injectable({ providedIn: 'root' })
export class ServerUpdatesService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/api/v1/server/updates`;
  readonly status = signal<ServerUpdateStatus | null>(null);
  readonly loading = signal(false);
  readonly requesting = signal(false);
  readonly requested = signal(false);
  readonly error = signal('');

  refresh(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    this.http.get<ServerUpdateStatus>(this.url, { withCredentials: true }).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: status => this.status.set(status),
      error: () => this.error.set('No se pudo consultar la actualización. La emisión no se ha interrumpido.'),
    });
  }

  request(): void {
    if (this.requesting() || this.requested() || !this.status()?.agentConnected || !this.status()?.available) return;
    this.requesting.set(true);
    this.error.set('');
    this.http.post(this.url, {}, { withCredentials: true }).pipe(finalize(() => this.requesting.set(false))).subscribe({
      next: () => this.requested.set(true),
      error: () => this.error.set('No se pudo solicitar la actualización. Consulta el estado y vuelve a intentarlo.'),
    });
  }
}
