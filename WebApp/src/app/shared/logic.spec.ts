import { dayKey, episodeCode, playTime, years } from '../core/data/public-data';
import { passwordScore } from '../features/auth/password';
import { formatPairCode } from '../features/public/pair/pair';
import { sectionOf } from '../layouts/public/public-section';

describe('TV pairing code', () => {
  it('formats free text as XXX-XXX-XXX-XXX', () => {
    expect(formatPairCode('k7q2m9xdab3c')).toBe('K7Q-2M9-XDA-B3C');
    expect(formatPairCode('ab 12-c')).toBe('AB1-2C');
    expect(formatPairCode('abc')).toBe('ABC');
    expect(formatPairCode('k7q2m9xdab3c99')).toBe('K7Q-2M9-XDA-B3C');
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

describe('schedule formatting', () => {
  it('labels episodes, years and play time', () => {
    expect(episodeCode(2, 14)).toBe('T2 · E14');
    expect(episodeCode(0, 1)).toBe('Especial');
    expect(episodeCode(1, 1, 'Película')).toBe('Película');
    expect(years(1989, 1996)).toBe('1989–1996');
    expect(years('1999-01-01', null)).toBe('1999 –');
    expect(playTime(754.6)).toBe('12:34');
  });
});

describe('guide day', () => {
  it('is the calendar day in the platform time zone', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-19T00:33:00Z'));
    expect(dayKey(0, 'America/Guatemala')).toBe('2026-10-18');
    expect(dayKey(1, 'America/Guatemala')).toBe('2026-10-19');
    expect(dayKey(0, 'UTC')).toBe('2026-10-19');
    vi.useRealTimers();
  });
});
