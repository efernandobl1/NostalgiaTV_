import { seriesById, seriesIdByName } from '../core/data/series';
import { passwordScore } from '../features/auth/password';
import { formatPairCode } from '../features/public/pair/pair';
import { sectionOf } from '../layouts/public/public-section';

describe('TV pairing code', () => {
  it('formats free text as XXXX-XXXX', () => {
    expect(formatPairCode('k7q2m9xd')).toBe('K7Q2-M9XD');
    expect(formatPairCode('ab 12-c')).toBe('AB12-C');
    expect(formatPairCode('abc')).toBe('ABC');
    expect(formatPairCode('k7q2m9xd99')).toBe('K7Q2-M9XD');
  });
});

describe('password policy', () => {
  it('scores one point per rule', () => {
    expect(passwordScore('')).toBe(0);
    expect(passwordScore('retro')).toBe(0);
    expect(passwordScore('Retro96')).toBe(2);
    expect(passwordScore('Nostalgia96!')).toBe(4);
  });
});

describe('public navigation section', () => {
  it('maps each URL to its tab', () => {
    expect(sectionOf('/')).toBe('channels');
    expect(sectionOf('/canal/5')).toBe('channels');
    expect(sectionOf('/ver/12?x=1')).toBe('channels');
    expect(sectionOf('/guia')).toBe('guide');
    expect(sectionOf('/series/3')).toBe('series');
    expect(sectionOf('/perfil')).toBe('pair');
    expect(sectionOf('/vincular#top')).toBe('pair');
  });
});

describe('series lookup', () => {
  it('finds series by id and by shortened names', () => {
    expect(seriesById(4).name).toBe('Pokémon');
    expect(seriesById(999).id).toBe(1);
    expect(seriesIdByName('Caballeros')).toBe(6);
    expect(seriesIdByName('Maratón Hey Arnold!')).toBe(3);
    expect(seriesIdByName('Digimon: La película')).toBe(5);
    expect(seriesIdByName('Fuera del aire')).toBeNull();
  });
});
