import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { Api, mediaUrl } from '../api/api';
import { CategoryFacet, GuideSlot, NowPlaying, ProgressItem, PublicChannelCard, PublicSettings } from '../api/models';
import { Session } from '../session';
import { ChannelEvents, debounce } from './channel-events';

// ── Formatting shared by the public, TV and admin screens ──

export function hhmm(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function minutesBetween(from: string, to: string): number {
  return Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000));
}

/** "T2 · E14" ("T2 · E5A" for part A of a split episode); specials and movies show their type, season 0 is "Especial". */
export function episodeCode(season: number | null | undefined, episode: number | null | undefined, type?: string | null, part?: string | null): string {
  if (type && type !== 'Episodio') return part ? `${type} ${part}` : type;
  if (season == null || episode == null) return '';
  return season === 0 ? 'Especial' : `T${season} · E${episode}${part ?? ''}`;
}

export function years(start: number | string | null | undefined, end: number | string | null | undefined): string {
  const from = typeof start === 'string' ? start.slice(0, 4) : start;
  const to = typeof end === 'string' ? end.slice(0, 4) : end;
  if (!from) return '';
  if (!to) return `${from} –`;
  return String(from) === String(to) ? String(from) : `${from}–${to}`;
}

export function channelNumber(id: number): string { return String(id).padStart(2, '0'); }

export function ago(iso: string | null | undefined): string {
  if (!iso) return '';
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'ahora';
  if (minutes < 60) return `hace ${minutes} min`;
  if (minutes < 1440) return `hace ${Math.round(minutes / 60)} h`;
  if (minutes < 2880) return 'ayer';
  if (minutes < 10080) return `hace ${Math.round(minutes / 1440)} días`;
  return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short' });
}

export function playTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Fraction (0–100) of the slot already aired. */
export function airedPct(startsAtUtc: string, endsAtUtc: string, now = Date.now()): number {
  const start = new Date(startsAtUtc).getTime();
  const end = new Date(endsAtUtc).getTime();
  return end > start ? Math.min(100, Math.max(0, Math.round((now - start) * 100 / (end - start)))) : 0;
}

export function nowTitle(now: NowPlaying | null | undefined): string {
  return now ? now.seriesName ?? now.title : 'Fuera del aire';
}

export function slotLine(slot: GuideSlot): string {
  return [episodeCode(slot.seasonNumber, slot.episodeNumber, slot.episodeType, slot.episodePart), slot.title !== slot.seriesName ? slot.title : '']
    .filter(Boolean).join(' · ');
}

/** View model of a channel card (home, live chips, TV). */
export interface LiveChannel {
  id: number; num: string; name: string; era: string; now: string; next: string; pct: number;
  tags: string[]; on: boolean; badge: string; badgeInk: string; badgeBg: string; logo: string | null;
  code: string; endsAt: string; card: PublicChannelCard;
}

export function toLiveChannel(card: PublicChannelCard): LiveChannel {
  const on = card.now !== null;
  return {
    id: card.id, num: channelNumber(card.id), name: card.name, era: card.eraName ?? 'Sin era seleccionada',
    now: nowTitle(card.now), next: card.next ? `${card.next.seriesName} ${hhmm(card.next.startsAtUtc)}` : '—',
    pct: card.now ? Math.round(card.now.progress * 100) : 0, tags: card.categories, on,
    badge: on ? '● EN VIVO' : 'SIN SEÑAL', badgeInk: on ? '#1A0906' : '#ECE8DC', badgeBg: on ? '#FF6B5E' : '#3A3A33',
    logo: mediaUrl(card.logoPath), code: card.now ? episodeCode(card.now.seasonNumber, card.now.episodeNumber, null, card.now.episodePart) : '',
    endsAt: card.now ? hhmm(card.now.endsAtUtc) : '', card,
  };
}

/** Episodes in progress, one per series, newest first ("Continuar viendo"). */
export interface ContinueItem { seriesId: number; series: string; code: string; pct: number; episodeId: number }

export function continueWatching(progress: ProgressItem[]): ContinueItem[] {
  const seen = new Set<number>();
  return [...progress].filter(p => !p.completed && p.currentSecond > 0)
    .sort((a, b) => b.updatedAtUtc.localeCompare(a.updatedAtUtc))
    .filter(p => !seen.has(p.seriesId) && seen.add(p.seriesId))
    .map(p => ({ seriesId: p.seriesId, series: p.seriesName, episodeId: p.episodeId,
      code: `${episodeCode(p.seasonNumber, p.episodeNumber, null, p.episodePart)} · en ${playTime(p.currentSecond)}`, pct: 0 }));
}

/**
 * Episode to play after `currentId` in random mode (0 for "Aleatorio" on the series page): any other playable
 * episode of the series, preferring the ones the viewer has not finished.
 */
export function randomEpisode<T extends { id: number; filePath: string }>(
  episodes: readonly T[], currentId: number, finished: ReadonlySet<number>, random = Math.random): T | null {
  const others = episodes.filter(e => e.id !== currentId && !!e.filePath);
  const unseen = others.filter(e => !finished.has(e.id));
  const pool = unseen.length ? unseen : others;
  return pool.length ? pool[Math.floor(random() * pool.length)] : null;
}

type EpisodeProgress = Pick<ProgressItem, 'currentSecond' | 'completed'>;

/**
 * Episode a series' "Continuar / Reproducir" button opens: the one in progress, else the first unwatched
 * regular episode, else the first one. `started` tells "Continuar" from "Reproducir".
 */
export function resumeEpisode<T extends { id: number; seasonNumber: number }>(
  episodes: readonly T[], progress: ReadonlyMap<number, EpisodeProgress>): { episode: T; started: boolean } | null {
  const inProgress = (e: T) => { const p = progress.get(e.id); return !!p && !p.completed && p.currentSecond > 0; };
  const started = episodes.find(inProgress);
  const episode = started ?? episodes.find(e => !progress.get(e.id)?.completed && e.seasonNumber > 0) ?? episodes[0];
  return episode ? { episode, started: !!started } : null;
}

/**
 * Calendar day (yyyy-MM-dd) `offset` days from today. The guide endpoint reads the day in the platform's
 * time zone, so pass `timeZone` (public settings) or a viewer in another zone gets the wrong day.
 */
export function dayKey(offset = 0, timeZone?: string | null): string {
  const date = new Date(Date.now() + offset * 86_400_000);
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timeZone || undefined, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  } catch {
    return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  }
}

export type Season = 'none' | 'halloween' | 'christmas';

function seasonOf(settings: PublicSettings): Season {
  return settings.season === 'Halloween' ? 'halloween' : settings.season === 'Christmas' ? 'christmas' : 'none';
}

/** Season whose decorations (site atmosphere, fullscreen glow) are on: "Efectos de temporada" in the platform settings. */
export function seasonalEffects(settings: PublicSettings | null | undefined): Season {
  return settings?.seasonalEffectsEnabled ? seasonOf(settings) : 'none';
}

/**
 * Public channels and categories, shared by every screen. Refreshed when the API hub reports a channel change and,
 * as a fallback, every minute while the app is open.
 */
@Injectable({ providedIn: 'root' })
export class PublicData {
  private readonly api = inject(Api);
  private readonly session = inject(Session);
  private readonly events = inject(ChannelEvents);
  private readonly destroyRef = inject(DestroyRef);
  readonly cards = signal<PublicChannelCard[]>([]);
  readonly categories = signal<CategoryFacet[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly channels = computed(() => this.cards().map(toLiveChannel));
  readonly onAir = computed(() => this.channels().filter(c => c.on));
  readonly season = computed<Season>(() => {
    const settings = this.session.settings();
    return settings?.seasonalThemesEnabled ? seasonOf(settings) : 'none';
  });
  readonly effects = computed(() => seasonalEffects(this.session.settings()));
  private timer: ReturnType<typeof setInterval> | null = null;

  /** Starts loading (idempotent); screens call it from their constructor. */
  use(): void {
    if (this.timer) return;
    this.refresh();
    this.api.categories().then(c => this.categories.set(c)).catch(() => {});
    this.timer = setInterval(() => this.refresh(), 60_000);
    // Breaks change segments in bursts: one refresh per burst.
    this.events.listen(debounce(() => this.refresh(), 1_500), this.destroyRef);
  }

  async refresh(): Promise<void> {
    try {
      this.cards.set(await this.api.channels());
      this.error.set('');
    } catch {
      this.error.set('No se pudieron cargar los canales. Revisa tu conexión.');
    } finally {
      this.loading.set(false);
    }
  }

  channel(id: number): LiveChannel | undefined { return this.channels().find(c => c.id === id); }
}

/** Remembers the last tuned channel for "Volver al último canal". */
export function lastChannel(): number | null {
  try { const value = Number(localStorage.getItem('ntv.lastChannel')); return value > 0 ? value : null; } catch { return null; }
}

export function rememberChannel(id: number): void {
  try { localStorage.setItem('ntv.lastChannel', String(id)); } catch { /* private mode */ }
}

export function injectDestroy(): DestroyRef { return inject(DestroyRef); }
