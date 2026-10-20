import { PublicSettings } from '../core/api/models';
import { seasonalEffects } from '../core/data/public-data';

describe('seasonal effects', () => {
  const settings = (season: PublicSettings['season'], seasonalEffectsEnabled: boolean): PublicSettings =>
    ({ timeZoneId: 'UTC', season, seasonalThemesEnabled: false, seasonalEffectsEnabled, registrationEnabled: true });

  it('follow the current season when the platform turns them on', () => {
    expect(seasonalEffects(settings('Halloween', true))).toBe('halloween');
    expect(seasonalEffects(settings('Christmas', true))).toBe('christmas');
    expect(seasonalEffects(settings('AllYear', true))).toBe('none');
  });

  it('stay off when the setting is off or not loaded yet', () => {
    expect(seasonalEffects(settings('Halloween', false))).toBe('none');
    expect(seasonalEffects(null)).toBe('none');
  });
});
