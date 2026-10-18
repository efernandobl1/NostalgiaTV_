import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { Api, mediaUrl } from '../api/api';
import { CategoryFacet, GuideSlot, NowPlaying, ProgressItem, PublicChannelCard } from '../api/models';
import { Session } from '../session';

// ── Formatting shared by the public, TV and admin screens ──

export function hhmm(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function minutesBetween(from: string, to: string): number {
  return Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000));
}

/** "T2 · E14"; specials and movies show their type, season 0 is "Especial". */
export function episodeCode(season: number | null | undefined, episode: number | null | undefined, type?: string | null): string {
  if (type && type !== 'Episodio') return type;
  if (season == null || episode == null) return '';
  return season === 0 ? 'Especial' : `T${season} · E${episode}`;
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
  return [episodeCode(slot.seasonNumber, slot.episodeNumber, slot.episodeType), slot.title !== slot.seriesName ? slot.title : '']
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
    logo: mediaUrl(card.logoPath), code: card.now ? episodeCode(card.now.seasonNumber, card.now.episodeNumber) : '',
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
      code: `${episodeCode(p.seasonNumber, p.episodeNumber)} · en ${playTime(p.currentSecond)}`, pct: 0 }));
}

/** Local calendar day (yyyy-MM-dd) as the guide endpoint expects it. */
export function dayKey(offset = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export type Season = 'none' | 'halloween' | 'christmas';

/**
 * Public channels and categories, shared by every screen and refreshed every minute while the app is open.
 */
@Injectable({ providedIn: 'root' })
export class PublicData {
  private readonly api = inject(Api);
  private readonly session = inject(Session);
  readonly cards = signal<PublicChannelCard[]>([]);
  readonly categories = signal<CategoryFacet[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly channels = computed(() => this.cards().map(toLiveChannel));
  readonly onAir = computed(() => this.channels().filter(c => c.on));
  readonly season = computed<Season>(() => {
    const settings = this.session.settings();
    if (!settings?.seasonalThemesEnabled) return 'none';
    return settings.season === 'Halloween' ? 'halloween' : settings.season === 'Christmas' ? 'christmas' : 'none';
  });
  private timer: ReturnType<typeof setInterval> | null = null;

  /** Starts loading (idempotent); screens call it from their constructor. */
  use(): void {
    if (this.timer) return;
    this.refresh();
    this.api.categories().then(c => this.categories.set(c)).catch(() => {});
    this.timer = setInterval(() => this.refresh(), 60_000);
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
