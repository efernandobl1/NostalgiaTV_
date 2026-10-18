import { Component, computed, signal } from '@angular/core';
import { PageHeader } from '../../../shared/ui/page-header';
import { ConfirmDialog } from '../../../shared/ui/confirm-dialog';

const PROFILES: [string, string, string, number][] = [
  ['FE', 'fernando', '3b1f…92c0', 3],
  ['MA', 'maria.g', '8d02…1a4e', 2],
  ['AN', 'Anónimo', 'c47a…e011', 1],
  ['JP', 'jpablo', '1e9b…77d3', 1],
  ['AN', 'Anónimo', '5f60…0b2a', 1],
  ['LU', 'lucia', 'a2c8…4f19', 2],
];

@Component({
  selector: 'app-viewers',
  imports: [PageHeader, ConfirmDialog],
  host: { class: 'flex flex-col gap-6' },
  templateUrl: './viewers.html',
})
export class Viewers {
  readonly profiles = PROFILES.map(([initials, name, id, devices]) => ({ initials, name, id, devices }));
  readonly profile = signal(0);
  readonly sel = computed(() => this.profiles[this.profile()]);
  /** null = closed, '' = revoke all, otherwise the device name. */
  readonly revoking = signal<string | null>(null);
  readonly revokeHeading = computed(() => this.revoking()
    ? `¿Revocar «${this.revoking()}»?`
    : `¿Revocar todos los dispositivos de ${this.sel().name}?`);

  readonly kpis = [
    { label: 'PERFILES', value: '148', note: '112 con cuenta · 36 anónimos' },
    { label: 'DISPOSITIVOS ACTIVOS', value: '203', note: 'Vistos en las últimas 24 h: 61' },
    { label: 'CÓDIGOS DE VINCULACIÓN', value: '4', note: 'Pendientes de confirmar' },
    { label: 'EPISODIOS COMPLETADOS', value: '2 917', note: 'Últimos 30 días' },
  ];
  readonly devices = [
    { name: 'Smart TV sala', seen: 'hace 3 min', expires: '16 nov', color: '#8BE08F' },
    { name: 'Laptop', seen: 'hace 2 días', expires: '02 nov', color: '#A29E91' },
    { name: 'Teléfono', seen: 'hace 9 días', expires: '25 oct', color: '#A29E91' },
  ];
  readonly progress = [
    { series: 'Dragon Ball Z', code: 'T02 · E14', state: 'EN CURSO 64%', color: '#FFB547', ranges: [{ from: 0, w: 48 }, { from: 52, w: 12 }] },
    { series: 'Hey Arnold!', code: 'T01 · E07', state: 'COMPLETADO', color: '#8BE08F', ranges: [{ from: 0, w: 100 }] },
    { series: 'Pokémon', code: 'T03 · E01', state: 'EN CURSO 21%', color: '#FFB547', ranges: [{ from: 0, w: 21 }] },
    { series: 'Los Simpson', code: 'T05 · E20', state: 'COMPLETADO', color: '#8BE08F', ranges: [{ from: 0, w: 100 }] },
  ];
  readonly pending = [
    { name: 'TV dormitorio', kind: 'Autorización por código', exp: '8 min' },
    { name: 'Consola sala', kind: 'Código de vinculación', exp: '3 min' },
  ];
}
