/** Mock data for "Web · Canales (página de inicio)" and "Móvil · Canales (inicio)". */
export interface LiveChannel {
  id: number; num: string; name: string; era: string; now: string; next: string; pct: number;
  tags: string[]; on: boolean; badge: string; badgeInk: string; badgeBg: string;
}

const LIVE = { badge: '● EN VIVO', badgeInk: '#1A0906', badgeBg: '#FF6B5E', on: true };

export const LIVE_CHANNELS: LiveChannel[] = [
  { ...LIVE, id: 5, num: '05', name: 'Canal 5 Retro', era: 'Época dorada 1996–2001', now: 'Dragon Ball Z', next: 'Pokémon 14:39', pct: 34, tags: ['Anime', 'Caricatura'] },
  { ...LIVE, id: 12, num: '12', name: 'Cartoon Clásico', era: 'Fines de los 90', now: 'Hey Arnold!', next: 'Los Simpson 14:40', pct: 71, tags: ['Caricatura', 'Comedia'] },
  { ...LIVE, id: 23, num: '23', name: 'Anime 90s', era: 'Tardes de anime', now: 'Los Caballeros del Zodiaco', next: 'Digimon 14:36', pct: 12, tags: ['Anime'] },
  { ...LIVE, id: 31, num: '31', name: 'Tarde de Sábado', era: 'Sábados 2003', now: 'Digimon: La película', next: 'Pokémon 15:00', pct: 58, tags: ['Anime', 'Caricatura'] },
  { id: 40, num: '40', name: 'Noche Retro', era: 'Sin era seleccionada', now: 'Fuera del aire', next: '—', pct: 0, tags: ['Live action', 'Comedia'], on: false, badge: 'SIN SEÑAL', badgeInk: '#ECE8DC', badgeBg: '#3A3A33' },
];

export const CATEGORIES = ['Todos', 'Anime', 'Caricatura', 'Comedia', 'Live action'];

/** Mobile filter chips: index 1 is "Al aire", the rest map to categories. */
export const MOBILE_FILTERS = ['Todos', 'Al aire', 'Anime', 'Caricaturas', 'Comedia'];

export const CONTINUE_WATCHING = [
  { series: 'Dragon Ball Z', code: 'T2 · E14 · quedan 8 min', pct: 64 },
  { series: 'Pokémon', code: 'T3 · E01 · quedan 17 min', pct: 21 },
  { series: 'Hey Arnold!', code: 'T1 · E08 · nuevo', pct: 0 },
  { series: 'Los Simpson', code: 'T5 · E21 · nuevo', pct: 0 },
];

export type Season = 'none' | 'halloween' | 'christmas';

/** Seasonal banner presets; the design previews Halloween. */
export const SEASONS: Record<Season, { accent: string; bg?: string; ink?: string; tag?: string; text?: string }> = {
  none: { accent: '#FFB547' },
  halloween: { accent: '#FF9A3D', bg: '#2A1A0C', ink: '#FFC48A', tag: 'ESPECIAL DE HALLOWEEN', text: 'Del 17 al 31 de octubre: episodios de terror y bumpers de época en todos los canales.' },
  christmas: { accent: '#8BE08F', bg: '#132216', ink: '#B9F0BC', tag: 'TEMPORADA NAVIDEÑA', text: 'Especiales navideños y anuncios de diciembre hasta el 6 de enero.' },
};
