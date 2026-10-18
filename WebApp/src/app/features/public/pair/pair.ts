import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Device, DEVICE_RECT, Devices } from '../../../core/devices';
import { Session } from '../../../core/session';
import { ConfirmDialog } from '../../../shared/ui/confirm-dialog';

/** Formats free text as the TV pairing code `XXXX-XXXX`. */
export function formatPairCode(raw: string): string {
  const chars = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  return chars.length > 4 ? `${chars.slice(0, 4)}-${chars.slice(4)}` : chars;
}

/** Design: "Web · Vincular TV y dispositivos" + "Móvil · Vincular TV". */
@Component({
  selector: 'app-pair',
  imports: [RouterLink, ConfirmDialog],
  host: { class: 'flex-1 flex flex-col' },
  templateUrl: './pair.html',
})
export class Pair {
  protected readonly session = inject(Session);
  protected readonly devices = inject(Devices);
  readonly rect = DEVICE_RECT;

  readonly code = signal('K7Q2-M9XD');
  readonly name = signal('TV de la sala');
  readonly linkedName = signal('');
  readonly done = signal(false);
  readonly touched = signal(false);
  readonly valid = computed(() => /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(this.code()));
  readonly removing = signal<Device | null>(null);

  onCode(input: HTMLInputElement): void {
    const formatted = formatPairCode(input.value);
    input.value = formatted;
    this.code.set(formatted);
  }

  link(): void {
    this.touched.set(true);
    if (!this.valid()) return;
    this.linkedName.set(this.name().trim() || 'Televisor');
    this.devices.link(this.linkedName());
    this.done.set(true);
  }

  reset(): void {
    this.done.set(false);
    this.touched.set(false);
    this.code.set('');
  }
}
