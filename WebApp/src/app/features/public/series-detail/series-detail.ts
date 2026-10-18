import { Component, computed, effect, inject, input, numberAttribute, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api, errorMessage, mediaUrl } from '../../../core/api/api';
import { PublicComment, PublicEpisode, PublicSeriesDetail } from '../../../core/api/models';
import { ago, channelNumber, episodeCode, playTime, years } from '../../../core/data/public-data';
import { Session } from '../../../core/session';
import { ProgressBar } from '../../../shared/ui/progress-bar';
import { copyLink } from '../../../shared/utils/share';

interface EpisodeView { id: number; num: string; title: string; pct: number; state: string; stateColor: string; meta: string }
interface CommentView { id: number; ini: string; user: string; time: string; body: string; reply: boolean }

/** Design: "Web · Detalle de serie" + "Móvil · Serie". */
@Component({
  selector: 'app-series-detail',
  imports: [RouterLink, ProgressBar],
  host: { class: 'flex-1 flex flex-col' },
  templateUrl: './series-detail.html',
})
export class SeriesDetail {
  private readonly api = inject(Api);
  protected readonly session = inject(Session);

  /** Route param `:id`. */
  readonly id = input(0, { transform: numberAttribute });
  readonly detail = signal<PublicSeriesDetail | null>(null);
  readonly allEpisodes = signal<PublicEpisode[]>([]);
  readonly rawComments = signal<PublicComment[]>([]);
  readonly commentTotal = signal(0);
  readonly error = signal('');
  readonly notice = signal('');
  readonly replyTo = signal<CommentView | null>(null);

  readonly series = computed(() => {
    const d = this.detail();
    return {
      id: d?.id ?? 0, name: d?.name ?? '', synopsis: d?.description ?? '', tags: d?.categories ?? [], logo: mediaUrl(d?.logoPath),
      years: years(d?.startDate, d?.endDate), rating: d?.rating?.toFixed(1) ?? '—', seasons: (d?.seasons ?? []).filter(s => s > 0).length,
    };
  });
  readonly channel = computed(() => {
    const on = this.detail()?.onAir[0];
    return on ? { id: on.channelId, code: `CH ${channelNumber(on.channelId)}`, name: on.channelName } : null;
  });

  /** Season numbers in display order: specials (0) first. */
  readonly seasonNumbers = computed(() => [...new Set(this.allEpisodes().map(e => e.seasonNumber))].sort((a, b) => (a === 0 ? -1 : b === 0 ? 1 : a - b)));
  readonly seasons = computed(() => this.seasonNumbers().map(n => (n === 0 ? 'Especiales' : `T${n}`)));
  readonly season = signal(0);

  private readonly progress = computed(() => new Map((this.session.viewer()?.progress ?? []).map(p => [p.episodeId, p])));

  readonly episodes = computed<EpisodeView[]>(() => {
    const number = this.seasonNumbers()[this.season()];
    return this.allEpisodes().filter(e => e.seasonNumber === number).map(e => {
      const p = this.progress().get(e.id);
      const done = p?.completed ?? false;
      const started = !done && (p?.currentSecond ?? 0) > 0;
      return {
        id: e.id, num: e.seasonNumber === 0 ? e.episodeType.toUpperCase() : `E${e.episodeNumber}`, title: e.title, pct: done ? 100 : 0,
        state: done ? '✓ VISTO' : started ? `EN CURSO · ${playTime(p!.currentSecond)}` : '',
        stateColor: done ? '#8BE08F' : started ? '#FFB547' : '#A29E91',
        meta: episodeCode(e.seasonNumber, e.episodeNumber, e.episodeType),
      };
    });
  });

  /** Episode to continue: the one in progress, else the first unwatched regular episode. */
  readonly resume = computed(() => {
    const list = this.allEpisodes();
    const progress = this.progress();
    const episode = list.find(e => { const p = progress.get(e.id); return p && !p.completed && p.currentSecond > 0; })
      ?? list.find(e => !progress.get(e.id)?.completed && e.seasonNumber > 0) ?? list[0];
    if (!episode) return null;
    const started = (progress.get(episode.id)?.currentSecond ?? 0) > 0 && !progress.get(episode.id)?.completed;
    return { id: episode.id, label: `${started ? 'Continuar' : 'Reproducir'} ${episodeCode(episode.seasonNumber, episode.episodeNumber, episode.episodeType)}` };
  });

  readonly comments = computed<CommentView[]>(() => {
    const list = this.rawComments();
    const roots = list.filter(c => !c.parentCommentId);
    const view = (c: PublicComment, reply: boolean): CommentView => ({
      id: c.id, ini: c.author.slice(0, 2).toUpperCase(), user: c.author, time: ago(c.createdAtUtc), body: c.body, reply,
    });
    return roots.flatMap(root => [view(root, false), ...list.filter(c => c.parentCommentId === root.id).map(c => view(c, true))]);
  });
  readonly commentCount = computed(() => this.commentTotal());
  readonly draft = signal('');

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => this.load(id));
    });
  }

  private async load(id: number): Promise<void> {
    if (!id) return;
    this.error.set('');
    try {
      const [detail, episodes] = await Promise.all([this.api.seriesDetail(id), this.api.episodes(id)]);
      this.detail.set(detail);
      this.allEpisodes.set(episodes);
      const resume = this.resume();
      const start = resume ? episodes.find(e => e.id === resume.id)?.seasonNumber : undefined;
      const index = this.seasonNumbers().indexOf(start ?? this.seasonNumbers().find(n => n > 0) ?? 0);
      this.season.set(Math.max(0, index));
      this.loadComments(id);
    } catch (error) {
      this.error.set(errorMessage(error, 'No se pudo cargar la serie.'));
    }
  }

  private async loadComments(id: number): Promise<void> {
    try {
      const page = await this.api.seriesComments(id);
      this.rawComments.set(page.items);
      this.commentTotal.set(page.totalCount);
    } catch { /* comments are optional */ }
  }

  async publish(): Promise<void> {
    const body = this.draft().trim();
    if (!body) return;
    try {
      await this.api.postSeriesComment(this.series().id, body, this.replyTo()?.id);
      this.draft.set('');
      this.replyTo.set(null);
      this.notice.set('Gracias. Tu comentario aparecerá cuando un moderador lo apruebe.');
    } catch (error) {
      this.notice.set(errorMessage(error, 'No se pudo publicar el comentario.'));
    }
  }

  share(): void { copyLink(`/series/${this.series().id}`); }
}
