import { computed, DestroyRef, effect, inject, Signal, signal, untracked } from '@angular/core';
import { Api } from '../api/api';
import { ChannelState, ScheduleProgram } from '../api/models';
import { airedPct, episodeCode, hhmm, LiveChannel, PublicData, rememberChannel } from './public-data';

/** What's on a channel right now, shared by the live player, fullscreen and the TV player. */
export interface OnAir {
  id: number; num: string; name: string; short: string; era: string;
  now: string; nowShort: string; code: string; title: string; detail: string; starts: string; ends: string;
  pct: number; next: string; seriesId: number | null; inBreak: boolean; breakLeft: string;
}

export interface LineupItem { time: string; title: string; sub: string; kind?: 'now' | 'past'; seriesId: number }

function view(channel: LiveChannel | undefined, id: number, state: ChannelState | null, program: ScheduleProgram | undefined, now: number): OnAir {
  const name = channel?.name ?? `Canal ${String(id).padStart(2, '0')}`;
  const episode = state?.kind === 'Episode';
  // During a break the program (not the interlude) is still what's on.
  const series = program?.seriesName ?? state?.seriesName ?? channel?.card.now?.seriesName ?? channel?.now ?? 'Fuera del aire';
  const code = program ? episodeCode(program.seasonNumber, program.episodeNumber, program.episodeType, program.episodePart)
    : state ? episodeCode(state.seasonNumber, state.episodeNumber, null, state.episodePart) : channel?.code ?? '';
  const title = program?.title ?? (episode ? state?.title : '') ?? '';
  const starts = program?.startsAtUtc ?? state?.startsAtUtc ?? channel?.card.now?.startsAtUtc;
  const ends = program?.endsAtUtc ?? state?.endsAtUtc ?? channel?.card.now?.endsAtUtc;
  const left = state ? Math.max(0, Math.round((new Date(state.endsAtUtc).getTime() - now) / 1000)) : 0;
  return {
    id, num: String(id).padStart(2, '0'), name, short: name.split(' ').slice(0, 2).join(' '), era: channel?.era ?? '',
    now: series, nowShort: series, code, title: title && title !== series ? title : '',
    detail: [code, title !== series ? title : ''].filter(Boolean).join(' · '),
    starts: hhmm(starts), ends: hhmm(ends), pct: starts && ends ? airedPct(starts, ends, now) : 0,
    next: state?.nextTitle ?? channel?.next ?? '—', seriesId: program?.seriesId ?? state?.seriesId ?? channel?.card.now?.seriesId ?? null,
    inBreak: !!state && !episode, breakLeft: `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`,
  };
}

/**
 * Channel tuner for a player screen: the channels to zap through, the live view of the tuned one and
 * its lineup. The `<app-video-screen>` reports each new state through `onState`.
 */
export function createTuner(id: Signal<number>) {
  const api = inject(Api);
  const data = inject(PublicData);
  data.use();

  const state = signal<ChannelState | null>(null);
  const programs = signal<ScheduleProgram[]>([]);
  const clock = signal(Date.now());
  const timer = setInterval(() => clock.set(Date.now()), 15_000);
  inject(DestroyRef).onDestroy(() => clearInterval(timer));

  /** Channels on air; the tuned one stays in the list even when the schedule is empty. */
  const channels = computed<OnAir[]>(() => {
    const list = data.onAir().length ? data.onAir() : data.channels();
    const tuned = id();
    const ids = list.some(c => c.id === tuned) || !tuned ? list.map(c => c.id) : [...list.map(c => c.id), tuned];
    return ids.map(channelId => view(data.channel(channelId), channelId, null, undefined, clock()));
  });
  const index = computed(() => Math.max(0, channels().findIndex(c => c.id === id())));
  const current = computed(() => {
    const now = clock();
    const live = state();
    return programs().find(p => new Date(p.startsAtUtc).getTime() <= now && new Date(p.endsAtUtc).getTime() > now)
      ?? programs().find(p => p.episodeId === live?.episodeId);
  });
  const ch = computed(() => {
    const live = state();
    return view(data.channel(id()), id(), live?.channelId === id() ? live : null, current(), clock());
  });
  const lineup = computed<LineupItem[]>(() => {
    const now = clock();
    return programs().map(p => {
      const start = new Date(p.startsAtUtc).getTime();
      const end = new Date(p.endsAtUtc).getTime();
      const kind = start <= now && end > now ? 'now' as const : end <= now ? 'past' as const : undefined;
      const code = episodeCode(p.seasonNumber, p.episodeNumber, p.episodeType, p.episodePart);
      return { time: hhmm(p.startsAtUtc), title: p.seriesName, sub: kind === 'now' ? `${code} · ahora` : code, kind, seriesId: p.seriesId };
    });
  });

  async function loadPrograms(channelId: number): Promise<void> {
    const from = new Date(Date.now() - 60 * 60_000).toISOString();
    const to = new Date(Date.now() + 6 * 60 * 60_000).toISOString();
    try {
      const list = await api.programs(channelId, from, to);
      if (id() === channelId) programs.set(list.slice(0, 12));
    } catch { programs.set([]); }
  }

  effect(() => {
    const channelId = id();
    untracked(() => {
      state.set(null);
      programs.set([]);
      if (!channelId) return;
      rememberChannel(channelId);
      loadPrograms(channelId);
    });
  });

  return {
    channels, index, ch, lineup, state,
    /** Channel id `steps` away from the tuned one, wrapping around. */
    at(position: number): number {
      const list = channels();
      return list.length ? list[(position % list.length + list.length) % list.length].id : id();
    },
    onState(next: ChannelState | null): void {
      const previous = state();
      state.set(next);
      clock.set(Date.now());
      // A new program started: refresh the lineup.
      if (next && (!previous || next.episodeId !== previous.episodeId) && next.kind === 'Episode' && !current()) loadPrograms(next.channelId);
    },
  };
}

export type Tuner = ReturnType<typeof createTuner>;
