/** Mock channel catalog shared by admin and public screens (no backend yet). */
export interface ChannelRef { id: number; code: string; num: string; name: string; era: string }

export const CHANNELS: ChannelRef[] = [
  { id: 5, code: 'CH 05', num: '05', name: 'Canal 5 Retro', era: 'Época dorada 1996–2001' },
  { id: 12, code: 'CH 12', num: '12', name: 'Cartoon Clásico', era: 'Fines de los 90' },
  { id: 23, code: 'CH 23', num: '23', name: 'Anime 90s', era: 'Tardes de anime' },
  { id: 31, code: 'CH 31', num: '31', name: 'Tarde de Sábado', era: 'Sábados 2003' },
  { id: 40, code: 'CH 40', num: '40', name: 'Noche Retro', era: 'Sin era seleccionada' },
];

/** Segment colors used by schedule bars and legends. */
export const SEG_COLORS = { ep: '#FFB547', ad: '#6FD0EA', bump: '#B8A6FF' } as const;
