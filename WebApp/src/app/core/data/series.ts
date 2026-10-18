/** Mock public series catalog (no backend yet). */
export interface SeriesItem {
  id: number; name: string; years: string; decade: number; rating: string;
  tags: string[]; /** Channel number it airs on today ('' = not on air). */ ch: string; /** Watch progress %. */ pct: number;
  seasons: number; synopsis: string;
}

export const SERIES: SeriesItem[] = [
  { id: 1, name: 'Dragon Ball Z', years: '1989–1996', decade: 1980, rating: '8.8', tags: ['Anime', 'Acción', 'Aventura'], ch: '05', pct: 64, seasons: 9,
    synopsis: 'Goku y sus amigos defienden la Tierra de enemigos cada vez más poderosos, desde los Saiyajin hasta Majin Buu.' },
  { id: 2, name: 'Los Simpson', years: '1989 –', decade: 1980, rating: '8.7', tags: ['Caricatura', 'Comedia'], ch: '12', pct: 0, seasons: 35,
    synopsis: 'La vida de una familia de clase media en Springfield.' },
  { id: 3, name: 'Hey Arnold!', years: '1996–2004', decade: 1990, rating: '8.0', tags: ['Caricatura', 'Comedia'], ch: '12', pct: 0, seasons: 5,
    synopsis: 'Arnold y sus amigos crecen en la ciudad de Hillwood.' },
  { id: 4, name: 'Pokémon', years: '1997 –', decade: 1990, rating: '7.6', tags: ['Anime', 'Aventura'], ch: '05', pct: 21, seasons: 25,
    synopsis: 'Ash Ketchum viaja para convertirse en Maestro Pokémon.' },
  { id: 5, name: 'Digimon Adventure', years: '1999–2000', decade: 1990, rating: '8.0', tags: ['Anime', 'Aventura'], ch: '23', pct: 0, seasons: 1,
    synopsis: 'Siete niños son transportados al Digimundo.' },
  { id: 6, name: 'Los Caballeros del Zodiaco', years: '1986–1989', decade: 1980, rating: '8.4', tags: ['Anime', 'Acción'], ch: '23', pct: 0, seasons: 4,
    synopsis: 'Los caballeros de Atena protegen a la diosa con sus armaduras.' },
  { id: 7, name: 'El Chavo del 8', years: '1973–1980', decade: 1970, rating: '8.6', tags: ['Comedia', 'Live action'], ch: '05', pct: 0, seasons: 8,
    synopsis: 'Las aventuras de un niño huérfano en una vecindad.' },
  { id: 8, name: 'Las Tortugas Ninja', years: '1987–1996', decade: 1980, rating: '7.9', tags: ['Caricatura', 'Acción'], ch: '', pct: 0, seasons: 10,
    synopsis: 'Cuatro tortugas mutantes entrenadas en ninjutsu protegen Nueva York.' },
];

export const SERIES_CATEGORIES = ['Anime', 'Caricatura', 'Comedia', 'Acción', 'Aventura', 'Live action'];

export function seriesById(id: number): SeriesItem {
  return SERIES.find(s => s.id === id) ?? SERIES[0];
}

/** Look up a series by (possibly shortened) display name, as used by eras and guide slots. */
export function seriesIdByName(name: string): number | null {
  const head = name.split(/[ :]/)[0];
  return SERIES.find(s => s.name === name || s.name.includes(name) || name.includes(s.name))?.id
    ?? SERIES.find(s => s.name.startsWith(head))?.id ?? null;
}
