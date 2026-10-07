import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { DestroyRef, inject, Injectable, NgZone, PLATFORM_ID, signal } from '@angular/core';

interface ThemeOverride { year: number; month: number; enabled: boolean; }

@Injectable({ providedIn: 'root' })
export class SeasonalThemeService {
  private readonly document = inject(DOCUMENT);
  readonly enabled = signal(false);
  readonly effects = signal(true);
  private override: ThemeOverride | null = null;
  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
    this.refresh();
    const refresh = () => this.refresh();
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
    const now = new Date();
    this.enabled.update(value => !value);
    this.override = { year: now.getFullYear(), month: now.getMonth(), enabled: this.enabled() };
    try { localStorage.setItem('seasonal-theme-override', JSON.stringify(this.override)); }
    catch { /* Keep the choice in memory when storage is unavailable. */ }
    this.apply();
  }
  toggleEffects(): void { this.effects.update(value => !value); this.apply(); }
  private refresh(): void {
    const now = new Date();
    try {
      const stored: unknown = JSON.parse(localStorage.getItem('seasonal-theme-override') ?? 'null');
      this.override = stored && typeof stored === 'object'
        && 'year' in stored && typeof stored.year === 'number'
        && 'month' in stored && typeof stored.month === 'number'
        && 'enabled' in stored && typeof stored.enabled === 'boolean' ? stored as ThemeOverride : this.override;
      this.effects.set(localStorage.getItem('seasonal-effects') !== 'off');
    } catch { /* Invalid or unavailable storage cannot prevent the seasonal default. */ }
    const current = this.override?.year === now.getFullYear() && this.override.month === now.getMonth();
    this.enabled.set(current ? this.override!.enabled : now.getMonth() === 9);
    this.apply();
  }
  private apply(): void {
    this.document.body.classList.toggle('halloween-theme', this.enabled());
    this.document.body.classList.toggle('seasonal-effects', this.enabled() && this.effects());
    try {
      localStorage.setItem('seasonal-theme', this.enabled() ? 'halloween' : 'classic');
      localStorage.setItem('seasonal-effects', this.effects() ? 'on' : 'off');
    } catch { /* Do not block navigation because a browser denies local storage. */ }
  }
}
