import { dayKey, episodeCode, playTime, randomEpisode, resumeEpisode, years } from '../core/data/public-data';
import { passwordScore } from '../features/auth/password';
import { playerShortcut } from '../features/public/episode/episode';
import { formatPairCode } from '../features/public/pair/pair';
import { stepLevel } from '../features/tv/tv-settings';
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
    expect(episodeCode(2, 5, 'Episodio', 'B')).toBe('T2 · E5B');
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

describe('episode player shortcuts', () => {
  const key = (k: string, target: Element = document.body, mods: Partial<KeyboardEvent> = {}) =>
    playerShortcut({ key: k, altKey: false, ctrlKey: false, metaKey: false, target, ...mods });

  it('plays, pauses and skips', () => {
    expect(key(' ')).toBe('toggle');
    expect(key('ArrowLeft')).toBe('back');
    expect(key('ArrowRight')).toBe('forward');
    expect(key('f')).toBe('fullscreen');
    expect(key('F')).toBe('fullscreen');
    expect(key('Enter')).toBeNull();
    expect(key('ArrowRight', document.body, { ctrlKey: true })).toBeNull();
  });

  it('leaves form fields and focused buttons alone', () => {
    expect(key('ArrowLeft', document.createElement('input'))).toBeNull();
    expect(key(' ', document.createElement('button'))).toBeNull();
    expect(key('ArrowRight', document.createElement('button'))).toBe('forward');
  });
});

describe('random playback', () => {
  const episodes = [1, 2, 3, 4].map(id => ({ id, filePath: id === 4 ? '' : `/uploads/${id}.mp4` }));

  it('never repeats the current episode or picks one without a file', () => {
    for (const r of [0, 0.5, 0.99]) expect([2, 3]).toContain(randomEpisode(episodes, 1, new Set(), () => r)?.id);
  });

  it('prefers unfinished episodes, then any other', () => {
    expect(randomEpisode(episodes, 1, new Set([2]), () => 0.99)?.id).toBe(3);
    expect(randomEpisode(episodes, 1, new Set([2, 3]), () => 0)?.id).toBe(2);
    expect(randomEpisode(episodes.slice(0, 1), 1, new Set())).toBeNull();
  });
});

describe('series resume', () => {
  const episodes = [{ id: 1, seasonNumber: 0 }, { id: 2, seasonNumber: 1 }, { id: 3, seasonNumber: 1 }];
  const progress = (entries: [number, number, boolean][]) => new Map(entries.map(([id, currentSecond, completed]) => [id, { currentSecond, completed }]));

  it('continues the episode in progress', () => {
    expect(resumeEpisode(episodes, progress([[2, 0, true], [3, 120, false]]))).toEqual({ episode: episodes[2], started: true });
  });

  it('plays the first unwatched regular episode, then the first one', () => {
    expect(resumeEpisode(episodes, progress([]))).toEqual({ episode: episodes[1], started: false });
    expect(resumeEpisode(episodes, progress([[2, 0, true], [3, 0, true]]))).toEqual({ episode: episodes[0], started: false });
    expect(resumeEpisode([], progress([]))).toBeNull();
  });
});

describe('TV CRT levels', () => {
  it('steps within range and wraps only on OK', () => {
    expect(stepLevel('intensity', 20, 1)).toBe(30);
    expect(stepLevel('intensity', 0, -1)).toBe(0);
    expect(stepLevel('intensity', 100, 1)).toBe(100);
    expect(stepLevel('intensity', 100, 1, true)).toBe(0);
    expect(stepLevel('density', 10, 1, true)).toBe(1);
    expect(stepLevel('density', 2, -1)).toBe(1);
  });
});
