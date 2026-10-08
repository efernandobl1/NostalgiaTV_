import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { computed, DestroyRef, effect, inject, Injectable, NgZone, PLATFORM_ID, signal, untracked } from '@angular/core';
import { PlatformSettingsService } from './platform-settings.service';

interface ThemeOverride { year: number; month: number; enabled: boolean; }

@Injectable({ providedIn: 'root' })
export class SeasonalThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly site = inject(PlatformSettingsService);
  private readonly month = signal(0);
  private readonly localEffects = signal(true);
  readonly enabled = signal(false);
  readonly effects = computed(() => this.localEffects() && this.site.publicSettings().seasonalEffectsEnabled);
  readonly canToggle = computed(() => this.site.publicSettings().seasonalThemesEnabled && this.month() !== 9);
  readonly canToggleEffects = computed(() => this.site.publicSettings().seasonalEffectsEnabled);
  private override: ThemeOverride | null = null;
  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
    this.refresh();
    this.site.refreshPublic();
    effect(() => { this.site.publicSettings(); untracked(() => this.refresh()); });
    const refresh = () => { this.refresh(); this.site.refreshPublic(); };
    const zone = inject(NgZone);
    const timer = zone.runOutsideAngular(() => setInterval(() => zone.run(refresh), 60_000));
    this.document.addEventListener('visibilitychange', refresh);
    this.document.defaultView?.addEventListener('storage', refresh);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(timer);
      this.document.removeEventListener('visibilitychange', refresh);
      this.document.defaultView?.removeEventListener('storage', refresh);
    });
  }
  toggle(): void {
    this.refresh();
    if (!this.canToggle()) return;
    const now = this.calendarDate();
    this.enabled.update(value => !value);
    this.override = { ...now, enabled: this.enabled() };
    try { localStorage.setItem('seasonal-theme-override', JSON.stringify(this.override)); }
    catch { /* Keep the choice in memory when storage is unavailable. */ }
    this.apply();
  }
  toggleEffects(): void {
    if (!this.canToggleEffects()) return;
    this.localEffects.update(value => !value);
    try { localStorage.setItem('seasonal-effects', this.localEffects() ? 'on' : 'off'); }
    catch { /* Keep the local preference in memory. */ }
    this.apply();
  }
  private calendarDate(): { year: number; month: number } {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: this.site.publicSettings().timeZoneId, year: 'numeric', month: 'numeric',
    }).formatToParts(new Date());
    return {
      year: Number(parts.find(part => part.type === 'year')!.value),
      month: Number(parts.find(part => part.type === 'month')!.value) - 1,
    };
  }
  private refresh(): void {
    const now = this.calendarDate();
    this.month.set(now.month);
    try {
      const stored: unknown = JSON.parse(localStorage.getItem('seasonal-theme-override') ?? 'null');
      this.override = stored && typeof stored === 'object'
        && 'year' in stored && typeof stored.year === 'number'
        && 'month' in stored && typeof stored.month === 'number'
        && 'enabled' in stored && typeof stored.enabled === 'boolean' ? stored as ThemeOverride : this.override;
      this.localEffects.set(localStorage.getItem('seasonal-effects') !== 'off');
    } catch { /* Invalid or unavailable storage cannot prevent the seasonal default. */ }
    const current = this.override?.year === now.year && this.override.month === now.month;
    this.enabled.set(this.site.publicSettings().seasonalThemesEnabled
      && (now.month === 9 || (current && this.override!.enabled)));
    this.apply();
  }
  private apply(): void {
    this.document.body.classList.toggle('halloween-theme', this.enabled());
    this.document.body.classList.toggle('seasonal-effects', this.enabled() && this.effects());
    try {
      localStorage.setItem('seasonal-theme', this.enabled() ? 'halloween' : 'classic');
    } catch { /* Do not block navigation because a browser denies local storage. */ }
  }
}
