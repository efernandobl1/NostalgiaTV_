import { Component, DestroyRef, inject, input } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { interval } from 'rxjs';
import { ServerUpdatesService } from '../../../core/services/server-updates.service';

@Component({
  selector: 'app-server-update',
  imports: [RouterLink],
  template: `
    @if (compact()) {
      @if (updates.status()?.available) {
        <a class="update-notice" routerLink="/dashboard/settings">
          <span class="material-symbols-outlined" aria-hidden="true">system_update</span>
          Nueva versión {{ updates.status()?.release?.version }}. Revisar actualización
        </a>
      }
    } @else {
      <section class="update-panel" aria-labelledby="server-update-heading">
        <h2 id="server-update-heading">Versión del servidor</h2>
        @if (updates.status(); as status) {
          <p>{{ status.release ? (status.available ? 'Disponible: ' + status.release.version : 'No hay una versión nueva disponible.') : 'La información de versiones aún no está disponible.' }}</p>
          @if (!status.agentConnected) {
            <p>Actualizador sin conexión. Instala o activa el agente en el servidor para actualizar desde aquí.</p>
          }
          @if (status.message) { <p role="status">{{ status.message }}</p> }
          @if (status.release) {
            <a [href]="status.release.url" target="_blank" rel="noopener">Ver cambios de la versión</a>
          }
          @if (status.available && status.agentConnected && !updates.requested()) {
            <details><summary>Actualizar el servidor</summary>
              <p>Se hará un respaldo antes de migrar. La reproducción se interrumpirá durante la actualización.</p>
              <button class="admin-button admin-button--primary" type="button"
                [disabled]="updates.requesting() || status.state === 'updating'" (click)="updates.request()">
                {{ updates.requesting() ? 'Solicitando…' : 'Crear respaldo y actualizar' }}
              </button>
            </details>
          }
        } @else if (updates.loading()) { <p role="status">Consultando versión…</p> }
        @if (updates.requested()) { <p role="status">Actualización solicitada. El agente la iniciará en su próxima comprobación, en unos minutos.</p> }
        @if (updates.error()) { <p role="alert">{{ updates.error() }}</p> }
        <button class="admin-button admin-button--secondary" type="button" [disabled]="updates.loading()" (click)="updates.refresh()">Comprobar ahora</button>
      </section>
    }
  `,
  styles: `
    :host { display: block; min-width: 0; }
    .update-notice { display: flex; align-items: center; gap: 12px; padding: 14px 18px; margin-block-end: 24px; color: var(--dashboard-yellow); border: 1px solid var(--dashboard-border); border-radius: 6px; overflow-wrap: anywhere; }
    .update-panel { margin-block: 24px; padding: 24px; border: 1px solid var(--dashboard-border); border-radius: 6px; color: var(--dashboard-text); background: var(--dashboard-surface); }
    h2 { margin-block: 0 16px; color: var(--dashboard-text); font: 400 28px/1.2 VT323, monospace; }
    p { max-width: 70ch; line-height: 1.6; color: var(--dashboard-muted); }
    a, summary { color: var(--dashboard-yellow); }
    summary { padding-block: 14px; cursor: pointer; }
    button { min-height: 44px; margin-block-start: 12px; padding: 10px 16px; border: 1px solid var(--dashboard-control-border); border-radius: 4px; background: var(--dashboard-bg); color: var(--dashboard-text); font: inherit; cursor: pointer; }
    button.admin-button--primary { background: var(--dashboard-green); color: var(--dashboard-bg); }
    button:disabled { cursor: not-allowed; opacity: .6; }
    a:focus-visible, summary:focus-visible, button:focus-visible { outline: 2px solid var(--dashboard-green); outline-offset: 4px; }
    @media (max-width: 650px) { .update-panel { padding: 16px; } }
  `,
})
export class ServerUpdateComponent {
  readonly compact = input(false);
  readonly updates = inject(ServerUpdatesService);
  private readonly destroyRef = inject(DestroyRef);
  constructor() {
    this.updates.refresh();
    interval(5 * 60 * 1000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.updates.refresh());
  }
}
