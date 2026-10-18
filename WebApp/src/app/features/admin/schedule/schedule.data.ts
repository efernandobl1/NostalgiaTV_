import { SEG_COLORS as C } from '../../../core/data/channels';

export interface Seg { w: number; color: string }
const seg = (k: keyof typeof C, w: number): Seg => ({ w, color: C[k] });
const std = [seg('ep', 7), seg('bump', 0.3), seg('ad', 0.5), seg('ad', 0.5), seg('bump', 0.3), seg('ep', 7), seg('bump', 0.3), seg('ad', 0.5), seg('ad', 0.5), seg('ad', 0.5), seg('bump', 0.3), seg('ep', 7)];

export const PROGRAMS = [
  { start: '13:00', end: '13:24', title: 'Los Simpson', code: 'T05 · E21', type: 'Episodio', live: false, segs: std },
  { start: '13:24', end: '13:48', title: 'Hey Arnold!', code: 'T02 · E03', type: 'Episodio', live: false, segs: std },
  { start: '14:15', end: '14:39', title: 'Dragon Ball Z', code: 'T02 · E14', type: 'Episodio', live: true, segs: std },
  { start: '14:39', end: '15:03', title: 'Pokémon', code: 'T03 · E02', type: 'Episodio', live: false, segs: std },
  { start: '15:03', end: '16:32', title: 'Digimon: La película', code: 'ESPECIAL', type: 'Película', live: false, segs: [seg('ep', 20), seg('bump', 0.3), seg('ad', 0.6), seg('ad', 0.6), seg('bump', 0.3), seg('ep', 20), seg('bump', 0.3), seg('ad', 0.6), seg('bump', 0.3), seg('ep', 20)] },
  { start: '16:32', end: '16:56', title: 'Los Caballeros del Zodiaco', code: 'T01 · E31', type: 'Episodio', live: false, segs: std },
  { start: '16:56', end: '17:20', title: 'El Chavo del 8', code: 'T03 · E11', type: 'Episodio', live: false, segs: std },
  { start: '17:20', end: '17:44', title: 'Dragon Ball Z', code: 'T02 · E15', type: 'Episodio', live: false, segs: std },
];

export const segRows = (start: string) => [
  { at: start + ':00', kind: 'EPISODIO', color: C.ep, content: 'Bloque 1', range: '00:00 → 07:12' },
  { at: '+07:12', kind: 'BUMPER', color: C.bump, content: 'Ya viene · Canal 5', range: '0:05' },
  { at: '+07:17', kind: 'ANUNCIO', color: C.ad, content: 'Anuncio cereal (1998)', range: '0:30' },
  { at: '+07:47', kind: 'ANUNCIO', color: C.ad, content: 'Anuncio juguete (1997)', range: '0:30' },
  { at: '+08:17', kind: 'BUMPER', color: C.bump, content: 'Continuamos con', range: '0:05' },
  { at: '+08:22', kind: 'EPISODIO', color: C.ep, content: 'Bloque 2', range: '07:12 → 14:30' },
  { at: '+15:40', kind: 'CORTE', color: C.ad, content: '3 anuncios · 1:30', range: '—' },
];

export const RULES = [
  { label: 'Ventana sin repetir', value: '24 h' },
  { label: 'Especiales por día', value: '2 · máx 1 por serie' },
  { label: 'Películas por día', value: '1 · máx 1 por serie' },
  { label: 'Anuncios por corte (era)', value: '2 – 4' },
  { label: 'Duración máx. de corte', value: '180 s' },
];
