import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api, errorMessage } from '../../../core/api/api';
import { ViewerDevice } from '../../../core/api/models';
import { ago } from '../../../core/data/public-data';
import { Session } from '../../../core/session';
import { ConfirmDialog } from '../../../shared/ui/confirm-dialog';

export type DeviceKind = 'tv' | 'laptop' | 'phone';

/** Icon rectangle per device kind (24×24 viewBox). */
export const DEVICE_RECT: Record<DeviceKind, { x: number; y: number; w: number; h: number }> = {
  tv: { x: 2, y: 5, w: 20, h: 13 },
  laptop: { x: 4, y: 5, w: 16, h: 11 },
  phone: { x: 7, y: 3, w: 10, h: 18 },
};

export interface DeviceView { id: string; kind: DeviceKind; name: string; platform: string; seen: string; current: boolean }

/** Device names come from the client ("Android TV", "Chrome en Windows", "Teléfono Android"…). */
export function toDeviceView(device: ViewerDevice): DeviceView {
  const name = device.name;
  const kind: DeviceKind = /tv|televisor/i.test(name) ? 'tv' : /tel[eé]fono|phone|android|iphone|m[oó]vil/i.test(name) ? 'phone' : 'laptop';
  const platform = kind === 'tv' ? 'Televisor' : kind === 'phone' ? 'Teléfono' : 'Navegador';
  return { id: device.id, kind, name, platform, seen: device.current ? 'ahora' : ago(device.lastSeenUtc), current: device.current };
}

/** Formats free text as the TV sign-in code `XXX-XXX-XXX-XXX`. */
export function formatPairCode(raw: string): string {
  const chars = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  return chars.match(/.{1,3}/g)?.join('-') ?? '';
}

/** Design: "Web · Vincular TV y dispositivos" + "Móvil · Vincular TV". Approves the code a TV shows. */
@Component({
  selector: 'app-pair',
  imports: [RouterLink, ConfirmDialog],
  host: { class: 'flex-1 flex flex-col' },
  templateUrl: './pair.html',
})
export class Pair {
  private readonly api = inject(Api);
  protected readonly session = inject(Session);
  readonly rect = DEVICE_RECT;

  /** `?code=` from the TV's QR or the Android app. */
  readonly initialCode = input<string>('', { alias: 'code' });
  readonly code = signal('');
  readonly tvName = signal('');
  readonly linkedName = signal('');
  readonly done = signal(false);
  readonly busy = signal(false);
  readonly touched = signal(false);
  readonly error = signal('');
  readonly valid = computed(() => /^[A-Z0-9]{3}(-[A-Z0-9]{3}){3}$/.test(this.code()));
  readonly removing = signal<DeviceView | null>(null);
  readonly devices = computed(() => (this.session.viewer()?.devices ?? []).map(toDeviceView));
  readonly returnUrl = computed(() => (this.valid() ? `/vincular?code=${this.code()}` : '/vincular'));

  constructor() {
    effect(() => {
      const code = formatPairCode(this.initialCode() ?? '');
      untracked(() => { if (code) { this.code.set(code); this.inspect(); } });
    });
  }

  onCode(input: HTMLInputElement): void {
    const formatted = formatPairCode(input.value);
    input.value = formatted;
    this.code.set(formatted);
    this.error.set('');
    this.tvName.set('');
    if (this.valid()) this.inspect();
  }

  /** Shows the name the TV reported so the viewer knows what they approve. */
  private async inspect(): Promise<void> {
    if (!this.valid() || !this.session.signedIn()) return;
    try {
      this.tvName.set((await this.api.inspectTv(this.code())).name);
    } catch (error) {
      this.error.set(errorMessage(error, 'El código no existe o ya expiró.'));
    }
  }

  async link(): Promise<void> {
    this.touched.set(true);
    if (!this.valid() || this.busy()) return;
    this.busy.set(true);
    try {
      await this.api.approveTv(this.code());
      this.linkedName.set(this.tvName() || 'Televisor');
      this.done.set(true);
      this.error.set('');
      setTimeout(() => this.session.refreshViewer(), 4000);
    } catch (error) {
      this.error.set(errorMessage(error, 'No se pudo vincular. Revisa el código.'));
    } finally {
      this.busy.set(false);
    }
  }

  async remove(device: DeviceView): Promise<void> {
    try {
      await this.api.removeDevice(device.id);
    } catch (error) {
      this.error.set(errorMessage(error, 'No se pudo quitar el dispositivo.'));
    }
    await this.session.refreshViewer();
  }

  reset(): void {
    this.done.set(false);
    this.touched.set(false);
    this.code.set('');
    this.tvName.set('');
  }
}
