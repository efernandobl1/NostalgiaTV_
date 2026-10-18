import { Component, computed, inject, input, numberAttribute, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CHANNEL_LINEUP, ON_AIR, onAirIndex } from '../../../core/data/live';
import { PlayerPrefs } from '../../../core/player-prefs';
import { copyLink } from '../../../shared/utils/share';

interface LiveComment { ini: string; user: string; time: string; body: string; pending?: boolean }

/** Design: "Web · Ver canal en vivo" + "Móvil · En vivo". */
@Component({
  selector: 'app-live',
  imports: [RouterLink],
  host: { class: 'flex-1 flex flex-col' },
  templateUrl: './live.html',
})
export class Live {
  private readonly router = inject(Router);
  protected readonly player = inject(PlayerPrefs);

  /** Route param `:id`. */
  readonly id = input(5, { transform: numberAttribute });
  readonly channels = ON_AIR;
  readonly index = computed(() => onAirIndex(this.id()));
  readonly ch = computed(() => ON_AIR[this.index()]);

  readonly tab = signal(0);
  readonly lineup = CHANNEL_LINEUP;
  readonly mobileLineup = CHANNEL_LINEUP.filter(g => g.kind !== 'past').map(g => ({ ...g, title: g.title.replace('Los Caballeros', 'Caballeros') }));

  readonly draft = signal('');
  readonly comments = signal<LiveComment[]>([
    { ini: 'MA', user: 'maria.g', time: 'hace 5 min', body: 'Los cortes con el bumper de Ya viene son idénticos a como los recuerdo.' },
    { ini: 'JP', user: 'jpablo', time: 'hace 3 min', body: '¿Alguien más llegando de la escuela para ver esto?' },
    { ini: 'LU', user: 'lucia', time: 'hace 1 min', body: 'Ojalá pongan la película completa el sábado.' },
  ]);

  tune(index: number): void {
    const n = ON_AIR.length;
    this.router.navigate(['/ver', ON_AIR[(index + n) % n].id], { replaceUrl: true });
  }

  send(): void {
    const body = this.draft().trim();
    if (!body) return;
    this.comments.update(list => [...list, { ini: 'FE', user: 'fernando', time: 'pendiente de moderación', body, pending: true }]);
    this.draft.set('');
  }

  share(): void { copyLink(`/canal/${this.ch().id}`); }
}
