import { Component, computed, signal } from '@angular/core';
import { PageHeader } from '../../../shared/ui/page-header';
import { ConfirmDialog } from '../../../shared/ui/confirm-dialog';
import { InterludeDialog } from './interlude-dialog';

const B = '#B8A6FF', A = '#6FD0EA';
const OK: [string, string] = ['Aprobado', '#8BE08F'], NO: [string, string] = ['Pendiente', '#FFB547'];
const ALL: [string, string, string, string, string, string, [string, string], string][] = [
  ['Ya viene · Canal 5 (1997)', 'BUMPER · YA VIENE', B, 'Todo el año', '0:05', '1996–1999', OK, '—'],
  ['Continuamos con · Canal 5', 'BUMPER · CONTINUAMOS', B, 'Todo el año', '0:04', '1996–1999', OK, '—'],
  ['Ident estrella dorada', 'BUMPER · GENÉRICO', B, 'Todo el año', '0:08', '1998', OK, '—'],
  ['Ya viene · Especial Halloween', 'BUMPER · YA VIENE', B, 'Halloween', '0:06', '2001', NO, '—'],
  ['Anuncio cereal (1998)', 'ANUNCIO', A, 'Todo el año', '0:30', '1998', OK, '—'],
  ['Anuncio juguete (1997)', 'ANUNCIO', A, 'Navidad', '0:30', '1997', OK, '—'],
  ['Anuncio refresco (2000)', 'ANUNCIO', A, 'Todo el año', '0:20', '2000', NO, '—'],
  ['Promo programación sábado', 'ANUNCIO', A, 'Todo el año', '0:15', '2003', OK, 'CC BY 4.0'],
];

@Component({
  selector: 'app-interludes',
  imports: [PageHeader, ConfirmDialog, InterludeDialog],
  host: { class: 'flex flex-col gap-6' },
  templateUrl: './interludes.html',
})
export class Interludes {
  readonly kinds: [string, number][] = [['Todos', 86], ['Bumpers', 34], ['Anuncios', 52]];
  readonly kind = signal(0);
  readonly dlg = signal<'edit' | 'delete' | null>(null);
  readonly rows = computed(() => ALL
    .filter(r => this.kind() === 0 || (this.kind() === 1 ? r[1].startsWith('BUMPER') : r[1] === 'ANUNCIO'))
    .map(([title, kind, color, season, dur, years, ap, license]) => ({ title, kind, color, season, dur, years, approved: ap[0], apColor: ap[1], license })));
}
