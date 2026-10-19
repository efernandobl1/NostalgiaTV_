import { Season } from '../../../core/data/public-data';

/** Seasonal banner presets (the platform settings choose the season). */
export const SEASONS: Record<Season, { accent: string; bg?: string; ink?: string; tag?: string; text?: string; short?: string }> = {
  none: { accent: '#FFB547' },
  halloween: { accent: '#FF9A3D', bg: '#2A1A0C', ink: '#FFC48A', tag: 'ESPECIAL DE HALLOWEEN', text: 'Durante octubre: episodios de terror y bumpers de época en todos los canales.', short: 'Especiales de terror hasta el 31' },
  christmas: { accent: '#8BE08F', bg: '#132216', ink: '#B9F0BC', tag: 'TEMPORADA NAVIDEÑA', text: 'Durante diciembre: especiales navideños y anuncios de época.', short: 'Especiales navideños todo diciembre' },
};
