import { Component, computed, signal } from '@angular/core';
import { PageHeader } from '../../../shared/ui/page-header';

const STATUS: [string, string][] = [['PENDIENTE', '#FFB547'], ['APROBADO', '#8BE08F'], ['RECHAZADO', '#FF8A80'], ['OCULTO', '#A29E91']];
const BASE = [
  { id: 1, user: 'maria.g', target: 'SERIE · Dragon Ball Z', isSeries: true, replyTo: '', time: 'hace 2 h', body: 'Me encanta que pusieran la saga de Namek completa, así la veía de niña después de la escuela.' },
  { id: 2, user: 'jpablo', target: 'SERIE · Dragon Ball Z', isSeries: true, replyTo: 'maria.g', time: 'hace 1 h', body: 'Igual yo, falta el episodio 16 de la temporada 2 pero lo demás está perfecto.' },
  { id: 3, user: 'lucia', target: 'CANAL · Canal 5 Retro', isSeries: false, replyTo: '', time: 'hace 48 min', body: 'Los bumpers de Ya viene están idénticos a los de la tele de antes, qué nostalgia.' },
  { id: 4, user: 'fernando', target: 'CANAL · Anime 90s', isSeries: false, replyTo: '', time: 'hace 30 min', body: 'Podrían agregar más cortes comerciales en la tarde para que se sienta más real.' },
  { id: 5, user: 'invitado_77', target: 'SERIE · Pokémon', isSeries: true, replyTo: '', time: 'hace 12 min', body: '¿Van a subir la temporada 4 con el doblaje original?' },
];

/** Moderation queue. Actions move a comment out of the current tab (mock, no backend). */
@Component({
  selector: 'app-comments',
  imports: [PageHeader],
  host: { class: 'flex flex-col gap-6' },
  templateUrl: './comments.html',
})
export class Comments {
  readonly labels = ['Pendientes', 'Aprobados', 'Rechazados', 'Ocultos'];
  readonly counts = signal([12, 340, 18, 5]);
  readonly tab = signal(0);
  /** comment id -> tab it was moved to, per source tab. */
  readonly moved = signal<Record<string, number>>({});
  readonly status = computed(() => STATUS[this.tab()]);
  readonly items = computed(() => BASE.filter(c => this.moved()[this.tab() + ':' + c.id] === undefined));
  readonly selected = signal<Set<number>>(new Set());

  move(id: number, to: number): void {
    const from = this.tab();
    if (from === to) return;
    this.moved.update(m => ({ ...m, [from + ':' + id]: to }));
    this.counts.update(c => c.map((n, i) => (i === from ? n - 1 : i === to ? n + 1 : n)));
  }

  toggle(id: number): void {
    this.selected.update(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  approveSelected(): void {
    for (const id of this.selected()) this.move(id, 1);
    this.selected.set(new Set());
  }
}
