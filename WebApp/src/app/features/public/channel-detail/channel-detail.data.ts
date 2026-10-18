/** Mock data for "Web · Detalle de canal" and "Móvil · Detalle de canal". */
export interface ChannelEra {
  name: string; years: string; /** Flex grow of the era in the timeline. */ w: number; onAir?: boolean;
  desc: string; mobileDesc: string; series: [string, string][];
}

export const CHANNEL_ERAS: ChannelEra[] = [
  { name: 'Inicios', years: '1991–1995', w: 4,
    desc: 'Las primeras caricaturas dobladas llegan en bloques matutinos de fin de semana.',
    mobileDesc: 'Primeras caricaturas dobladas en bloques matutinos.',
    series: [['Los Caballeros del Zodiaco', 'Todas las temporadas'], ['El Chavo del 8', 'T1–T3']] },
  { name: 'Época dorada', years: '1996–2001', w: 6, onAir: true,
    desc: 'El anime toma la tarde después de la escuela. Cortes de 2 a 4 anuncios y los bumpers de «Ya viene» que todos recuerdan.',
    mobileDesc: 'Anime después de la escuela y los bumpers de «Ya viene». Al aire ahora.',
    series: [['Dragon Ball Z', 'T2–T3'], ['Los Simpson', 'Todas'], ['Hey Arnold!', 'T1–T2'], ['Pokémon', 'T1–T3'], ['Los Caballeros del Zodiaco', 'Todas']] },
  { name: 'Era digital', years: '2002–2007', w: 6,
    desc: 'Cambio de imagen del canal y bumpers en 3D.',
    mobileDesc: 'Cambio de imagen y bumpers en 3D.',
    series: [['Digimon Adventure', 'T1'], ['Pokémon', 'T4–T6']] },
  { name: 'Revival', years: '2008 –', w: 3,
    desc: 'Repeticiones y especiales de aniversario.',
    mobileDesc: 'Repeticiones y especiales de aniversario.',
    series: [['Dragon Ball Z', 'Especiales']] },
];

export const UPCOMING = [
  { time: '14:15', title: 'Dragon Ball Z', sub: 'T2 · E14 · ahora', color: '#FF8A80' },
  { time: '14:39', title: 'Pokémon', sub: 'T3 · E02', color: '#ECE8DC' },
  { time: '15:03', title: 'Digimon: La película', sub: 'Especial', color: '#ECE8DC' },
  { time: '16:32', title: 'Los Caballeros del Zodiaco', sub: 'T1 · E31', color: '#ECE8DC' },
];

export const CHANNEL_COMMENTS = [
  { user: 'lucia', time: 'hace 48 min', body: 'Los bumpers de Ya viene están idénticos a los de la tele de antes.' },
  { user: 'maria.g', time: 'ayer', body: '¿Van a agregar la era de los 2000?' },
];
