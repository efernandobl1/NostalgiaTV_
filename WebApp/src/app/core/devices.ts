import { computed, Injectable, signal } from '@angular/core';

export type DeviceKind = 'tv' | 'laptop' | 'phone';
export interface Device { id: number; kind: DeviceKind; name: string; platform: string; seen: string; current?: boolean }

/** Mock linked devices of the signed-in viewer (pair page + profile). */
@Injectable({ providedIn: 'root' })
export class Devices {
  private nextId = 4;
  readonly list = signal<Device[]>([
    { id: 1, kind: 'tv', name: 'Smart TV sala', platform: 'Android TV', seen: 'hace 3 min' },
    { id: 2, kind: 'laptop', name: 'Laptop', platform: 'Navegador', seen: 'hace 2 días' },
    { id: 3, kind: 'phone', name: 'Teléfono', platform: 'Android', seen: 'hace 9 días', current: true },
  ]);
  readonly count = computed(() => this.list().length);

  link(name: string): void {
    this.list.update(l => [{ id: this.nextId++, kind: 'tv', name: name.trim() || 'Televisor', platform: 'Android TV', seen: 'ahora' }, ...l]);
  }

  remove(id: number): void {
    this.list.update(l => l.filter(d => d.id !== id));
  }
}

/** Icon rectangle per device kind (24×24 viewBox). */
export const DEVICE_RECT: Record<DeviceKind, { x: number; y: number; w: number; h: number }> = {
  tv: { x: 2, y: 5, w: 20, h: 13 },
  laptop: { x: 4, y: 5, w: 16, h: 11 },
  phone: { x: 7, y: 3, w: 10, h: 18 },
};
