import { Component, computed, signal } from '@angular/core';
import { PageHeader } from '../../../shared/ui/page-header';
import { ConfirmDialog } from '../../../shared/ui/confirm-dialog';
import { CHANNELS } from '../../../core/data/channels';
import { ChannelDialog } from './channel-dialog';
import { EraDialog } from './era-dialog';
import { EraSeriesDialog } from './era-series-dialog';
import { EraInterludeDialog } from './era-interlude-dialog';

type Dlg = 'channel' | 'era' | 'eraSeries' | 'eraInterlude' | 'broadcast' | null;

const ALL = [{ label: 'Todas', ink: '#ECE8DC', bg: '#3A3A33' }];
const pick = (...n: number[]) => n.map(x => ({ label: 'T' + x, ink: '#1A1206', bg: '#FFB547' }));

@Component({
  selector: 'app-channels',
  imports: [PageHeader, ConfirmDialog, ChannelDialog, EraDialog, EraSeriesDialog, EraInterludeDialog],
  host: { class: 'flex flex-col gap-6' },
  templateUrl: './channels.html',
})
export class Channels {
  readonly channels = CHANNELS;
  readonly channel = signal(0);
  readonly eraIndex = signal(1);
  readonly dlg = signal<Dlg>(null);
  readonly mode = signal<'create' | 'edit'>('edit');

  readonly eras = [
    { name: 'Inicios', years: '1991–1995', w: 4, slug: 'inicios', desc: 'Primeras caricaturas dobladas y bloques matutinos.', onAir: false },
    { name: 'Época dorada', years: '1996–2001', w: 6, slug: 'epoca-dorada', desc: 'Auge del anime en la tarde y cortes de 2 a 4 anuncios.', onAir: true },
    { name: 'Era digital', years: '2002–2007', w: 6, slug: 'era-digital', desc: 'Cambio de imagen del canal y bumpers en 3D.', onAir: false },
    { name: 'Revival', years: '2008 –', w: 3, slug: 'revival', desc: 'Repeticiones y especiales de aniversario.', onAir: false },
  ];
  readonly era = computed(() => this.eras[this.eraIndex()]);

  readonly eraSeries = [
    { name: 'Dragon Ball Z', seasons: pick(2, 3), interludes: '2 bumpers' },
    { name: 'Los Simpson', seasons: ALL, interludes: '—' },
    { name: 'Hey Arnold!', seasons: pick(1, 2), interludes: '1 bumper' },
    { name: 'Pokémon', seasons: pick(1, 2, 3), interludes: '3 bumpers' },
    { name: 'Los Caballeros del Zodiaco', seasons: ALL, interludes: '—' },
  ];
  readonly eraInterludes = [
    { kind: 'YA VIENE', color: '#B8A6FF', title: 'Ya viene · Canal 5 (1997)', weight: 3, gap: '15 min' },
    { kind: 'CONTINUAMOS', color: '#B8A6FF', title: 'Continuamos con · Canal 5', weight: 3, gap: '15 min' },
    { kind: 'GENÉRICO', color: '#B8A6FF', title: 'Ident estrella dorada', weight: 1, gap: '30 min' },
    { kind: 'ANUNCIO', color: '#6FD0EA', title: 'Anuncio cereal (1998)', weight: 2, gap: '45 min' },
    { kind: 'ANUNCIO', color: '#6FD0EA', title: 'Anuncio juguete (1997)', weight: 2, gap: '45 min' },
  ];

  open(dlg: Dlg, mode: 'create' | 'edit' = 'edit'): void {
    this.mode.set(mode);
    this.dlg.set(dlg);
  }
}
