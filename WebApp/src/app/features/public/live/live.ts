import { Component, computed, effect, inject, input, numberAttribute, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Api, errorMessage } from '../../../core/api/api';
import { PublicComment } from '../../../core/api/models';
import { createTuner } from '../../../core/data/live';
import { ago } from '../../../core/data/public-data';
import { PlayerPrefs } from '../../../core/player-prefs';
import { Session } from '../../../core/session';
import { VideoScreen } from '../../../shared/ui/video-screen';
import { copyLink } from '../../../shared/utils/share';

interface LiveComment { ini: string; user: string; time: string; body: string; pending?: boolean }

/** Design: "Web · Ver canal en vivo" + "Móvil · En vivo". */
@Component({
  selector: 'app-live',
  imports: [RouterLink, VideoScreen],
  host: { class: 'flex-1 flex flex-col' },
  templateUrl: './live.html',
})
export class Live {
  private readonly router = inject(Router);
  private readonly api = inject(Api);
  protected readonly session = inject(Session);
  protected readonly player = inject(PlayerPrefs);

  /** Route param `:id`. */
  readonly id = input(0, { transform: numberAttribute });
  readonly tuner = createTuner(this.id);
  readonly channels = this.tuner.channels;
  readonly index = this.tuner.index;
  readonly ch = this.tuner.ch;
  readonly lineup = this.tuner.lineup;
  readonly mobileLineup = computed(() => this.lineup().filter(g => g.kind !== 'past'));
  /** Only one `<video>` plays: the desktop or the mobile one. */
  readonly mobile = signal(typeof matchMedia !== 'undefined' && matchMedia('(max-width: 767.98px)').matches);

  readonly tab = signal(0);
  readonly draft = signal('');
  readonly notice = signal('');
  private readonly published = signal<PublicComment[]>([]);
  private readonly pending = signal<LiveComment[]>([]);
  readonly comments = computed<LiveComment[]>(() => [
    ...this.published().map(c => ({ ini: c.author.slice(0, 2).toUpperCase(), user: c.author, time: ago(c.createdAtUtc), body: c.body })),
    ...this.pending(),
  ]);

  constructor() {
    if (typeof matchMedia !== 'undefined') {
      const query = matchMedia('(max-width: 767.98px)');
      query.addEventListener('change', e => this.mobile.set(e.matches));
    }
    effect(() => {
      const id = this.id();
      untracked(() => {
        this.pending.set([]);
        this.published.set([]);
        if (id) this.api.channelComments(id).then(page => this.published.set([...page.items].reverse())).catch(() => {});
      });
    });
  }

  tune(index: number): void {
    this.router.navigate(['/ver', this.tuner.at(index)], { replaceUrl: true });
  }

  async send(): Promise<void> {
    const body = this.draft().trim();
    if (!body) return;
    try {
      await this.api.postChannelComment(this.id(), body);
      this.pending.update(list => [...list, { ini: this.session.initials(), user: this.session.user(), time: 'pendiente de moderación', body, pending: true }]);
      this.draft.set('');
      this.notice.set('');
    } catch (error) {
      this.notice.set(errorMessage(error, 'No se pudo enviar el comentario.'));
    }
  }

  share(): void { copyLink(`/canal/${this.id()}`); }
}
