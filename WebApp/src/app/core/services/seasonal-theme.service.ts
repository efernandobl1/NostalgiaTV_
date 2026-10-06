import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SeasonalThemeService {
  private readonly document = inject(DOCUMENT);
  readonly enabled = signal(false);
  readonly effects = signal(true);
  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
    try {
      this.enabled.set(localStorage.getItem('seasonal-theme') === 'halloween');
      this.effects.set(localStorage.getItem('seasonal-effects') !== 'off');
    } catch { /* Theme preferences remain optional when storage is unavailable. */ }
    this.apply();
  }
  toggle(): void { this.enabled.update(value => !value); this.apply(); }
  toggleEffects(): void { this.effects.update(value => !value); this.apply(); }
  private apply(): void {
    this.document.body.classList.toggle('halloween-theme', this.enabled());
    this.document.body.classList.toggle('seasonal-effects', this.enabled() && this.effects());
    try {
      localStorage.setItem('seasonal-theme', this.enabled() ? 'halloween' : 'classic');
      localStorage.setItem('seasonal-effects', this.effects() ? 'on' : 'off');
    } catch { /* Do not block navigation because a browser denies local storage. */ }
  }
}
