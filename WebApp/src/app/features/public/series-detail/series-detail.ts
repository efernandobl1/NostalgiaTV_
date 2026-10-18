import { Component, computed, input, numberAttribute, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CHANNELS } from '../../../core/data/channels';
import { seriesById } from '../../../core/data/series';
import { ProgressBar } from '../../../shared/ui/progress-bar';
import { copyLink } from '../../../shared/utils/share';

interface SeriesComment { ini: string; user: string; time: string; body: string; reply?: boolean }

const EPISODES: [string, string, number][] = [
  ['E12', 'La batalla en Namek comienza', 100], ['E13', 'La llegada de Freezer', 100],
  ['E14', 'El poder oculto de Gohan', 64], ['E15', 'Vegeta contra Zarbon', 0],
  ['E16', 'Las esferas de Namek', 0], ['E17', 'Resumen de la saga', 0],
];

/** Design: "Web · Detalle de serie" + "Móvil · Serie". */
@Component({
  selector: 'app-series-detail',
  imports: [RouterLink, ProgressBar],
  host: { class: 'flex-1 flex flex-col' },
  templateUrl: './series-detail.html',
})
export class SeriesDetail {
  /** Route param `:id`. */
  readonly id = input(1, { transform: numberAttribute });
  readonly series = computed(() => seriesById(this.id()));
  readonly channel = computed(() => CHANNELS.find(c => c.num === this.series().ch) ?? CHANNELS[0]);

  readonly seasons = ['Especiales', 'T1', 'T2', 'T3', 'T4'];
  readonly season = signal(2);
  readonly episodes = EPISODES.map(([num, title, pct]) => ({
    num, title, pct,
    state: pct >= 100 ? '✓ VISTO' : pct > 0 ? `EN CURSO ${pct}%` : '',
    stateColor: pct >= 100 ? '#8BE08F' : pct > 0 ? '#FFB547' : '#A29E91',
  }));

  readonly draft = signal('');
  readonly comments = signal<SeriesComment[]>([
    { ini: 'MA', user: 'maria.g', time: 'hace 2 h', body: 'Me encanta que pusieran la saga de Namek completa, así la veía de niña después de la escuela.' },
    { ini: 'JP', user: 'jpablo', time: 'hace 1 h', body: 'Igual yo. Falta el episodio 16 pero lo demás está perfecto.', reply: true },
    { ini: 'LU', user: 'lucia', time: 'ayer', body: '¿Van a agregar las películas como especiales?' },
  ]);
  readonly commentCount = computed(() => 45 + this.comments().length);

  publish(): void {
    const body = this.draft().trim();
    if (!body) return;
    this.comments.update(list => [{ ini: 'FE', user: 'fernando', time: 'ahora', body }, ...list]);
    this.draft.set('');
  }

  share(): void { copyLink(`/series/${this.series().id}`); }
}
