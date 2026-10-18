/** Mock data for "Web · Guía de programación" and "Móvil · Guía". */
export type SlotKind = 'now' | 'special' | 'past' | undefined;

export interface GuideSlot { min: number; title: string; sub: string; kind?: SlotKind }
export interface GuideRow { id: number; num: string; name: string; short: string; slots: GuideSlot[] }

const s = (min: number, title: string, sub: string, kind?: SlotKind): GuideSlot => ({ min, title, sub, kind });

/** Grid window: 14:00 → 18:00 (240 min); "now" line at 14:32. */
export const GRID_HOURS = ['14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'];
export const NOW_FRACTION = 0.1333;

export const GUIDE_ROWS: GuideRow[] = [
  { id: 5, num: '05', name: 'Canal 5 Retro', short: 'Canal 5', slots: [s(15, 'Hey Arnold!', '13:48'), s(24, 'Dragon Ball Z', 'T2 · E14', 'now'), s(24, 'Pokémon', 'T3 · E02'), s(89, 'Digimon: La película', 'Especial', 'special'), s(24, 'Caballeros', 'T1 · E31'), s(24, 'El Chavo del 8', 'T3 · E11'), s(40, 'Dragon Ball Z', 'T2 · E15')] },
  { id: 12, num: '12', name: 'Cartoon Clásico', short: 'Cartoon', slots: [s(40, 'Hey Arnold!', 'T1 · E07', 'now'), s(24, 'Los Simpson', 'T5 · E22'), s(24, 'Los Simpson', 'T5 · E23'), s(48, 'Hey Arnold!', 'T1 · E08–09'), s(48, 'Los Simpson', 'T6 · E01–02'), s(56, 'Hey Arnold!', 'T1 · E10')] },
  { id: 23, num: '23', name: 'Anime 90s', short: 'Anime 90s', slots: [s(36, 'Caballeros del Zodiaco', 'T1 · E31', 'now'), s(24, 'Digimon Adventure', 'T1 · E12'), s(24, 'Pokémon', 'T1 · E04'), s(48, 'Dragon Ball Z', 'T1 · E01–02'), s(48, 'Digimon Adventure', 'T1 · E13–14'), s(60, 'Caballeros', 'T1 · E32–33')] },
  { id: 31, num: '31', name: 'Tarde de Sábado', short: 'Sábado', slots: [s(62, 'Digimon: La película', 'Especial', 'now'), s(24, 'Pokémon', 'T1 · E05'), s(24, 'Pokémon', 'T1 · E06'), s(130, 'Maratón Hey Arnold!', 'T2 · E01–05')] },
  { id: 40, num: '40', name: 'Noche Retro', short: 'Noche', slots: [s(240, 'Fuera del aire', 'Sin era seleccionada')] },
];

/** Series name fragment → categories, used by the guide's category filter. */
export const TITLE_TAGS: [string, string[]][] = [
  ['Dragon Ball', ['Anime']], ['Pokémon', ['Anime']], ['Digimon', ['Anime']], ['Caballeros', ['Anime']],
  ['Hey Arnold', ['Caricatura', 'Comedia']], ['Simpson', ['Caricatura', 'Comedia']], ['Chavo', ['Comedia']],
];

export interface MobileSlot { time: string; dur: string; title: string; sub: string; kind?: SlotKind }

/** Canal 5 vertical list as drawn in the mobile board. */
export const MOBILE_CH5: MobileSlot[] = [
  { time: '13:24', dur: '24m', title: 'Hey Arnold!', sub: 'T2 · E03', kind: 'past' },
  { time: '13:48', dur: '27m', title: 'Los Simpson', sub: 'T5 · E20', kind: 'past' },
  { time: '14:15', dur: '24m', title: 'Dragon Ball Z', sub: 'T2 · E14 · El poder oculto de Gohan', kind: 'now' },
  { time: '14:39', dur: '24m', title: 'Pokémon', sub: 'T3 · E02' },
  { time: '15:03', dur: '89m', title: 'Digimon: La película', sub: 'Especial', kind: 'special' },
  { time: '16:32', dur: '24m', title: 'Los Caballeros del Zodiaco', sub: 'T1 · E31' },
  { time: '16:56', dur: '24m', title: 'El Chavo del 8', sub: 'T3 · E11' },
  { time: '17:20', dur: '24m', title: 'Dragon Ball Z', sub: 'T2 · E15' },
];
