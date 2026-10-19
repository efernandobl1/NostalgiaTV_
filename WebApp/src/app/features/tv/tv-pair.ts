import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Api } from '../../core/api/api';
import { Session } from '../../core/session';
import { LogoMark } from '../../shared/ui/logo-mark';

/**
 * Design: "Android TV · Vincular dispositivo". Starts a device authorization, shows the user code
 * and polls /viewer/authorization/redeem until a signed-in phone or browser approves it.
 */
@Component({
  selector: 'app-tv-pair',
  imports: [LogoMark],
  host: { class: 'w-full h-full overflow-hidden py-18 px-30 flex flex-col scan-ink-2 [--scan:0.02]' },
  template: `
    <span class="flex items-center gap-3.5">
      <app-logo-mark [size]="48" [dots]="false" />
      <span class="font-display font-bold text-[30px] tracking-[0.08em]">NOSTALGIA TV</span>
    </span>

    <div class="flex-1 flex items-center gap-30">
      <div class="flex-1 flex flex-col gap-10">
        <h1 class="m-0 font-display font-bold text-[72px] leading-[1.05]">Vincula este televisor</h1>
        <ol class="m-0 p-0 list-none flex flex-col gap-6 text-[32px] leading-[1.35]">
          <li class="flex gap-5"><span class="font-display font-bold text-amber">1</span><span>En tu teléfono o computadora abre <strong class="font-mono font-medium text-amber">{{ host }}/vincular</strong></span></li>
          <li class="flex gap-5"><span class="font-display font-bold text-amber">2</span><span>Inicia sesión y escribe este código:</span></li>
        </ol>
        <div class="flex items-center gap-7">
          <span class="py-7 px-11 rounded-[20px] border-[3px] border-amber font-mono font-medium text-[72px] tracking-[0.12em] text-fg bg-panel-2" aria-live="polite">{{ code() || '···-···-···-···' }}</span>
        </div>
        <div class="flex items-center gap-4.5 text-[26px] text-muted" role="status">
          @if (message()) {
            <span class="w-3.5 h-3.5 rounded-full bg-live" aria-hidden="true"></span>
            {{ message() }}
          } @else if (left() > 0) {
            <span class="w-3.5 h-3.5 rounded-full bg-amber shadow-[0_0_0_6px_rgba(255,181,71,0.2)] animate-pulse" aria-hidden="true"></span>
            Esperando confirmación · el código vence en {{ clock() }}
          } @else if (code()) {
            <span class="w-3.5 h-3.5 rounded-full bg-live" aria-hidden="true"></span>
            El código venció · pide uno nuevo
          }
        </div>
      </div>

      <div class="w-105 flex-none flex flex-col items-center gap-6">
        <div class="w-90 p-7 rounded-3xl bg-panel-2 border-2 border-edge flex flex-col gap-3 text-center">
          <span class="text-[22px] text-muted">O abre directamente</span>
          <span class="font-mono text-[22px] text-amber break-all">{{ host }}/vincular?code={{ code() }}</span>
        </div>
        <button class="tv-btn tv-focus h-18 px-9 font-semibold" type="button" data-autofocus (click)="renew()">Obtener otro código</button>
      </div>
    </div>
  `,
})
export class TvPair {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly session = inject(Session);
  readonly host = window.location.host || 'TU-SERVIDOR';
  readonly code = signal('');
  readonly message = signal('');
  readonly left = signal(0);
  readonly clock = computed(() => `${Math.floor(this.left() / 60)}:${String(this.left() % 60).padStart(2, '0')}`);

  private deviceCode = '';
  private interval = 5;
  private poll: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    const id = setInterval(() => this.left.update(s => Math.max(0, s - 1)), 1000);
    inject(DestroyRef).onDestroy(() => { clearInterval(id); this.stop(); });
    this.renew();
  }

  async renew(): Promise<void> {
    this.stop();
    this.message.set('');
    try {
      const start = await this.api.startTvAuthorization('Televisor (web)');
      this.code.set(start.userCode);
      this.deviceCode = start.deviceCode;
      this.interval = Math.max(2, start.intervalSeconds);
      this.left.set(Math.max(0, Math.round((new Date(start.expiresAtUtc).getTime() - Date.now()) / 1000)));
      this.schedule();
    } catch {
      this.code.set('');
      this.message.set('No se pudo pedir un código. Revisa la conexión.');
    }
  }

  private schedule(): void {
    this.poll = setTimeout(() => this.check(), this.interval * 1000);
  }

  private async check(): Promise<void> {
    if (this.left() <= 0) return;
    try {
      // 200 "connected" replaces the viewer cookie; 202 "pending" keeps polling.
      const result = await this.api.redeemTv(this.deviceCode);
      const viewer = result.status === 'connected' ? await this.api.viewerSession().catch(() => null) : null;
      if (viewer) {
        this.session.viewer.set(viewer);
        this.router.navigateByUrl('/tv');
        return;
      }
    } catch (error) {
      const status = error instanceof HttpErrorResponse ? error.status : 0;
      if (status === 429) this.interval += 5;
      else if (status === 410) { this.left.set(0); return; }
      else if (status === 401) { this.message.set('La vinculación fue rechazada. Pide otro código.'); return; }
      else if (status === 409) { this.message.set('Ese perfil ya tiene diez dispositivos. Quita uno desde Mis dispositivos.'); return; }
    }
    this.schedule();
  }

  private stop(): void {
    if (this.poll) clearTimeout(this.poll);
    this.poll = null;
  }
}
