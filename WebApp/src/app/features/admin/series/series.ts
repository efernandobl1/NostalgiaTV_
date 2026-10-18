import { Component, computed, signal } from '@angular/core';
import { PageHeader } from '../../../shared/ui/page-header';
import { ConfirmDialog } from '../../../shared/ui/confirm-dialog';
import { BreakpointDialog, EpisodeDialog, ImportDialog, SeasonDialog, SeriesDialog } from './series-dialogs';

type Dlg = 'series' | 'episode' | 'season' | 'breakpoint' | 'import' | 'confirm' | null;
interface Confirm { heading: string; message: string; label: string }

const SERIES: [string, string, number, string, boolean][] = [
  ['Dragon Ball Z', '1989–1996', 9, '291 / 291 archivos', false],
  ['Los Simpson', '1989 –', 12, '262 / 270 archivos', true],
  ['Hey Arnold!', '1996–2004', 5, '100 / 100 archivos', false],
  ['Pokémon', '1997 –', 4, '210 / 228 archivos', true],
  ['Digimon Adventure', '1999–2000', 1, '54 / 54 archivos', false],
  ['Los Caballeros del Zodiaco', '1986–1989', 5, '114 / 114 archivos', false],
];

const EPISODES: [string, string, string, string, boolean, number[]][] = [
  ['E13', 'La llegada de Freezer', 'Episodio', 'dbz_t2_e13.mp4', true, [32, 66]],
  ['E14', 'El poder oculto de Gohan', 'Episodio', 'dbz_t2_e14.mp4', true, [33, 67]],
  ['E15', 'Vegeta contra Zarbon', 'Episodio', 'dbz_t2_e15.mp4', true, [31, 64]],
  ['E16', 'Las esferas de Namek', 'Episodio', 'sin archivo', false, []],
  ['E17', 'Resumen de la saga', 'Relleno', 'dbz_t2_e17.mp4', true, [50]],
  ['OP', 'Opening 1', 'Opening', 'dbz_op1.mp4', true, []],
  ['ED', 'Ending 1', 'Ending', 'dbz_ed1.mp4', true, []],
];

@Component({
  selector: 'app-series',
  imports: [PageHeader, ConfirmDialog, SeriesDialog, EpisodeDialog, SeasonDialog, BreakpointDialog, ImportDialog],
  host: { class: 'flex flex-col gap-6' },
  templateUrl: './series.html',
})
export class Series {
  readonly cats = ['Todas', 'Anime', 'Caricatura', 'Comedia', 'Live action'];
  readonly seasons = ['T0 · Especiales', 'T1', 'T2', 'T3', 'T4'];
  readonly series = SERIES.map(([name, years, seasons, files, warn]) => ({ name, years, seasons, files, warn }));
  readonly episodes = EPISODES.map(([num, title, type, file, ok, marks]) => ({ num, title, type, file, ok, marks }));
  readonly extIds = [
    { provider: 'TMDB', id: '12971', run: 'Última importación: completada · es-MX · 12 oct', color: '#8BE08F' },
    { provider: 'TheTVDB', id: '81472', run: 'Última importación: fallida · 03 oct', color: '#FF6B5E' },
  ];

  readonly cat = signal(0);
  readonly seriesIndex = signal(0);
  readonly season = signal(2);
  readonly epIndex = signal(1);
  readonly dlg = signal<Dlg>(null);
  readonly mode = signal<'create' | 'edit'>('edit');
  readonly confirm = signal<Confirm>({ heading: '', message: '', label: '' });

  readonly ep = computed(() => this.episodes[this.epIndex()]);
  readonly bps = computed(() => this.ep().marks.map((pct, i) => ({ pct, at: i === 0 ? '07:12.400' : '14:30.000', label: i === 0 ? 'Corte A' : 'Corte B' })));

  open(dlg: Dlg, mode: 'create' | 'edit' = 'edit'): void { this.mode.set(mode); this.dlg.set(dlg); }

  editEpisode(i: number): void { this.epIndex.set(i); this.open('episode'); }

  removeEpisode(i: number): void {
    const e = this.episodes[i];
    this.confirm.set({
      heading: `¿Eliminar ${e.num} · ${e.title}?`,
      message: 'Se quitará de la programación futura y se borrarán sus puntos de corte. El archivo de video no se elimina.',
      label: 'Eliminar episodio',
    });
    this.dlg.set('confirm');
  }

  deleteSeries(): void {
    this.confirm.set({
      heading: '¿Eliminar la serie Dragon Ball Z?',
      message: 'Se ocultará del catálogo y de todas las eras donde está asignada. Los archivos en disco no se borran.',
      label: 'Eliminar serie',
    });
    this.dlg.set('confirm');
  }
}
