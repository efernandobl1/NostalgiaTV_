/** Mock "what's on now" per channel, shared by the live player and the fullscreen overlay. */
export interface OnAir {
  id: number; num: string; name: string; short: string; era: string;
  now: string; nowShort: string; code: string; title: string; detail: string; ends: string;
  pct: number; next: string; seriesId: number;
}

export const ON_AIR: OnAir[] = [
  { id: 5, num: '05', name: 'Canal 5 Retro', short: 'Canal 5', era: 'Época dorada 1996–2001', now: 'Dragon Ball Z', nowShort: 'Dragon Ball Z',
    code: 'T2 · E14', title: 'El poder oculto de Gohan', detail: 'T2 · E14 · El poder oculto de Gohan', ends: '14:39', pct: 34, next: 'Pokémon · T3 · E02', seriesId: 1 },
  { id: 12, num: '12', name: 'Cartoon Clásico', short: 'Cartoon', era: 'Fines de los 90', now: 'Hey Arnold!', nowShort: 'Hey Arnold!',
    code: 'T1 · E07', title: 'Episodio 7', detail: 'T1 · E07', ends: '14:40', pct: 71, next: 'Los Simpson · T5 · E22', seriesId: 3 },
  { id: 23, num: '23', name: 'Anime 90s', short: 'Anime 90s', era: 'Tardes de anime', now: 'Los Caballeros del Zodiaco', nowShort: 'Caballeros del Zodiaco',
    code: 'T1 · E31', title: 'Episodio 31', detail: 'T1 · E31', ends: '14:36', pct: 12, next: 'Digimon Adventure · T1 · E12', seriesId: 6 },
  { id: 31, num: '31', name: 'Tarde de Sábado', short: 'Sábado', era: 'Sábados 2003', now: 'Digimon: La película', nowShort: 'Digimon: La película',
    code: 'ESPECIAL', title: 'Película', detail: 'Especial', ends: '15:00', pct: 58, next: 'Pokémon · T1 · E05', seriesId: 5 },
];

export function onAirIndex(id: number): number {
  return Math.max(0, ON_AIR.findIndex(c => c.id === id));
}

/** Upcoming list of the current channel (player side panel). */
export const CHANNEL_LINEUP: { time: string; title: string; sub: string; kind?: 'now' | 'past' }[] = [
  { time: '13:48', title: 'Hey Arnold!', sub: 'T2 · E04', kind: 'past' },
  { time: '14:15', title: 'Dragon Ball Z', sub: 'T2 · E14 · ahora', kind: 'now' },
  { time: '14:39', title: 'Pokémon', sub: 'T3 · E02' },
  { time: '15:03', title: 'Digimon: La película', sub: 'Especial' },
  { time: '16:32', title: 'Los Caballeros del Zodiaco', sub: 'T1 · E31' },
  { time: '16:56', title: 'El Chavo del 8', sub: 'T3 · E11' },
  { time: '17:20', title: 'Dragon Ball Z', sub: 'T2 · E15' },
];
